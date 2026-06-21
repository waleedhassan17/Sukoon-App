/**
 * HadithService — data layer for the Ahadees (Hadith) feature.
 *
 * Source: fawazahmed0 hadith-api (free, CDN-hosted, no key).
 *   - Books list:      editions.json (one group per collection, many languages).
 *   - Full edition:    editions/{edition}.min.json  (metadata.sections + hadiths).
 *   - Single section:  editions/{edition}/sections/{n}.min.json  (just that chapter).
 *
 * Performance strategy (big books like Bukhari are ~4.8 MB):
 *   - getBooks(): editions.json (~30 KB), cached in AsyncStorage + memory.
 *   - getSections(edition): the chapter list (table of contents). Cached SMALL
 *     in AsyncStorage. On first build we fetch the full edition once to read its
 *     metadata, keep the hadiths in a session-only in-memory cache, and persist
 *     only the tiny TOC.
 *   - getSectionHadiths(): served from the in-memory full data if present,
 *     otherwise via the lightweight per-section endpoint (~16 KB). So the big
 *     full download happens at most once ever per book, then reads are cheap.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';
const EDITIONS_URL = `${BASE}/editions.json`;

const CACHE_KEYS = {
  // v2: schema gained per-language `editions`. Bumping the key discards any old
  // cached books that lacked it (which would crash `book.editions.english`).
  EDITIONS: 'sukoon_hadith_editions_v2', // { fetchedAt, data }
  TOC: (edition: string) => `sukoon_hadith_toc_${edition}`,
  SECTION: (edition: string, num: number) => `sukoon_hadith_sec_${edition}_${num}`,
  MERGED: (bookId: string, num: number) => `sukoon_hadith_mrg_${bookId}_${num}`,
};

const EDITIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Types ──────────────────────────────────────────────────────────────────

export interface BookEditions {
  arabic: string | null;   // e.g. 'ara-bukhari'
  urdu: string | null;     // e.g. 'urd-bukhari' (null if unavailable)
  english: string | null;  // e.g. 'eng-bukhari'
}

export interface HadithBook {
  id: string;          // 'bukhari'
  name: string;        // 'Sahih al Bukhari'
  edition: string;     // primary edition used for the chapter list (English)
  language: string;    // primary language label
  hasSections: boolean;
  editions: BookEditions;
}

/** A hadith merged across the available language editions (same hadithnumber). */
export interface MergedHadith {
  hadithnumber: number;
  arabic: string;
  urdu: string;
  english: string;
  grades: HadithGrade[];
  reference: { book: number; hadith: number };
}

export interface HadithSection {
  number: number;      // section / chapter number
  name: string;        // chapter title
  first: number;       // first hadith number in the chapter
  last: number;        // last hadith number in the chapter
  count: number;       // number of hadiths in the chapter
}

export interface HadithGrade {
  name: string;
  grade: string;
}

export interface HadithItem {
  hadithnumber: number;
  arabicnumber: number;
  text: string;
  grades: HadithGrade[];
  reference: { book: number; hadith: number };
}

// ── In-memory (session) caches ──────────────────────────────────────────────

let editionsMemo: HadithBook[] | null = null;
const tocMemo = new Map<string, HadithSection[]>();
const fullDataMemo = new Map<string, HadithItem[]>();          // edition -> all hadiths
const sectionMemo = new Map<string, HadithItem[]>();           // `${edition}:${n}` -> hadiths
const mergedMemo = new Map<string, MergedHadith[]>();          // `${bookId}:${n}` -> merged

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJson(url: string, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch with one automatic retry on failure (network flakes). */
async function fetchJsonRetry(url: string, timeoutMs = 30000): Promise<any> {
  try {
    return await fetchJson(url, timeoutMs);
  } catch (e) {
    // Single retry after a short pause
    await new Promise((r) => setTimeout(r, 800));
    return fetchJson(url, timeoutMs);
  }
}

/** Cached books are only usable if they carry the per-language `editions` field. */
function isValidBooks(data: any): data is HadithBook[] {
  return Array.isArray(data) && data.length > 0 && data.every((b) => b && b.id && b.editions);
}

/** Pick the cleanest edition for a given language (avoids "…1" search variants). */
function pickLang(collection: any[], language: string): string | null {
  if (!Array.isArray(collection)) return null;
  const arr = collection.filter((c) => c.language === language);
  if (arr.length === 0) return null;
  const clean = arr.find((c) => !/\d$/.test(c.name));
  return (clean || arr[0]).name;
}

// ── Public API ───────────────────────────────────────────────────────────────

export const HadithService = {
  /**
   * List of hadith books (one card per collection). Cached in memory +
   * AsyncStorage (7-day TTL). Falls back to any cached copy on network error.
   */
  async getBooks(): Promise<HadithBook[]> {
    if (editionsMemo) return editionsMemo;

    // Try fresh cache first.
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.EDITIONS);
      if (raw) {
        const cached = JSON.parse(raw);
        if (isValidBooks(cached?.data) && Date.now() - (cached.fetchedAt ?? 0) < EDITIONS_TTL_MS) {
          editionsMemo = cached.data;
          return cached.data;
        }
      }
    } catch {}

    try {
      const json = await fetchJson(EDITIONS_URL);
      const books: HadithBook[] = [];
      for (const [id, info] of Object.entries(json) as [string, any][]) {
        const english = pickLang(info?.collection, 'English');
        const arabic = pickLang(info?.collection, 'Arabic');
        const urdu = pickLang(info?.collection, 'Urdu');
        const primary = english || arabic;
        if (!primary) continue;
        const hasSections = (info.collection.find((c: any) => c.name === primary)?.has_sections) ?? false;
        books.push({
          id,
          name: info.name ?? id,
          edition: primary,
          language: english ? 'English' : 'Arabic',
          hasSections,
          editions: { arabic, urdu, english },
        });
      }
      // Stable, friendly order (the big six first, then the rest).
      const order = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'nawawi', 'qudsi', 'dehlawi'];
      books.sort((a, b) => {
        const ia = order.indexOf(a.id); const ib = order.indexOf(b.id);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      editionsMemo = books;
      AsyncStorage.setItem(CACHE_KEYS.EDITIONS, JSON.stringify({ fetchedAt: Date.now(), data: books })).catch(() => {});
      return books;
    } catch (e) {
      // Network failed — serve any valid stale cache rather than nothing.
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEYS.EDITIONS);
        if (raw) {
          const cached = JSON.parse(raw);
          if (isValidBooks(cached?.data)) { editionsMemo = cached.data; return cached.data; }
        }
      } catch {}
      throw e;
    }
  },

  /**
   * Table of contents (chapters) for an edition. Cached small in AsyncStorage.
   * The first build fetches the full edition once (to read metadata) and keeps
   * its hadiths in the session memo so subsequent reads are instant.
   */
  async getSections(edition: string): Promise<HadithSection[]> {
    if (tocMemo.has(edition)) return tocMemo.get(edition)!;

    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.TOC(edition));
      if (raw) {
        const sections = JSON.parse(raw) as HadithSection[];
        if (Array.isArray(sections) && sections.length > 0) {
          tocMemo.set(edition, sections);
          return sections;
        }
      }
    } catch {}

    // Build from the full edition file (with retry for large downloads).
    const full = await fetchJsonRetry(`${BASE}/editions/${edition}.min.json`);
    const sectionsMap: Record<string, string> = full?.metadata?.sections ?? {};
    const details: Record<string, any> = full?.metadata?.section_details ?? {};
    const hadiths: HadithItem[] = Array.isArray(full?.hadiths) ? full.hadiths : [];

    const sections: HadithSection[] = Object.keys(sectionsMap)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0 && (sectionsMap[String(n)] ?? '').trim().length > 0)
      .sort((a, b) => a - b)
      .map((n) => {
        const d = details[String(n)] ?? {};
        const first = Number(d.hadithnumber_first) || 0;
        const last = Number(d.hadithnumber_last) || 0;
        const count = first && last ? last - first + 1 : 0;
        return { number: n, name: sectionsMap[String(n)], first, last, count };
      });

    // Keep hadiths for this session so reading a chapter doesn't refetch.
    if (hadiths.length > 0) fullDataMemo.set(edition, hadiths);

    tocMemo.set(edition, sections);
    AsyncStorage.setItem(CACHE_KEYS.TOC(edition), JSON.stringify(sections)).catch(() => {});
    return sections;
  },

  /**
   * Hadiths within a chapter. Uses in-memory full data when available; otherwise
   * the lightweight per-section endpoint.
   */
  async getSectionHadiths(edition: string, section: HadithSection): Promise<HadithItem[]> {
    const memoKey = `${edition}:${section.number}`;
    if (sectionMemo.has(memoKey)) return sectionMemo.get(memoKey)!;

    // From the full data we already have in memory (filter by hadith range).
    const full = fullDataMemo.get(edition);
    if (full) {
      const list = full.filter((h) =>
        section.first && section.last
          ? h.hadithnumber >= section.first && h.hadithnumber <= section.last
          : h.reference?.book === section.number,
      );
      if (list.length > 0) {
        sectionMemo.set(memoKey, list);
        return list;
      }
    }

    // Try AsyncStorage cache for this specific section.
    const cacheKey = CACHE_KEYS.SECTION(edition, section.number);
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as HadithItem[];
        if (Array.isArray(cached) && cached.length > 0) {
          sectionMemo.set(memoKey, cached);
          return cached;
        }
      }
    } catch {}

    // Otherwise fetch just this chapter (with retry).
    const data = await fetchJsonRetry(`${BASE}/editions/${edition}/sections/${section.number}.min.json`);
    const list: HadithItem[] = Array.isArray(data?.hadiths) ? data.hadiths : [];
    sectionMemo.set(memoKey, list);
    // Persist to AsyncStorage for instant future loads
    AsyncStorage.setItem(cacheKey, JSON.stringify(list)).catch(() => {});
    return list;
  },

  /**
   * Hadiths of a chapter merged across the available language editions (Arabic +
   * Urdu + English) by hadith number, so the reader can show the Arabic text
   * with a Urdu / English translation. Each language is fetched via the
   * lightweight per-section endpoint (in parallel) and cached per book+section.
   */
  async getMergedSection(book: HadithBook, section: HadithSection): Promise<MergedHadith[]> {
    const memoKey = `${book.id}:${section.number}`;
    if (mergedMemo.has(memoKey)) return mergedMemo.get(memoKey)!;

    // Try AsyncStorage cache for this merged section.
    const mergedCacheKey = CACHE_KEYS.MERGED(book.id, section.number);
    try {
      const raw = await AsyncStorage.getItem(mergedCacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as MergedHadith[];
        if (Array.isArray(cached) && cached.length > 0) {
          mergedMemo.set(memoKey, cached);
          return cached;
        }
      }
    } catch {}

    const eds = book.editions ?? { arabic: null, urdu: null, english: null };
    const langs: { key: 'arabic' | 'urdu' | 'english'; edition: string }[] = [];
    if (eds.arabic) langs.push({ key: 'arabic', edition: eds.arabic });
    if (eds.urdu) langs.push({ key: 'urdu', edition: eds.urdu });
    if (eds.english) langs.push({ key: 'english', edition: eds.english });

    const fetched = await Promise.all(
      langs.map(async (l) => {
        // Reuse the full English data we may already hold in memory (from TOC build).
        if (l.key === 'english' && fullDataMemo.has(l.edition)) {
          const full = fullDataMemo.get(l.edition)!;
          const list = full.filter((h) =>
            section.first && section.last
              ? h.hadithnumber >= section.first && h.hadithnumber <= section.last
              : h.reference?.book === section.number,
          );
          if (list.length > 0) return { key: l.key, list };
        }
        try {
          const data = await fetchJson(`${BASE}/editions/${l.edition}/sections/${section.number}.min.json`);
          return { key: l.key, list: (Array.isArray(data?.hadiths) ? data.hadiths : []) as HadithItem[] };
        } catch {
          return { key: l.key, list: [] as HadithItem[] };
        }
      }),
    );

    const map = new Map<number, MergedHadith>();
    for (const { key, list } of fetched) {
      for (const h of list) {
        let m = map.get(h.hadithnumber);
        if (!m) {
          m = { hadithnumber: h.hadithnumber, arabic: '', urdu: '', english: '', grades: [], reference: h.reference };
          map.set(h.hadithnumber, m);
        }
        if (key === 'arabic') m.arabic = h.text ?? '';
        else if (key === 'urdu') m.urdu = h.text ?? '';
        else {
          m.english = h.text ?? '';
          if (Array.isArray(h.grades)) m.grades = h.grades;
          if (h.reference) m.reference = h.reference;
        }
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => a.hadithnumber - b.hadithnumber);
    mergedMemo.set(memoKey, merged);
    // Persist to AsyncStorage for instant future loads
    AsyncStorage.setItem(mergedCacheKey, JSON.stringify(merged)).catch(() => {});
    return merged;
  },
};

export default HadithService;
