/**
 * TafseerService - Production-Ready Multi-Source Tafseer Client
 *
 * Three API backends:
 *   1. api.quran-tafseer.com  → Arabic tafseers  (IDs 1–8)
 *   2. api.quran.com/v4       → English tafseers  (IDs 169, 168, 817)
 *   3. api.quran.com/v4       → Urdu tafseers     (IDs 160, 159, 818, 157)
 *
 * Features:
 *   - AsyncStorage + in-memory caching (7-day TTL)
 *   - Retry with exponential backoff
 *   - Request deduplication
 *   - HTML tag stripping
 *   - Graceful offline fallback list
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */
const TAFSEER_COM_BASE = 'http://api.quran-tafseer.com';   // Arabic (HTTP-only)
const QURAN_COM_BASE   = 'https://api.quran.com/api/v4';   // English + Urdu
const REQUEST_TIMEOUT  = 15_000;
const CACHE_TTL        = 7 * 24 * 60 * 60 * 1000;          // 7 days
const MAX_RETRIES      = 2;
const BATCH_SIZE       = 50;   // quran-tafseer.com batch limit

const CACHE_KEYS = {
  TAFSEER_LIST:     '@tafseer_list_v2',
  SELECTED_TAFSEER: '@tafseer_selected_id',
  SURAH_TAFSEER:    (id: number, s: number) => `@tafseer_${id}_surah_${s}_v2`,
};

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */
export interface TafseerSource {
  id: number;
  name: string;
  language: string;        // 'ar' | 'en' | 'ur'
  author: string;
  book_name: string;
  /** Which backend to hit: 'tafseercom' or 'qurancom' */
  _backend?: 'tafseercom' | 'qurancom';
}

export interface TafseerAyah {
  ayah_number: number;
  text: string;
}

interface CachedData<T> { data: T; timestamp: number; }

/* ═══════════════════════════════════════════════
   IN-MEMORY CACHES
   ═══════════════════════════════════════════════ */
let tafseerListCache: TafseerSource[] | null = null;
const surahTafseerCache = new Map<string, Map<number, string>>();
const inflightRequests  = new Map<string, Promise<any>>();

/* ═══════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════ */
async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try { return await fetch(url, { signal: c.signal }); }
  finally { clearTimeout(t); }
}

async function retryFetch<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let last: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** i, 5000)));
    }
  }
  throw last!;
}

function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const e = inflightRequests.get(key);
  if (e) return e as Promise<T>;
  const p = fn().finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, p);
  return p;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const r = await AsyncStorage.getItem(key);
    if (!r) return null;
    const p: CachedData<T> = JSON.parse(r);
    if (Date.now() - p.timestamp > CACHE_TTL) { AsyncStorage.removeItem(key).catch(() => {}); return null; }
    return p.data;
  } catch { return null; }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() })); }
  catch {}
}

/** Strip HTML & decode entities */
function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* ═══════════════════════════════════════════════
   CANONICAL TAFSEER LIST (always available offline)
   ═══════════════════════════════════════════════ */
const ALL_TAFSEERS: TafseerSource[] = [
  // ── Urdu (api.quran.com) ──
  { id: 159, name: 'بیان القرآن',             language: 'ur', author: 'ڈاکٹر اسرار احمد',              book_name: 'بیان القرآن',                 _backend: 'qurancom' },
  { id: 157, name: 'فی ظلال القرآن',          language: 'ur', author: 'سید ابراہیم قطب',               book_name: 'فی ظلال القرآن',              _backend: 'qurancom' },

  // ── English (api.quran.com) ──
  { id: 168, name: "Ma'arif al-Qur'an",      language: 'en', author: 'Mufti Muhammad Shafi',          book_name: "Ma'arif al-Qur'an",           _backend: 'qurancom' },

  // ── Arabic (api.quran-tafseer.com) ──
  { id: 4,  name: 'تفسير ابن كثير',           language: 'ar', author: 'ابن كثير القرشي',               book_name: 'تفسير القرآن العظيم',          _backend: 'tafseercom' },
  { id: 2,  name: 'تفسير الجلالين',          language: 'ar', author: 'جلال الدين المحلي والسيوطي',     book_name: 'تفسير الجلالين',              _backend: 'tafseercom' },
];

/* ═══════════════════════════════════════════════
   BACKEND FETCHERS
   ═══════════════════════════════════════════════ */

/** Fetch from api.quran-tafseer.com (Arabic tafseers, IDs 1-8) */
async function fetchFromTafseerCom(
  tafseerId: number, surahNumber: number, totalAyahs: number,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  for (let from = 1; from <= totalAyahs; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, totalAyahs);
    try {
      const batch = await retryFetch(async () => {
        const url = `${TAFSEER_COM_BASE}/tafseer/${tafseerId}/${surahNumber}/${from}/${to}/`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TafseerAyah[] = await res.json();
        if (!Array.isArray(data)) throw new Error('Bad response');
        return data;
      });
      for (const e of batch) {
        if (e.ayah_number && e.text) {
          const t = cleanHtml(e.text);
          if (t) result.set(e.ayah_number, t);
        }
      }
    } catch (err) {
      console.warn(`[TafseerService] tafseercom batch ${from}-${to} failed:`, err);
    }
  }
  return result;
}

/** Progress callback type — called as each ayah's tafseer arrives */
export type TafseerProgressCallback = (ayahNumber: number, text: string) => void;

/** Fetch from api.quran.com/v4 (English + Urdu tafseers) — progressive */
async function fetchFromQuranCom(
  tafseerId: number, surahNumber: number, totalAyahs: number,
  onProgress?: TafseerProgressCallback,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const CONCURRENCY = 10;

  for (let start = 1; start <= totalAyahs; start += CONCURRENCY) {
    const end = Math.min(start + CONCURRENCY - 1, totalAyahs);
    const promises: Promise<void>[] = [];

    for (let ayah = start; ayah <= end; ayah++) {
      promises.push(
        (async () => {
          try {
            const url = `${QURAN_COM_BASE}/tafsirs/${tafseerId}/by_ayah/${surahNumber}:${ayah}`;
            const res = await fetchWithTimeout(url);
            if (!res.ok) return;
            const json = await res.json();
            const rawText = json?.tafsir?.text;
            if (rawText) {
              const t = cleanHtml(rawText);
              if (t) {
                result.set(ayah, t);
                onProgress?.(ayah, t);
              }
            }
          } catch {
            // Skip failed ayahs — partial data is fine
          }
        })()
      );
    }
    await Promise.all(promises);
  }
  return result;
}

/* ═══════════════════════════════════════════════
   SERVICE
   ═══════════════════════════════════════════════ */
const TafseerService = {
  /**
   * Get all available tafseer sources — always returns the hardcoded curated list
   */
  async getAvailableTafseers(): Promise<TafseerSource[]> {
    return ALL_TAFSEERS;
  },

  /**
   * Get tafseer text for all ayahs of a surah.
   * Automatically routes to the correct backend based on tafseer ID.
   * @param onProgress - Optional callback fired as each ayah's tafseer arrives (for progressive rendering)
   */
  async getSurahTafseer(
    tafseerId: number, surahNumber: number, totalAyahs: number,
    onProgress?: TafseerProgressCallback,
  ): Promise<Map<number, string>> {
    const cacheKey = `${tafseerId}:${surahNumber}`;

    // 1. In-memory
    const mem = surahTafseerCache.get(cacheKey);
    if (mem && mem.size > 0) {
      // Still fire progress for all cached items so UI populates
      if (onProgress) mem.forEach((text, ayah) => onProgress(ayah, text));
      return mem;
    }

    return dedup(cacheKey, async () => {
      // 2. Disk cache
      const diskKey = CACHE_KEYS.SURAH_TAFSEER(tafseerId, surahNumber);
      const cached = await readCache<Record<number, string>>(diskKey);
      if (cached && Object.keys(cached).length > 0) {
        const map = new Map<number, string>(
          Object.entries(cached).map(([k, v]) => [Number(k), v])
        );
        surahTafseerCache.set(cacheKey, map);
        if (onProgress) map.forEach((text, ayah) => onProgress(ayah, text));
        return map;
      }

      // 3. Route to correct backend
      const source = ALL_TAFSEERS.find(t => t.id === tafseerId);
      const backend = source?._backend || (tafseerId <= 13 ? 'tafseercom' : 'qurancom');

      let result: Map<number, string>;
      if (backend === 'tafseercom') {
        result = await fetchFromTafseerCom(tafseerId, surahNumber, totalAyahs);
        // Fire progress for all at once (batch API)
        if (onProgress) result.forEach((text, ayah) => onProgress(ayah, text));
      } else {
        result = await fetchFromQuranCom(tafseerId, surahNumber, totalAyahs, onProgress);
      }

      // 4. Persist
      if (result.size > 0) {
        surahTafseerCache.set(cacheKey, result);
        const obj: Record<number, string> = {};
        result.forEach((v, k) => { obj[k] = v; });
        writeCache(diskKey, obj).catch(() => {});
      }

      return result;
    });
  },

  /** Get user's preferred tafseer source ID */
  async getSelectedTafseerId(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(CACHE_KEYS.SELECTED_TAFSEER);
      if (val) {
        const id = parseInt(val, 10);
        // Validate the saved ID still exists in our curated list
        if (!isNaN(id) && ALL_TAFSEERS.some(t => t.id === id)) return id;
      }
    } catch {}
    return 159; // Default: بیان القرآن (Urdu — Dr. Israr Ahmad)
  },

  async setSelectedTafseerId(id: number): Promise<void> {
    try { await AsyncStorage.setItem(CACHE_KEYS.SELECTED_TAFSEER, String(id)); } catch {}
  },

  /** Clear all cached tafseer data */
  async clearCache(): Promise<void> {
    surahTafseerCache.clear();
    tafseerListCache = null;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const tk = keys.filter(k => k.startsWith('@tafseer_'));
      if (tk.length > 0) await AsyncStorage.multiRemove(tk);
    } catch {}
  },

  /** Preload tafseer for a surah in background */
  async preload(tafseerId: number, surahNumber: number, totalAyahs: number): Promise<void> {
    try { await TafseerService.getSurahTafseer(tafseerId, surahNumber, totalAyahs); } catch {}
  },
};

export default TafseerService;
