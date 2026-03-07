/**
 * QuranService - Production-Ready Quran API with Robust Error Handling
 * 
 * Features:
 * - Multiple API fallbacks (alquran.cloud → quran.com → local cache)
 * - Automatic retry with exponential backoff
 * - Request timeouts (15s)
 * - Request deduplication
 * - AsyncStorage persistence for offline support
 * - In-memory caching for instant access
 * - Stale-while-revalidate pattern
 * - Comprehensive error logging
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const QURANCOM_BASE = 'https://api.quran.com/api/v4';
const BACKUP_QURAN_BASE = 'https://quran-api.com/api/v2';

// Cache keys
const CACHE_KEYS = {
  SURAHS_META: '@quran_surahs_meta',
  SURAH_DATA: (num: number) => `@quran_surah_${num}`,
  CACHE_VERSION: '@quran_cache_version',
};

// Current cache version - increment to invalidate old caches
// v1.4: Fixed Bismillah pre-filtering BEFORE translation alignment to fix off-by-one numbering
// v1.5: Al-Fatiha Bismillah now excluded from numbered ayahs (Mushaf-accurate)
// v1.7: Fixed HTML stripping in translations, added fallback translation APIs,
// guaranteed Bismillah for surahs 2-114 (except 9)
const CACHE_VERSION = '1.7';

// Cache TTL (24 hours - but we use stale-while-revalidate)
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Strip HTML tags, decode entities, and clean up translation text.
 * The alquran.cloud API sometimes returns translations with HTML tags like:
 *   <span class="h">, <sup foot_note="...">1</sup>, etc.
 * These must be removed before display.
 */
function stripHtmlFromTranslation(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')              // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')              // Non-breaking space
    .replace(/&amp;/g, '&')               // Ampersand
    .replace(/&lt;/g, '<')                // Less-than
    .replace(/&gt;/g, '>')                // Greater-than
    .replace(/&quot;/g, '"')             // Double quote
    .replace(/&#39;/g, "'")              // Single quote
    .replace(/&#x27;/g, "'")             // Single quote (hex)
    .replace(/&#(\d+);/g, (_, code) =>    // Numeric entities
      String.fromCharCode(parseInt(code, 10)))
    .replace(/\s{2,}/g, ' ')              // Collapse multiple spaces
    .trim();
}

// Fallback translation API endpoints
const QURAN_API_V2 = 'https://api.quran.com/api/v4';
// English: edition 131 (Sahih International), 20 (Pickthall)
// Urdu: edition 97 (Ahmed Ali), 54 (Fateh Muhammad Jalandhry)

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string; // Arabic
  translation?: string; // English
  urduTranslation?: string;
  tafseer?: string;
  audio?: string;
  juz: number;
  page: number;
  hizbQuarter: number;
}

/** Complete surah response including extracted Bismillah text from API */
export interface SurahData {
  meta: SurahMeta;
  ayahs: Ayah[];
  /** Bismillah Arabic text extracted from the raw API response (undefined for At-Tawbah) */
  bismillahText?: string;
}

export interface TafseerEntry {
  ayah: number;
  text: string;
  source: string;
}

/**
 * Bismillah Prefix Handling
 * 
 * The alquran.cloud and quran.com APIs often prepend the Bismillah text
 * ("In the name of Allah, the Most Gracious, the Most Merciful") to the
 * first ayah's text for surahs 2–114 (except At-Tawbah / 9).
 * 
 * Since the app renders a dedicated BismillahCard above the verses,
 * we strip this prefix from ayah 1 to avoid duplication.
 * 
 * Al-Fatiha (1): Bismillah IS verse 1 — never stripped.
 * At-Tawbah (9): No Bismillah at all — nothing to strip.
 */
const BISMILLAH_ARABIC_PATTERNS: string[] = [
  // alquran.cloud (ar.alafasy, ar.uthmani, etc.)
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  // quran.com text_uthmani
  'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ',
  // Simplified / imla'i forms
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
  'بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ',
  'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ',
  // Alafasy with small high dotless head of khah
  'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيۡمِ',
];

/**
 * Flexible Bismillah regex — matches the Bismillah formula with ANY combination
 * of diacritical marks (tashkeel) across different Quran text editions.
 * Returns the exact matched portion (with original diacritics) via capture group.
 */
const _DM = '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08E1\u06E1]*';
const BISMILLAH_FLEX_REGEX = new RegExp(
  '^(ب' + _DM + 'س' + _DM + 'م' + _DM + '\\s+' +
  '[ٱا]' + _DM + 'ل' + _DM + 'ل' + _DM + '[ٰـ]?' + _DM + 'ه' + _DM + '\\s+' +
  '[ٱا]' + _DM + 'ل' + _DM + 'ر' + _DM + 'ح' + _DM + 'م' + _DM + '[ٰـ]?' + _DM + 'ن' + _DM + '\\s+' +
  '[ٱا]' + _DM + 'ل' + _DM + 'ر' + _DM + 'ح' + _DM + '[يی]' + _DM + 'م' + _DM + ')'
);

/**
 * Flexibly match Bismillah at the start of text.
 * Handles any diacritical mark variant across Quran APIs.
 * Returns the matched Bismillah text (with original diacritics) or null.
 */
function matchBismillahFlexible(text: string): string | null {
  const m = text.trim().match(BISMILLAH_FLEX_REGEX);
  return m ? m[1] : null;
}

/**
 * Strip Bismillah prefix from Arabic text.
 * Uses exact patterns first, then flexible regex fallback.
 * Returns original text unchanged if no Bismillah is found.
 */
function stripBismillahFromArabic(text: string): string {
  const trimmed = text.trim();
  // 1. Exact pattern match
  for (const pattern of BISMILLAH_ARABIC_PATTERNS) {
    if (trimmed.startsWith(pattern)) {
      const stripped = trimmed.slice(pattern.length).trim();
      return stripped || trimmed;
    }
  }
  // 2. Flexible regex fallback
  const match = matchBismillahFlexible(trimmed);
  if (match) {
    const stripped = trimmed.slice(match.length).trim();
    return stripped || trimmed;
  }
  return trimmed;
}

/**
 * Check if text consists entirely of a Bismillah pattern (no additional verse text).
 * Uses exact patterns first, then flexible regex fallback.
 */
function isBismillahOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  
  // 1. Exact pattern match
  for (const pattern of BISMILLAH_ARABIC_PATTERNS) {
    if (trimmed === pattern) return true;
    if (trimmed.startsWith(pattern)) {
      const remainder = trimmed.slice(pattern.length).trim();
      if (remainder.length === 0) return true;
    }
  }
  // 2. Flexible regex fallback
  const match = matchBismillahFlexible(trimmed);
  if (match) {
    const remainder = trimmed.slice(match.length).trim();
    return remainder.length === 0;
  }
  return false;
}

/**
 * Strip Bismillah prefix from the first ayah of a surah.
 * 
 * This handles ONLY Case 2 — Bismillah prepended to first ayah text.
 * Case 1 (standalone Bismillah ayah) is handled EARLIER in the fetch
 * pipeline, before translation alignment, to prevent off-by-one errors.
 *
 * At-Tawbah (9): No Bismillah at all — nothing to do.
 */
function stripFirstAyahBismillahPrefix(ayahs: Ayah[], surahNumber: number): Ayah[] {
  // At-Tawbah: No Bismillah — nothing to strip
  if (surahNumber === 9 || ayahs.length === 0) {
    return ayahs;
  }

  const first = ayahs[0];

  // Strip Bismillah prefix from the first ayah's text (if prepended)
  const cleanedArabic = stripBismillahFromArabic(first.text);

  // Only modify if we actually stripped something
  if (cleanedArabic !== first.text.trim()) {
    const cleaned = [...ayahs];
    cleaned[0] = { ...first, text: cleanedArabic };
    return cleaned;
  }

  return ayahs;
}

/**
 * CRITICAL: Normalize ayah numbering to ensure consistent 1-based indexing.
 * 
 * Some API responses may have quirks:
 * - numberInSurah starting from 0
 * - Gaps in numbering
 * - Bismillah counted as ayah 0
 * - Audio editions shifting numbers by 1 (Bismillah as 1, verse 1 as 2, etc.)
 * 
 * This function ensures every ayah has correct sequential numberInSurah (1, 2, 3, ...)
 * while preserving all other data for internal operations.
 */
function normalizeAyahNumbering(ayahs: Ayah[]): Ayah[] {
  if (ayahs.length === 0) return ayahs;
  
  // Check if numbering is already correct (first ayah is 1 and sequential)
  const firstNum = ayahs[0]?.numberInSurah;
  const isCorrect = firstNum === 1 && ayahs.every((ay, i) => ay.numberInSurah === i + 1);
  
  if (isCorrect) return ayahs;
  
  // Normalize: assign sequential 1-based numbers
  return ayahs.map((ay, i) => ({
    ...ay,
    numberInSurah: i + 1,
  }));
}

/**
 * PRE-FILTER: Remove standalone Bismillah ayah from raw API response.
 *
 * Audio editions (like ar.alafasy) on alquran.cloud include Bismillah as a
 * separate ayah entry (typically numberInSurah 0 or 1) BEFORE the actual
 * first verse. Text editions (en.sahih, ur.jalandhry) do NOT include this
 * extra entry.
 *
 * This MUST be called on the raw Arabic ayah array BEFORE combining with
 * translation arrays by index. Otherwise, translations are misaligned:
 *
 *   Arabic[0] = Bismillah       English[0] = Verse 1 translation
 *   Arabic[1] = Verse 1    →    English[1] = Verse 2 translation  ← OFF BY ONE!
 *
 * By removing the standalone Bismillah first:
 *   Arabic[0] = Verse 1         English[0] = Verse 1 translation  ← CORRECT
 *   Arabic[1] = Verse 2         English[1] = Verse 2 translation  ← CORRECT
 *
 * Al-Fatiha (1): Bismillah IS also removed — shown via BismillahCard, not numbered.
 * At-Tawbah (9): No Bismillah — nothing to remove.
 */
function preFilterStandaloneBismillah(rawAyahs: any[], surahNumber: number): any[] {
  if (surahNumber === 9 || rawAyahs.length === 0) {
    return rawAyahs;
  }

  const firstText = rawAyahs[0]?.text?.trim() || '';
  
  if (isBismillahOnly(firstText)) {
    return rawAyahs.slice(1);
  }

  return rawAyahs;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for instant access
let surahsCache: SurahMeta[] | null = null;
const surahDataCache: Map<number, SurahData> = new Map();

// Request deduplication - prevent duplicate in-flight requests
const pendingRequests: Map<string, Promise<any>> = new Map();

// Prefetch state
let isPrefetched = false;
let prefetchPromise: Promise<void> | null = null;

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

const REQUEST_TIMEOUT = 15000; // 15 seconds

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = RETRY_CONFIG.maxAttempts,
  initialDelay = RETRY_CONFIG.initialDelay,
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
        ),
      ]);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on 404s or similar client errors
      const message = lastError?.message || '';
      if (message.includes('404') || message.includes('not found')) {
        throw lastError;
      }
      
      if (attempt < maxAttempts - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
          RETRY_CONFIG.maxDelay,
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed after max retries');
}

/**
 * Fetch with error handling and logging
 */
async function safeFetch(url: string, label: string = ''): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[QuranService] ${label} failed: ${msg}`);
    throw error;
  }
}

/**
 * Check if cache entry is stale
 */
function isCacheStale(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_TTL;
}

/**
 * Safe AsyncStorage get with JSON parsing
 */
async function getCached<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

/**
 * Safe AsyncStorage set with JSON stringification
 */
async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

/**
 * Deduplicate concurrent requests for the same resource
 */
function deduplicateRequest<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) return existing as Promise<T>;
  
  const promise = fetchFn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

export const QuranService = {
  /**
   * Initialize cache from AsyncStorage on app startup
   * Call this in _layout.tsx or app initialization
   */
  async initializeCache(): Promise<void> {
    try {
      // Check cache version
      const version = await AsyncStorage.getItem(CACHE_KEYS.CACHE_VERSION);
      if (version !== CACHE_VERSION) {
        // Invalidate old cache
        await this.clearCache();
        await AsyncStorage.setItem(CACHE_KEYS.CACHE_VERSION, CACHE_VERSION);
        return;
      }

      // Load surahs meta into memory
      const cached = await getCached<SurahMeta[]>(CACHE_KEYS.SURAHS_META);
      if (cached?.data) {
        surahsCache = cached.data;
      }
    } catch (e) {
      console.warn('Cache initialization failed:', e);
    }
  },

  /**
   * Prefetch essential data for instant first interaction
   * Non-blocking - returns immediately, fetches in background
   */
  prefetch(): Promise<void> {
    if (isPrefetched) return Promise.resolve();
    if (prefetchPromise) return prefetchPromise;
    
    prefetchPromise = (async () => {
      try {
        // Prefetch surahs list (most important for first interaction)
        await this.getAllSurahs();
        isPrefetched = true;
      } catch (e) {
        console.warn('Prefetch failed:', e);
      } finally {
        prefetchPromise = null;
      }
    })();
    
    return prefetchPromise;
  },

  /**
   * Get all 114 Surahs metadata
   * Uses stale-while-revalidate pattern
   */
  async getAllSurahs(): Promise<SurahMeta[]> {
    // Return from memory cache immediately
    if (surahsCache) return surahsCache;
    
    // Check AsyncStorage cache
    const cached = await getCached<SurahMeta[]>(CACHE_KEYS.SURAHS_META);
    if (cached?.data) {
      surahsCache = cached.data;
      
      // Revalidate in background if stale
      if (isCacheStale(cached.timestamp)) {
        this.fetchAndCacheSurahs().catch(() => {});
      }
      
      return surahsCache;
    }
    
    // No cache - fetch with deduplication
    return deduplicateRequest('surahs', () => this.fetchAndCacheSurahs());
  },

  /**
   * Fetch surahs from API and cache with retry
   */
  async fetchAndCacheSurahs(): Promise<SurahMeta[]> {
    try {
      // Try primary API with retry
      const result = await retryWithBackoff(
        async () => {
          const json = await safeFetch(`${ALQURAN_BASE}/surah`, 'Fetch all surahs');
          if (!json || json.code !== 200 || !json.data) {
            throw new Error('Invalid response format');
          }
          return json.data.map((s: any) => ({
            number: s.number,
            name: s.name,
            englishName: s.englishName,
            englishNameTranslation: s.englishNameTranslation,
            numberOfAyahs: s.numberOfAyahs,
            revelationType: s.revelationType,
          }));
        },
        RETRY_CONFIG.maxAttempts,
      );

      surahsCache = result;
      setCache(CACHE_KEYS.SURAHS_META, result).catch(() => {});
      return result;
    } catch (primaryError) {
      console.warn('[QuranService] Primary API failed for surahs list, trying fallback...');
      
      try {
        // Fallback to quran.com
        const json = await safeFetch(
          `${QURANCOM_BASE}/chapters?language=en`,
          'Fetch surahs from quran.com',
        );
        const result = json.chapters.map((s: any) => ({
          number: s.id,
          name: s.name_arabic || 'Unknown',
          englishName: s.name_simple || 'Unknown',
          englishNameTranslation: s.translated_name?.name || 'Unknown',
          numberOfAyahs: s.verses_count,
          revelationType: s.revelation_place === 'makkah' ? 'Meccan' : 'Medinan',
        }));

        surahsCache = result;
        setCache(CACHE_KEYS.SURAHS_META, result).catch(() => {});
        return result;
      } catch (fallbackError) {
        console.error('[QuranService] Both APIs failed for surahs list');
        
        // Return cached version if available
        const cached = await getCached<SurahMeta[]>(CACHE_KEYS.SURAHS_META);
        if (cached?.data) {
          console.warn('[QuranService] Using stale cache for surahs list');
          surahsCache = cached.data;
          return cached.data;
        }
        
        throw new Error(
          `Failed to load surahs list. ` +
          `Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown'}. ` +
          `Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`
        );
      }
    }
  },

  /**
   * Get complete Surah with Arabic, English, Urdu translations and audio
   * Uses stale-while-revalidate pattern for instant loading
   */
  async getSurah(surahNumber: number): Promise<SurahData> {
    // Default Bismillah text — used when API/cache doesn't include it
    const DEFAULT_BISMILLAH = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';

    // Helper to ensure proper numbering AND Bismillah (handles legacy cached data)
    const ensureProperData = (data: SurahData): SurahData => {
      const normalizedAyahs = normalizeAyahNumbering(data.ayahs);
      // Guarantee Bismillah for surahs 2-114 except 9 (At-Tawbah)
      let bismillahText = data.bismillahText;
      if (surahNumber !== 1 && surahNumber !== 9 && !bismillahText) {
        bismillahText = DEFAULT_BISMILLAH;
      }
      // Only create new object if something changed
      if (normalizedAyahs === data.ayahs && bismillahText === data.bismillahText) return data;
      return { ...data, ayahs: normalizedAyahs, bismillahText };
    };
    
    // Return from memory cache immediately (with normalization for legacy data)
    const memoryCached = surahDataCache.get(surahNumber);
    if (memoryCached) {
      return ensureProperData(memoryCached);
    }

    // Check AsyncStorage cache
    const cacheKey = CACHE_KEYS.SURAH_DATA(surahNumber);
    const cached = await getCached<SurahData>(cacheKey);
    
    if (cached?.data) {
      // Normalize cached data (handles legacy cache with wrong numbering / missing Bismillah)
      const normalizedData = ensureProperData(cached.data);
      
      // Store in memory for instant subsequent access
      surahDataCache.set(surahNumber, normalizedData);
      
      // Revalidate in background if stale
      if (isCacheStale(cached.timestamp)) {
        this.fetchAndCacheSurah(surahNumber).catch(() => {});
      }
      
      return normalizedData;
    }
    
    // No cache - fetch with deduplication
    return deduplicateRequest(`surah_${surahNumber}`, () => this.fetchAndCacheSurah(surahNumber));
  },

  /**
   * Fetch surah from API with retries and fallbacks
   */
  async fetchAndCacheSurah(surahNumber: number): Promise<SurahData> {
    try {
      // Try primary API with retry
      const result = await retryWithBackoff(async () => {
        return await this.fetchSurahFromPrimaryAPI(surahNumber);
      }, RETRY_CONFIG.maxAttempts);
      
      // Store in memory cache
      surahDataCache.set(surahNumber, result);
      
      // Persist to AsyncStorage (non-blocking)
      setCache(CACHE_KEYS.SURAH_DATA(surahNumber), result).catch(() => {});
      
      return result;
    } catch (primaryError) {
      console.warn(`[QuranService] Primary API failed for Surah ${surahNumber}, trying fallback...`);
      
      try {
        // Try fallback API
        const result = await retryWithBackoff(async () => {
          return await this.fetchSurahFromFallbackAPI(surahNumber);
        }, 2);
        
        // Store in memory cache
        surahDataCache.set(surahNumber, result);
        
        // Persist to AsyncStorage (non-blocking)
        setCache(CACHE_KEYS.SURAH_DATA(surahNumber), result).catch(() => {});
        
        return result;
      } catch (fallbackError) {
        console.error(`[QuranService] Fallback API also failed for Surah ${surahNumber}`);
        
        // Return cached version if available (with normalization for legacy data)
        const cached = await getCached<SurahData>(
          CACHE_KEYS.SURAH_DATA(surahNumber)
        );
        if (cached?.data) {
          console.warn('[QuranService] Using stale cache for Surah', surahNumber);
          const normalizedAyahs = normalizeAyahNumbering(cached.data.ayahs);
          // Guarantee Bismillah for surahs 2-114 except 9
          let bismillahText = cached.data.bismillahText;
          if (surahNumber !== 1 && surahNumber !== 9 && !bismillahText) {
            bismillahText = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';
          }
          const normalizedData: SurahData = { ...cached.data, ayahs: normalizedAyahs, bismillahText };
          surahDataCache.set(surahNumber, normalizedData);
          return normalizedData;
        }
        
        throw new Error(
          `Failed to load Surah ${surahNumber}. Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown'}. ` +
          `Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`
        );
      }
    }
  },

  /**
   * Fetch from primary API (alquran.cloud)
   * 
   * CRITICAL FIX (v1.4): Audio editions (ar.alafasy) may include Bismillah
   * as a separate ayah entry, while text editions (en.sahih, ur.jalandhry) do NOT.
   * We MUST remove the standalone Bismillah from the Arabic array BEFORE
   * combining with translations by index, otherwise every translation is
   * off by one and the first real ayah appears to be missing.
   */
  async fetchSurahFromPrimaryAPI(surahNumber: number): Promise<SurahData> {
    // Fetch Arabic + English + Urdu in parallel
    const [arabicJson, englishJson, urduJson] = await Promise.allSettled([
      safeFetch(
        `${ALQURAN_BASE}/surah/${surahNumber}/ar.alafasy`,
        `Fetch Arabic Surah ${surahNumber}`,
      ),
      safeFetch(
        `${ALQURAN_BASE}/surah/${surahNumber}/en.sahih`,
        `Fetch English Surah ${surahNumber}`,
      ),
      safeFetch(
        `${ALQURAN_BASE}/surah/${surahNumber}/ur.jalandhry`,
        `Fetch Urdu Surah ${surahNumber}`,
      ),
    ]);

    // Extract resolved values
    const arabicResult = arabicJson.status === 'fulfilled' ? arabicJson.value : null;
    const englishResult = englishJson.status === 'fulfilled' ? englishJson.value : null;
    const urduResult = urduJson.status === 'fulfilled' ? urduJson.value : null;

    // Validate Arabic response (required)
    if (!arabicResult || arabicResult.code !== 200 || !arabicResult.data) {
      throw new Error('Invalid response from primary API');
    }

    const arabicData = arabicResult.data;
    let englishData = (englishResult?.code === 200) ? englishResult.data : null;
    let urduData = (urduResult?.code === 200) ? urduResult.data : null;

    // ─── FALLBACK: If English translation failed, try alternative editions ───
    if (!englishData || !englishData.ayahs || englishData.ayahs.length === 0) {
      try {
        // Try Pickthall edition as fallback
        const fallback = await safeFetch(
          `${ALQURAN_BASE}/surah/${surahNumber}/en.pickthall`,
          `Fetch English fallback Surah ${surahNumber}`,
        );
        if (fallback?.code === 200 && fallback?.data) {
          englishData = fallback.data;
        }
      } catch {
        // Try quran.com API as second fallback
        try {
          const qcRes = await safeFetch(
            `${QURAN_API_V2}/verses/by_chapter/${surahNumber}?language=en&translations=131&fields=text_uthmani&per_page=300`,
            `Fetch English from quran.com Surah ${surahNumber}`,
          );
          if (qcRes?.verses) {
            englishData = {
              ayahs: qcRes.verses.map((v: any) => ({
                text: v.translations?.[0]?.text || '',
                numberInSurah: v.verse_number,
              })),
            };
          }
        } catch {}
      }
    }

    // ─── FALLBACK: If Urdu translation failed, try alternative editions ───
    if (!urduData || !urduData.ayahs || urduData.ayahs.length === 0) {
      try {
        // Try Ahmed Raza Khan edition as fallback
        const fallback = await safeFetch(
          `${ALQURAN_BASE}/surah/${surahNumber}/ur.ahmedali`,
          `Fetch Urdu fallback Surah ${surahNumber}`,
        );
        if (fallback?.code === 200 && fallback?.data) {
          urduData = fallback.data;
        }
      } catch {
        // Try quran.com API as second fallback (Urdu: resource 97)
        try {
          const qcRes = await safeFetch(
            `${QURAN_API_V2}/verses/by_chapter/${surahNumber}?language=ur&translations=97&fields=text_uthmani&per_page=300`,
            `Fetch Urdu from quran.com Surah ${surahNumber}`,
          );
          if (qcRes?.verses) {
            urduData = {
              ayahs: qcRes.verses.map((v: any) => ({
                text: v.translations?.[0]?.text || '',
                numberInSurah: v.verse_number,
              })),
            };
          }
        } catch {}
      }
    }

    const meta: SurahMeta = {
      number: arabicData.number,
      name: arabicData.name,
      englishName: arabicData.englishName,
      englishNameTranslation: arabicData.englishNameTranslation,
      numberOfAyahs: arabicData.numberOfAyahs,
      revelationType: arabicData.revelationType,
    };

    // ─── STEP 0: Capture Bismillah text from raw API BEFORE any filtering ───
    // This preserves the original API text for display in the SurahIntro component.
    const rawArabicAyahs: any[] = arabicData.ayahs || [];
    let bismillahText: string | undefined;
    if (surahNumber !== 9 && rawArabicAyahs.length > 0) {
      const firstRawText = (rawArabicAyahs[0]?.text || '').trim();
      if (isBismillahOnly(firstRawText)) {
        // Standalone Bismillah ayah (audio editions like ar.alafasy)
        bismillahText = firstRawText;
      } else {
        // Bismillah may be prepended to first ayah text — try exact patterns first
        for (const pattern of BISMILLAH_ARABIC_PATTERNS) {
          if (firstRawText.startsWith(pattern)) {
            bismillahText = pattern;
            break;
          }
        }
        // Flexible regex fallback for any diacritical variant
        if (!bismillahText) {
          const flexMatch = matchBismillahFlexible(firstRawText);
          if (flexMatch) bismillahText = flexMatch;
        }
      }
    }

    // ─── STEP 1: Pre-filter standalone Bismillah from all editions BEFORE alignment ───
    // Audio editions (ar.alafasy) may include Bismillah as a separate ayah.
    // For Al-Fatiha, ALL editions (Arabic, English, Urdu) include Bismillah as ayah 1.
    // We filter all arrays so that index-based alignment stays correct.
    const filteredArabicAyahs = preFilterStandaloneBismillah(rawArabicAyahs, surahNumber);

    // Also filter English/Urdu translation arrays if their first ayah is Bismillah.
    // This covers Al-Fatiha where all editions include Bismillah as ayah 1.
    const rawEnglishAyahs: any[] = englishData?.ayahs || [];
    const rawUrduAyahs: any[] = urduData?.ayahs || [];
    const bismillahWasRemoved = filteredArabicAyahs.length < rawArabicAyahs.length;
    const filteredEnglishAyahs = bismillahWasRemoved && rawEnglishAyahs.length > filteredArabicAyahs.length
      ? rawEnglishAyahs.slice(rawEnglishAyahs.length - filteredArabicAyahs.length)
      : rawEnglishAyahs;
    const filteredUrduAyahs = bismillahWasRemoved && rawUrduAyahs.length > filteredArabicAyahs.length
      ? rawUrduAyahs.slice(rawUrduAyahs.length - filteredArabicAyahs.length)
      : rawUrduAyahs;

    // Log alignment info in dev for debugging
    if (__DEV__) {
      const arabicCount = filteredArabicAyahs.length;
      const englishCount = filteredEnglishAyahs.length;
      const urduCount = filteredUrduAyahs.length;
      if (arabicCount !== englishCount || arabicCount !== urduCount) {
        console.warn(
          `[QuranService] Surah ${surahNumber} ayah count mismatch after Bismillah filter: ` +
          `Arabic=${arabicCount}, English=${englishCount}, Urdu=${urduCount}`
        );
      }
    }

    // ─── STEP 2: Build ayahs with index-based translation alignment ───
    // Now that standalone Bismillah is removed from Arabic, indices match:
    //   filteredArabic[0] = Verse 1  ←→  English[0] = Verse 1 translation ✓
    //   filteredArabic[1] = Verse 2  ←→  English[1] = Verse 2 translation ✓
    const ayahs: Ayah[] = filteredArabicAyahs.map((a: any, i: number) => ({
      number: a.number,
      numberInSurah: a.numberInSurah,
      text: a.text,
      translation: stripHtmlFromTranslation(filteredEnglishAyahs[i]?.text || ''),
      urduTranslation: stripHtmlFromTranslation(filteredUrduAyahs[i]?.text || ''),
      audio: a.audio || a.audioSecondary?.[0] || null,
      juz: a.juz,
      page: a.page,
      hizbQuarter: a.hizbQuarter,
    }));

    // ─── STEP 3: Strip Bismillah PREFIX from first ayah text (if prepended) ───
    // Some API responses prepend Bismillah text to the first verse instead of
    // having a separate entry. Since BismillahCard renders it in the UI,
    // we strip the prefix to avoid duplication.
    const cleanedAyahs = stripFirstAyahBismillahPrefix(ayahs, surahNumber);
    
    // ─── STEP 4: Normalize numbering to ensure consistent 1-based indexing ───
    const normalizedAyahs = normalizeAyahNumbering(cleanedAyahs);

    // ─── STEP 5: Guarantee Bismillah text for surahs 2-114 (except 9) ───
    // If the API didn't return Bismillah text, use the standard hardcoded text.
    // Surah Al-Fatiha (1): Bismillah is handled separately (it's part of the verses).
    // Surah At-Tawbah (9): No Bismillah.
    if (surahNumber !== 1 && surahNumber !== 9 && !bismillahText) {
      bismillahText = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';
    }

    return { meta, ayahs: normalizedAyahs, bismillahText };
  },

  /**
   * Fetch from fallback API (quran.com)
   * 
   * quran.com returns translations inline with each verse object,
   * so there is no index alignment issue. We still strip Bismillah
   * prefix and normalize numbering for consistency.
   */
  async fetchSurahFromFallbackAPI(surahNumber: number): Promise<SurahData> {
    const [chapterJson, versesJson] = await Promise.all([
      safeFetch(`${QURANCOM_BASE}/chapters/${surahNumber}?language=en`, 'Fetch chapter from quran.com'),
      safeFetch(
        `${QURANCOM_BASE}/verses/by_chapter/${surahNumber}` +
          `?language=en&translations=131,149` +
          `&fields=text_uthmani,verse_number,juz_number,page_number,hizb_number` +
          `&page=1&per_page=300`,
        'Fetch verses from quran.com',
      ),
    ]);

    if (!chapterJson || !chapterJson.chapter) {
      throw new Error('Invalid response from quran.com');
    }

    const chapter = chapterJson.chapter;
    const meta: SurahMeta = {
      number: chapter.id,
      name: chapter.name_arabic || 'Unknown',
      englishName: chapter.name_simple || 'Unknown',
      englishNameTranslation: chapter.translated_name?.name || 'Unknown',
      numberOfAyahs: chapter.verses_count,
      revelationType: chapter.revelation_place === 'makkah' ? 'Meccan' : 'Medinan',
    };

    // ─── Capture Bismillah text from raw API BEFORE filtering ───
    const rawVerses: any[] = versesJson?.verses || [];
    let bismillahText: string | undefined;
    if (surahNumber !== 9 && rawVerses.length > 0) {
      const firstRawText = (rawVerses[0]?.text_uthmani || rawVerses[0]?.text_imlaei || rawVerses[0]?.text || '').trim();
      if (isBismillahOnly(firstRawText)) {
        bismillahText = firstRawText;
      } else {
        for (const pattern of BISMILLAH_ARABIC_PATTERNS) {
          if (firstRawText.startsWith(pattern)) {
            bismillahText = pattern;
            break;
          }
        }
        if (!bismillahText) {
          const flexMatch = matchBismillahFlexible(firstRawText);
          if (flexMatch) bismillahText = flexMatch;
        }
      }
    }

    // quran.com may also return a standalone Bismillah verse — pre-filter it
    const filteredVerses = preFilterStandaloneBismillah(
      rawVerses.map((v: any) => ({ ...v, text: v.text_uthmani || v.text_imlaei || '' })),
      surahNumber,
    );

    const ayahs: Ayah[] = filteredVerses.map((v: any) => ({
      number: v.id,
      numberInSurah: v.verse_number,
      text: v.text_uthmani || v.text_imlaei || v.text || '',
      translation: stripHtmlFromTranslation(v.translations?.[0]?.text || ''),
      urduTranslation: stripHtmlFromTranslation(v.translations?.[1]?.text || ''),
      audio: v.audio?.url || null,
      juz: v.juz_number || 1,
      page: v.page_number || 1,
      hizbQuarter: v.hizb_number || 1,
    }));

    // Strip Bismillah prefix from first ayah (shown separately via BismillahCard)
    const cleanedAyahs = stripFirstAyahBismillahPrefix(ayahs, surahNumber);
    
    // Normalize numbering to ensure consistent 1-based indexing across all surahs
    const normalizedAyahs = normalizeAyahNumbering(cleanedAyahs);

    // Guarantee Bismillah text for surahs 2-114 (except 9)
    if (surahNumber !== 1 && surahNumber !== 9 && !bismillahText) {
      bismillahText = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';
    }

    return { meta, ayahs: normalizedAyahs, bismillahText };
  },

  /**
   * Prefetch a specific surah in background (for predictive loading)
   */
  prefetchSurah(surahNumber: number): void {
    if (surahDataCache.has(surahNumber)) return;
    
    // Fire and forget - don't await
    this.getSurah(surahNumber).catch(() => {});
  },

  /**
   * Check if surah is cached (for UI indicators)
   */
  isSurahCached(surahNumber: number): boolean {
    return surahDataCache.has(surahNumber);
  },

  /**
   * Get Tafseer for a Surah
   * @deprecated Use TafseerService from '@/lib/tafseerService' instead.
   * Kept for backward compatibility — delegates to TafseerService.
   */
  async getTafseer(surahNumber: number, _language: 'en' | 'ur' = 'en'): Promise<TafseerEntry[]> {
    try {
      // Import dynamically to avoid circular deps
      const TafseerService = (await import('./tafseerService')).default;
      const tafseerId = await TafseerService.getSelectedTafseerId();
      // Assume ~300 ayahs max per surah; service handles actual count
      const map = await TafseerService.getSurahTafseer(tafseerId, surahNumber, 300);
      const entries: TafseerEntry[] = [];
      map.forEach((text: string, ayah: number) => entries.push({ ayah, text, source: 'Tafseer' }));
      return entries;
    } catch {
      return [];
    }
  },

  /**
   * Get a random Ayah with translation - uses retry logic
   */
  async getRandomAyah(): Promise<{ arabic: string; english: string; urdu: string; surah: number; ayah: number; surahName: string }> {
    try {
      return await retryWithBackoff(async () => {
        const randomAyah = Math.floor(Math.random() * 6236) + 1;
        const [ar, en, ur] = await Promise.all([
          safeFetch(`${ALQURAN_BASE}/ayah/${randomAyah}`, `Fetch random ayah ${randomAyah}`),
          safeFetch(`${ALQURAN_BASE}/ayah/${randomAyah}/en.sahih`, `Fetch random ayah translation`),
          safeFetch(`${ALQURAN_BASE}/ayah/${randomAyah}/ur.jalandhry`, `Fetch random ayah Urdu`),
        ]);

        if (!ar || !ar.data) throw new Error('Invalid response');

        return {
          arabic: ar.data.text,
          english: en?.data?.text || '',
          urdu: ur?.data?.text || '',
          surah: ar.data.surah.number,
          ayah: ar.data.numberInSurah,
          surahName: ar.data.surah.englishName,
        };
      }, 2);
    } catch (e) {
      console.warn('[QuranService] Failed to fetch random ayah, using fallback');
      // Fallback
      return {
        arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
        english: 'Verily, in the remembrance of Allah do hearts find rest.',
        urdu: 'سن لو! اللہ کے ذکر سے ہی دلوں کو اطمینان نصیب ہوتا ہے',
        surah: 13,
        ayah: 28,
        surahName: 'Ar-Ra\'d',
      };
    }
  },

  /**
   * Search Quran for keywords with retry
   */
  async searchQuran(query: string, language: string = 'en'): Promise<any[]> {
    try {
      const edition = language === 'ur' ? 'ur.jalandhry' : 'en.sahih';
      return await retryWithBackoff(
        async () => {
          const json = await safeFetch(
            `${ALQURAN_BASE}/search/${encodeURIComponent(query)}/all/${edition}`,
            `Search query: ${query}`,
          );
          if (!json || json.code !== 200) return [];
          return json.data?.matches || [];
        },
        2,
      );
    } catch {
      console.warn('[QuranService] Search failed');
      return [];
    }
  },

  /**
   * Get Juz data with retry
   */
  async getJuz(juzNumber: number): Promise<Ayah[]> {
    try {
      return await retryWithBackoff(
        async () => {
          const json = await safeFetch(
            `${ALQURAN_BASE}/juz/${juzNumber}/ar.alafasy`,
            `Fetch Juz ${juzNumber}`,
          );
          if (!json || json.code !== 200 || !json.data) return [];
          return json.data.ayahs.map((a: any) => ({
            number: a.number,
            numberInSurah: a.numberInSurah,
            text: a.text,
            audio: a.audio,
            juz: a.juz,
            page: a.page,
            hizbQuarter: a.hizbQuarter,
          }));
        },
        2,
      );
    } catch (e) {
      console.warn('[QuranService] Failed to fetch Juz', juzNumber);
      return [];
    }
  },

  /**
   * Clear all caches (memory and AsyncStorage)
   */
  async clearCache(): Promise<void> {
    // Clear memory cache
    surahsCache = null;
    surahDataCache.clear();
    isPrefetched = false;
    prefetchPromise = null;
    
    // Clear AsyncStorage cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const quranKeys = keys.filter(k => k.startsWith('@quran_'));
      if (quranKeys.length > 0) {
        await AsyncStorage.multiRemove(quranKeys);
      }
    } catch (e) {
      console.warn('Failed to clear AsyncStorage cache:', e);
    }
  },

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats(): { memorySurahs: number; hasMetaCache: boolean } {
    return {
      memorySurahs: surahDataCache.size,
      hasMetaCache: surahsCache !== null,
    };
  },
};

export default QuranService;