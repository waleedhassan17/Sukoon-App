/**
 * QuranService - Production-Ready Quran API with Robust Error Handling
 * 
 * Arabic Text: quran.com API v4 (text_uthmani — authentic Uthmani script)
 * Translations: QuranEnc.com (Saudi Government backed — most authentic)
 * Audio: alquran.cloud (ar.alafasy recitation)
 * Fallbacks: fawazahmed0/quran-api → alquran.cloud → local cache
 * 
 * Features:
 * - quran.com text_uthmani for accurate Uthmani Arabic text (correct diacritics)
 * - QuranEnc.com for English (Saheeh International) + Urdu (Junagarhi) translations
 * - alquran.cloud for audio (ar.alafasy) and translation fallback
 * - fawazahmed0/quran-api as Arabic text fallback
 * - Automatic retry with exponential backoff
 * - Request timeouts (15s)
 * - Request deduplication
 * - AsyncStorage persistence for offline support
 * - In-memory caching for instant access
 * - Stale-while-revalidate pattern
 * - Comprehensive error logging
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// fawazahmed0/quran-api — CDN-hosted Arabic Quran text (Quran Academy Uthmani)
const FAWAZ_QURAN_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1';
const FAWAZ_ARABIC_EDITION = 'ara-quranacademy'; // Clean Uthmani script

const QURANENC_BASE = 'https://quranenc.com/api/v1';
const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const QURANCOM_BASE = 'https://api.quran.com/api/v4';
const BACKUP_QURAN_BASE = 'https://quran-api.com/api/v2';

// QuranEnc translation keys (Saudi Government — most authentic)
const QURANENC_ENGLISH_KEY = 'english_saheeh'; // Saheeh International
const QURANENC_URDU_KEY = 'urdu_junagarhi';   // Muhammad Junagarhi

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
// v2.0: Switched primary API to QuranEnc.com (Saudi Government backed, most authentic)
// v2.1: Arabic text from fawazahmed0/quran-api (Quran Academy Uthmani), translations from QuranEnc
// v2.2: Cache bust — force re-fetch to fix stale text (e.g. Surah 21 ayah 2 rendering)
// v3.0: Switched primary Arabic text to quran.com text_uthmani (correct diacritics, matches Mushaf)
// v3.1: Al-Fatiha Bismillah shown via card, numbered ayahs start from Al-Hamdulillah
// v3.2: Fixed audio mapping — use numberInSurah for audioMap keys (fixes Al-Fatiha off-by-one)
// v3.4: Expanded cleanUthmaniText to strip U+06E1 (dotless head of khah), tajweed marks U+0615-U+061A,
// stop signs U+06D6-U+06DC, and extended annotation marks U+08D4-U+08E1 — fixes white spots in Arabic text
const CACHE_VERSION = '3.4';

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
  /** Bismillah audio URL — separate recitation of Bismillah before first ayah (Al-Fatiha only) */
  bismillahAudio?: string;
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
 * Clean Uthmani text for display by:
 * 1. Stripping Quranic annotation marks that render as visible white/green dots:
 *    - U+0615-U+061A — Tajweed marks (small high tah, small high ligature, etc.)
 *    - U+06D6-U+06DC — Quranic stop signs (small high sad, small high ain, etc.)
 *    - U+06DF (۟) ARABIC SMALL HIGH ROUNDED ZERO — round green/white dots
 *    - U+06E0 (۠) ARABIC SMALL HIGH UPRIGHT RECTANGULAR ZERO — small rectangles
 *    - U+06E1 (ۡ) ARABIC SMALL HIGH DOTLESS HEAD OF KHAH — white spots!
 *    - U+06E2 (ۢ) ARABIC SMALL HIGH MEEM ISOLATED FORM
 *    - U+06E3 (ۣ) ARABIC SMALL LOW SEEN
 *    - U+06E4 (ۤ) ARABIC SMALL HIGH MADDA
 *    - U+06E5 (ۥ) ARABIC SMALL HIGH YEH
 *    - U+06E6 (ۦ) ARABIC SMALL HIGH NOON
 *    - U+06E7 (ۧ) ARABIC SMALL HIGH UTURN
 *    - U+06E8 (ۨ) ARABIC SMALL HIGH DOTTED NOON PLACEHOLDER
 *    - U+06EA (۪) ARABIC EMPTY CENTRE LOW STOP
 *    - U+06EB (۫) ARABIC EMPTY CENTRE HIGH STOP
 *    - U+06EC (۬) ARABIC ROUNDED HIGH STOP WITH FILLED CENTRE
 *    - U+06ED (ۭ) ARABIC SMALL LOW MEEM
 *    - U+08D4-U+08E1 — Extended Arabic supplement annotation marks
 * 2. KEEP normal diacritics: fatha (َ), kasra (ِ), damma (ُ), sukun (ْ), shadda (ّ), etc.
 * 3. Converting Arabic Presentation Forms (U+FB50-U+FDFF) to standard Arabic
 * 4. Normalizing Unicode NFC for consistent rendering
 */
function cleanUthmaniText(text: string): string {
  if (!text) return '';

  // Strip ALL unusual annotation marks that cause visible white/green dots
  // Includes U+06E1 (the main culprit for white spots) and tajweed marks
  // KEEP normal tashkeel: U+064B-U+065F (fatha, kasra, damma, shadda, sukun, etc.)
  let cleaned = text.replace(/[\u0615-\u061A\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1]/g, '');

  // Normalize to NFC
  cleaned = cleaned.normalize('NFC');

  // Convert Arabic Presentation Forms to standard Arabic for proper joining
  const presentationToStandard: Record<string, string> = {
    // Arabic Presentation Forms-A mappings
    '\uFB50': '\u0671', '\uFB51': '\u0671', // ٱ
    '\uFB52': '\u067B', '\uFB53': '\u067B', '\uFB54': '\u067B', '\uFB55': '\u067B', // ٻ
    '\uFB56': '\u067E', '\uFB57': '\u067E', '\uFB58': '\u067E', '\uFB59': '\u067E', // پ
    '\uFB5A': '\u0680', '\uFB5B': '\u0680', '\uFB5C': '\u0680', '\uFB5D': '\u0680', // ڀ
    '\uFB5E': '\u067A', '\uFB5F': '\u067A', '\uFB60': '\u067A', '\uFB61': '\u067A', // ښ
    '\uFB62': '\u067F', '\uFB63': '\u067F', '\uFB64': '\u067F', '\uFB65': '\u067F', // ڟ
    '\uFB66': '\u0679', '\uFB67': '\u0679', '\uFB68': '\u0679', '\uFB69': '\u0679', // ٹ
    '\uFB6A': '\u0684', '\uFB6B': '\u0684', '\uFB6C': '\u0684', '\uFB6D': '\u0684', // ڤ
    '\uFB6E': '\u0683', '\uFB6F': '\u0683', '\uFB70': '\u0683', '\uFB71': '\u0683', // ڣ
    '\uFB72': '\u0687', '\uFB73': '\u0687', '\uFB74': '\u0687', '\uFB75': '\u0687', // ڧ
    '\uFB76': '\u068C', '\uFB77': '\u068C', '\uFB78': '\u068C', '\uFB79': '\u068C', // ڬ
    '\uFB7A': '\u068E', '\uFB7B': '\u068E', '\uFB7C': '\u068E', '\uFB7D': '\u068E', // ڮ
    '\uFB7E': '\u068D', '\uFB7F': '\u068D', '\uFB80': '\u068D', '\uFB81': '\u068D', // ڭ
    '\uFB82': '\u068F', '\uFB83': '\u068F', // گ
    '\uFB84': '\u0691', '\uFB85': '\u0691', // ڱ
    '\uFB86': '\u06A9', '\uFB87': '\u06A9', // ک
    '\uFB88': '\u06AF', '\uFB89': '\u06AF', // گ
    '\uFB8A': '\u06B3', '\uFB8B': '\u06B3', // ڳ
    '\uFB8C': '\u06B1', '\uFB8D': '\u06B1', // ڱ
    '\uFB8E': '\u06BA', '\uFB8F': '\u06BA', '\uFB90': '\u06BA', '\uFB91': '\u06BA', // ں
    '\uFB92': '\u06BB', '\uFB93': '\u06BB', '\uFB94': '\u06BB', '\uFB95': '\u06BB', // ڻ
    '\uFB96': '\u06C0', '\uFB97': '\u06C0', '\uFB98': '\u06C0', '\uFB99': '\u06C0', // ۀ
    '\uFB9A': '\u06C1', '\uFB9B': '\u06C1', '\uFB9C': '\u06C1', '\uFB9D': '\u06C1', // ہ
    '\uFB9E': '\u06C2', '\uFB9F': '\u06C2', // ۂ
    '\uFBA0': '\u06C3', '\uFBA1': '\u06C3', // ع
    '\uFBA2': '\u06C5', '\uFBA3': '\u06C5', // ۆ
    '\uFBA4': '\u06C6', '\uFBA5': '\u06C6', // ۇ
    '\uFBA6': '\u06C7', '\uFBA7': '\u06C7', // ۈ
    '\uFBA8': '\u06C8', '\uFBA9': '\u06C8', // ۉ
    '\uFBAA': '\u06C9', '\uFBAB': '\u06C9', // ۊ
    '\uFBAC': '\u06CA', '\uFBAD': '\u06CA', // ۋ
    '\uFBAE': '\u06CB', '\uFBAF': '\u06CB', // ی
    '\uFBB0': '\u06CC', '\uFBB1': '\u06CC', // ی
  };

  // Convert Presentation Forms-A
  for (const [pres, standard] of Object.entries(presentationToStandard)) {
    cleaned = cleaned.split(pres).join(standard);
  }

  return cleaned.trim();
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

/**
 * Normalizes Arabic text by removing tashkeel/diacritics for search matching
 * Keeps the base letters for comparison
 */
function normalizeArabicForSearch(text: string): string {
  if (!text) return '';
  // Remove Arabic diacritics (harakat/tashkeel) for flexible matching
  // U+064B-U+065F, U+0670, U+06EA-U+06ED
  return text.replace(/[\u064B-\u065F\u0670\u06EA-\u06ED]/g, '').trim();
}

/**
 * Calculates search relevance score for a surah
 * Higher score = better match
 */
function calculateSurahScore(surah: SurahMeta, query: string): number {
  const lowerQuery = query.toLowerCase().trim();
  const normalizedQuery = normalizeArabicForSearch(lowerQuery);
  
  // Strip "Al-" prefix variations for English name matching
  const englishNameLower = surah.englishName.toLowerCase();
  const englishNameWithoutPrefix = englishNameLower.replace(/^(al-|el-|al\s)/, '');
  const normalizedArabic = normalizeArabicForSearch(surah.name);
  
  let score = 0;
  
  // Exact number match (highest priority)
  if (String(surah.number) === lowerQuery) {
    return 1000;
  }
  
  // Number starts with query (e.g., "1" matches "10", "11", etc.)
  if (String(surah.number).startsWith(lowerQuery)) {
    score += 500;
  }
  
  // Exact English name match
  if (englishNameLower === lowerQuery) {
    score += 900;
  }
  
  // English name starts with query
  if (englishNameLower.startsWith(lowerQuery)) {
    score += 400;
  }
  
  // English name contains query
  if (englishNameLower.includes(lowerQuery)) {
    score += 300;
  }
  
  // Name without "Al-" prefix starts with query (e.g., "baq" matches "Al-Baqarah")
  if (englishNameWithoutPrefix.startsWith(lowerQuery)) {
    score += 350;
  }
  
  // Name without "Al-" prefix contains query
  if (englishNameWithoutPrefix.includes(lowerQuery)) {
    score += 250;
  }
  
  // Arabic exact match (normalized)
  if (normalizedArabic === normalizedQuery) {
    score += 900;
  }
  
  // Arabic starts with query (normalized)
  if (normalizedArabic.startsWith(normalizedQuery)) {
    score += 400;
  }
  
  // Arabic contains query (normalized)
  if (normalizedArabic.includes(normalizedQuery)) {
    score += 300;
  }
  
  // Translation contains query
  const translationLower = surah.englishNameTranslation.toLowerCase();
  if (translationLower.includes(lowerQuery)) {
    score += 200;
  }
  
  // Partial matching for multi-word queries
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length > 1) {
    const matches = queryWords.filter(word => 
      englishNameLower.includes(word) || 
      englishNameWithoutPrefix.includes(word) ||
      translationLower.includes(word)
    ).length;
    score += matches * 50;
  }
  
  return score;
}

/**
 * Fuzzy search surahs by name, number, or Arabic text
 * Returns filtered and scored results sorted by relevance
 * 
 * Features:
 * - Number search (exact or prefix)
 * - English name with "Al-" prefix handling
 * - Arabic name with diacritic-insensitive matching
 * - Translation/translation search
 * - Multi-word query support
 * - Relevance scoring and sorting
 */
export function searchSurahs(surahs: SurahMeta[], query: string): SurahMeta[] {
  if (!query || query.trim().length === 0) {
    return surahs;
  }
  
  const trimmedQuery = query.trim();
  
  // Score all surahs and filter for matches
  const scored = surahs.map(surah => ({
    surah,
    score: calculateSurahScore(surah, trimmedQuery),
  }));
  
  // Filter to only include matches (score > 0)
  const matches = scored.filter(item => item.score > 0);
  
  // Sort by score descending (highest first)
  matches.sort((a, b) => b.score - a.score);
  
  return matches.map(item => item.surah);
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
        console.log(`[QuranService] 🗑️ Cache version mismatch (${version} → ${CACHE_VERSION}). Purging old cache...`);
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
      // Guarantee Bismillah for all surahs except At-Tawbah (9)
      let bismillahText = data.bismillahText;
      if (surahNumber !== 9 && !bismillahText) {
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
          // Guarantee Bismillah for all surahs except At-Tawbah (9)
          let bismillahText = cached.data.bismillahText;
          if (surahNumber !== 9 && !bismillahText) {
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
   * Fetch from primary APIs:
   *   - Arabic text: quran.com API v4 (text_uthmani — accurate Uthmani script with correct diacritics)
   *   - Translations: QuranEnc.com (Saudi Government backed — most authentic)
   *   - Audio: alquran.cloud (ar.alafasy recitation)
   *
   * quran.com response: { verses: [{ id, verse_key, text_uthmani }] }
   *   - Clean verse_key format (e.g. "21:2"), no extra Bismillah entry
   *   - Bismillah is verse 1 in Al-Fatiha, no Bismillah in At-Tawbah
   *
   * QuranEnc response: { result: [{ id, sura, aya, arabic_text, translation, footnotes }] }
   *   - Footnotes in [N] format — stripped for clean display
   */
  async fetchSurahFromPrimaryAPI(surahNumber: number): Promise<SurahData> {
    // Fetch Arabic text, English + Urdu translations, and audio in parallel
    console.log(`[QuranService] 🕌 Fetching Surah ${surahNumber} from APIs (quran.com Arabic + QuranEnc translations + alquran.cloud audio)`);
    const [arabicJson, englishJson, urduJson, audioJson] = await Promise.allSettled([
      safeFetch(
        `${QURANCOM_BASE}/quran/verses/uthmani?chapter_number=${surahNumber}`,
        `Fetch Arabic (quran.com text_uthmani) Surah ${surahNumber}`,
      ),
      safeFetch(
        `${QURANENC_BASE}/translation/sura/${QURANENC_ENGLISH_KEY}/${surahNumber}`,
        `Fetch QuranEnc English Surah ${surahNumber}`,
      ),
      safeFetch(
        `${QURANENC_BASE}/translation/sura/${QURANENC_URDU_KEY}/${surahNumber}`,
        `Fetch QuranEnc Urdu Surah ${surahNumber}`,
      ),
      safeFetch(
        `${ALQURAN_BASE}/surah/${surahNumber}/ar.alafasy`,
        `Fetch audio Surah ${surahNumber}`,
      ),
    ]);

    // Extract resolved values
    const arabicResult = arabicJson.status === 'fulfilled' ? arabicJson.value : null;
    const englishResult = englishJson.status === 'fulfilled' ? englishJson.value : null;
    const urduResult = urduJson.status === 'fulfilled' ? urduJson.value : null;
    const audioResult = audioJson.status === 'fulfilled' ? audioJson.value : null;

    // quran.com returns { verses: [{ id, verse_key, text_uthmani }] }
    // Convert to common format: { verse: N, text: "..." }
    let arabicAyahs: any[] = [];
    if (arabicResult?.verses && arabicResult.verses.length > 0) {
      arabicAyahs = arabicResult.verses.map((v: any) => {
        // verse_key is "21:2" — extract the ayah number after colon
        const verseNum = parseInt((v.verse_key || '').split(':')[1], 10) || 0;
        return { verse: verseNum, text: v.text_uthmani || '' };
      });
    }
    // QuranEnc returns { result: [...] }
    const englishAyahs: any[] = englishResult?.result || [];
    const urduAyahs: any[] = urduResult?.result || [];

    // We need Arabic text at minimum
    if (arabicAyahs.length === 0) {
      console.warn(`[QuranService] quran.com Arabic failed for Surah ${surahNumber}, trying fawazahmed0 fallback...`);
      // Fallback 1: fawazahmed0/quran-api
      try {
        const fawazResult = await safeFetch(
          `${FAWAZ_QURAN_BASE}/editions/${FAWAZ_ARABIC_EDITION}/${surahNumber}.json`,
          `Fetch Arabic (fawazahmed0 fallback) Surah ${surahNumber}`,
        );
        if (fawazResult?.chapter && fawazResult.chapter.length > 0) {
          arabicAyahs = fawazResult.chapter;
        }
      } catch {}
      // Fallback 2: QuranEnc arabic_text field
      if (arabicAyahs.length === 0) {
        const fallbackAyahs = englishAyahs.length > 0 ? englishAyahs : urduAyahs;
        if (fallbackAyahs.length === 0) {
          throw new Error('All primary APIs returned no data for Surah ' + surahNumber);
        }
        arabicAyahs.push(...fallbackAyahs.map((a: any) => ({
          verse: parseInt(a.aya, 10),
          text: a.arabic_text || '',
        })));
      }
    }

    // Build audio URL map from alquran.cloud (keyed by actual ayah numberInSurah)
    // NOTE: Do NOT filter Bismillah from audio — every surah must start with Bismillah recitation.
    // For Al-Fatiha, the Bismillah audio is stored separately as bismillahAudio.
    const audioMap = new Map<number, string>();
    let bismillahAudio: string | undefined;
    if (audioResult?.code === 200 && audioResult?.data?.ayahs) {
      const rawAudioAyahs = audioResult.data.ayahs || [];
      rawAudioAyahs.forEach((a: any) => {
        const key = a.numberInSurah ?? 0;
        audioMap.set(key, a.audio || a.audioSecondary?.[0] || '');
      });
      // Capture standalone Bismillah audio (Al-Fatiha verse 1 is Bismillah-only)
      // For other surahs, Bismillah is already embedded in first ayah's audio
      if (surahNumber !== 9 && rawAudioAyahs.length > 0) {
        const firstAudioText = (rawAudioAyahs[0]?.text || '').trim();
        if (isBismillahOnly(firstAudioText)) {
          bismillahAudio = rawAudioAyahs[0]?.audio || rawAudioAyahs[0]?.audioSecondary?.[0] || undefined;
        }
      }
    }

    // ─── FALLBACK: If English failed, try alquran.cloud as fallback ───
    let englishFallbackMap: Map<number, string> | null = null;
    if (englishAyahs.length === 0) {
      try {
        const fallback = await safeFetch(
          `${ALQURAN_BASE}/surah/${surahNumber}/en.sahih`,
          `Fetch English fallback from alquran.cloud Surah ${surahNumber}`,
        );
        if (fallback?.code === 200 && fallback?.data?.ayahs) {
          englishFallbackMap = new Map();
          const filtered = preFilterStandaloneBismillah(fallback.data.ayahs, surahNumber);
          filtered.forEach((a: any, i: number) => {
            englishFallbackMap!.set(i + 1, stripHtmlFromTranslation(a.text || ''));
          });
        }
      } catch {}
    }

    // ─── FALLBACK: If Urdu failed, try alquran.cloud as fallback ───
    let urduFallbackMap: Map<number, string> | null = null;
    if (urduAyahs.length === 0) {
      try {
        const fallback = await safeFetch(
          `${ALQURAN_BASE}/surah/${surahNumber}/ur.jalandhry`,
          `Fetch Urdu fallback from alquran.cloud Surah ${surahNumber}`,
        );
        if (fallback?.code === 200 && fallback?.data?.ayahs) {
          urduFallbackMap = new Map();
          const filtered = preFilterStandaloneBismillah(fallback.data.ayahs, surahNumber);
          filtered.forEach((a: any, i: number) => {
            urduFallbackMap!.set(i + 1, stripHtmlFromTranslation(a.text || ''));
          });
        }
      } catch {}
    }

    // Build surah metadata from alquran.cloud if available, else from cache
    let meta: SurahMeta;
    if (audioResult?.code === 200 && audioResult?.data) {
      const d = audioResult.data;
      meta = {
        number: d.number,
        name: d.name,
        englishName: d.englishName,
        englishNameTranslation: d.englishNameTranslation,
        numberOfAyahs: d.numberOfAyahs,
        revelationType: d.revelationType,
      };
    } else {
      // Derive from surahs cache
      const cachedMeta = surahsCache?.find(s => s.number === surahNumber);
      meta = {
        number: surahNumber,
        name: cachedMeta?.name || '',
        englishName: cachedMeta?.englishName || '',
        englishNameTranslation: cachedMeta?.englishNameTranslation || '',
        numberOfAyahs: arabicAyahs.length,
        revelationType: cachedMeta?.revelationType || '',
      };
    }

    // ─── STEP 0: Capture Bismillah text from Arabic text ───
    // Al-Fatiha (1): Bismillah IS verse 1 — extract it for the card, then remove from ayah list
    // At-Tawbah (9): No Bismillah at all
    let bismillahText: string | undefined;
    if (surahNumber !== 9 && arabicAyahs.length > 0) {
      const firstRawText = (arabicAyahs[0]?.text || '').trim();
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

    // ─── Al-Fatiha special handling: verse 1 IS Bismillah ───
    // Remove it from the ayah list so numbered verses start from الحمد لله رب العالمين
    // The Bismillah is already captured above for the BismillahCard header.
    if (surahNumber === 1 && arabicAyahs.length > 0 && isBismillahOnly((arabicAyahs[0]?.text || '').trim())) {
      arabicAyahs.splice(0, 1);
      if (englishAyahs.length > 0) englishAyahs.splice(0, 1);
      if (urduAyahs.length > 0) urduAyahs.splice(0, 1);
    }

    // ─── STEP 1: Build ayahs by combining Arabic text + translations ───
    // quran.com text_uthmani uses clean 1-based verse numbering with no extra Bismillah entry.
    // QuranEnc also uses 1-based aya numbering — indices align directly.
    const ayahs: Ayah[] = arabicAyahs.map((arabicItem: any, i: number) => {
      const ayaNum = arabicItem.verse || (i + 1);
      // Get English translation from QuranEnc
      let englishTranslation = '';
      if (englishAyahs.length > 0 && englishAyahs[i]) {
        englishTranslation = stripHtmlFromTranslation(
          (englishAyahs[i].translation || '').replace(/\[\d+\]/g, '').trim()
        );
      } else if (englishFallbackMap) {
        englishTranslation = englishFallbackMap.get(ayaNum) || '';
      }
      // Get Urdu translation from QuranEnc
      let urduTranslation = '';
      if (urduAyahs.length > 0 && urduAyahs[i]) {
        urduTranslation = stripHtmlFromTranslation(
          (urduAyahs[i].translation || '').replace(/\[\d+\]/g, '').trim()
        );
      } else if (urduFallbackMap) {
        urduTranslation = urduFallbackMap.get(ayaNum) || '';
      }

      return {
        number: i + 1,
        numberInSurah: ayaNum,
        text: cleanUthmaniText(arabicItem.text || ''),
        translation: englishTranslation,
        urduTranslation: urduTranslation,
        audio: audioMap.get(ayaNum) || undefined,
        juz: 1,   // quran.com text_uthmani endpoint doesn't provide juz/page — filled from cache or defaults
        page: 1,
        hizbQuarter: 1,
      };
    });

    // ─── STEP 2: Strip Bismillah PREFIX from first ayah text (if prepended) ───
    const cleanedAyahs = stripFirstAyahBismillahPrefix(ayahs, surahNumber);

    // ─── STEP 3: Normalize numbering to ensure consistent 1-based indexing ───
    const normalizedAyahs = normalizeAyahNumbering(cleanedAyahs);

    // ─── STEP 4: Guarantee Bismillah text for all surahs except At-Tawbah (9) ───
    if (surahNumber !== 9 && !bismillahText) {
      bismillahText = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';
    }

    return { meta, ayahs: normalizedAyahs, bismillahText, bismillahAudio };
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
    // Al-Fatiha (1): Bismillah IS verse 1 — extract for card, filter from ayah list
    // At-Tawbah (9): No Bismillah at all
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
      text: cleanUthmaniText(v.text_uthmani || v.text_imlaei || v.text || ''),
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

    // Guarantee Bismillah text for all surahs except At-Tawbah (9)
    if (surahNumber !== 9 && !bismillahText) {
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
        // Pick a random surah and ayah
        const surahsMetaList = surahsCache || await this.getAllSurahs();
        const randomSurah = surahsMetaList[Math.floor(Math.random() * surahsMetaList.length)];
        const randomAyaNum = Math.floor(Math.random() * randomSurah.numberOfAyahs) + 1;

        // Fetch Arabic from fawazahmed0 + translations from QuranEnc in parallel
        const [arabicRes, enRes, urRes] = await Promise.all([
          safeFetch(
            `${FAWAZ_QURAN_BASE}/editions/${FAWAZ_ARABIC_EDITION}/${randomSurah.number}/${randomAyaNum}.json`,
            `Fetch random ayah Arabic`,
          ),
          safeFetch(
            `${QURANENC_BASE}/translation/aya/${QURANENC_ENGLISH_KEY}/${randomSurah.number}/${randomAyaNum}`,
            `Fetch random ayah EN`,
          ),
          safeFetch(
            `${QURANENC_BASE}/translation/aya/${QURANENC_URDU_KEY}/${randomSurah.number}/${randomAyaNum}`,
            `Fetch random ayah UR`,
          ),
        ]);

        const enData = enRes?.result;
        const urData = urRes?.result;
        const arabicText = arabicRes?.text || enData?.arabic_text || urData?.arabic_text || '';

        if (!arabicText && !enData && !urData) throw new Error('All APIs returned no data');

        return {
          arabic: cleanUthmaniText(arabicText),
          english: stripHtmlFromTranslation((enData?.translation || '').replace(/\[\d+\]/g, '').trim()),
          urdu: stripHtmlFromTranslation((urData?.translation || '').replace(/\[\d+\]/g, '').trim()),
          surah: randomSurah.number,
          ayah: randomAyaNum,
          surahName: randomSurah.englishName,
        };
      }, 2);
    } catch (e) {
      console.warn('[QuranService] QuranEnc random ayah failed, trying alquran.cloud...');
      // Fallback to alquran.cloud
      try {
        const randomAyah = Math.floor(Math.random() * 6236) + 1;
        const [ar, en, ur] = await Promise.all([
          safeFetch(`${ALQURAN_BASE}/ayah/${randomAyah}`, `Fetch random ayah ${randomAyah}`),
          safeFetch(`${ALQURAN_BASE}/ayah/${randomAyah}/en.sahih`, `Fetch random ayah translation`),
          safeFetch(`${ALQURAN_BASE}/ayah/${randomAyah}/ur.jalandhry`, `Fetch random ayah Urdu`),
        ]);
        if (!ar || !ar.data) throw new Error('Invalid response');
        return {
          arabic: cleanUthmaniText(ar.data.text || ''),
          english: en?.data?.text || '',
          urdu: ur?.data?.text || '',
          surah: ar.data.surah.number,
          ayah: ar.data.numberInSurah,
          surahName: ar.data.surah.englishName,
        };
      } catch {
        // Hardcoded fallback
        return {
          arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
          english: 'Verily, in the remembrance of Allah do hearts find rest.',
          urdu: 'سن لو! اللہ کے ذکر سے ہی دلوں کو اطمینان نصیب ہوتا ہے',
          surah: 13,
          ayah: 28,
          surahName: 'Ar-Ra\'d',
        };
      }
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