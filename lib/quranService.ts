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
const CACHE_VERSION = '1.0';

// Cache TTL (24 hours - but we use stale-while-revalidate)
const CACHE_TTL = 24 * 60 * 60 * 1000;

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

export interface TafseerEntry {
  ayah: number;
  text: string;
  source: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for instant access
let surahsCache: SurahMeta[] | null = null;
const surahDataCache: Map<number, { meta: SurahMeta; ayahs: Ayah[] }> = new Map();

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
  async getSurah(surahNumber: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
    // Return from memory cache immediately
    const memoryCached = surahDataCache.get(surahNumber);
    if (memoryCached) return memoryCached;

    // Check AsyncStorage cache
    const cacheKey = CACHE_KEYS.SURAH_DATA(surahNumber);
    const cached = await getCached<{ meta: SurahMeta; ayahs: Ayah[] }>(cacheKey);
    
    if (cached?.data) {
      // Store in memory for instant subsequent access
      surahDataCache.set(surahNumber, cached.data);
      
      // Revalidate in background if stale
      if (isCacheStale(cached.timestamp)) {
        this.fetchAndCacheSurah(surahNumber).catch(() => {});
      }
      
      return cached.data;
    }
    
    // No cache - fetch with deduplication
    return deduplicateRequest(`surah_${surahNumber}`, () => this.fetchAndCacheSurah(surahNumber));
  },

  /**
   * Fetch surah from API with retries and fallbacks
   */
  async fetchAndCacheSurah(surahNumber: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
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
        
        // Return cached version if available
        const cached = await getCached<{ meta: SurahMeta; ayahs: Ayah[] }>(
          CACHE_KEYS.SURAH_DATA(surahNumber)
        );
        if (cached?.data) {
          console.warn('[QuranService] Using stale cache for Surah', surahNumber);
          surahDataCache.set(surahNumber, cached.data);
          return cached.data;
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
   */
  async fetchSurahFromPrimaryAPI(surahNumber: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
    const [arabicJson, englishJson, urduJson] = await Promise.all([
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

    // Validate responses
    if (!arabicJson || arabicJson.code !== 200 || !arabicJson.data) {
      throw new Error('Invalid response from primary API');
    }

    const arabicData = arabicJson.data;
    const englishData = englishJson?.data;
    const urduData = urduJson?.data;

    const meta: SurahMeta = {
      number: arabicData.number,
      name: arabicData.name,
      englishName: arabicData.englishName,
      englishNameTranslation: arabicData.englishNameTranslation,
      numberOfAyahs: arabicData.numberOfAyahs,
      revelationType: arabicData.revelationType,
    };

    const ayahs: Ayah[] = arabicData.ayahs.map((a: any, i: number) => ({
      number: a.number,
      numberInSurah: a.numberInSurah,
      text: a.text,
      translation: englishData?.ayahs?.[i]?.text || '',
      urduTranslation: urduData?.ayahs?.[i]?.text || '',
      audio: a.audio || a.audioSecondary?.[0] || null,
      juz: a.juz,
      page: a.page,
      hizbQuarter: a.hizbQuarter,
    }));

    return { meta, ayahs };
  },

  /**
   * Fetch from fallback API (quran.com)
   */
  async fetchSurahFromFallbackAPI(surahNumber: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
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

    const ayahs: Ayah[] = (versesJson?.verses || []).map((v: any) => ({
      number: v.id,
      numberInSurah: v.verse_number,
      text: v.text_uthmani || v.text_imlaei || '',
      translation: v.translations?.[0]?.text || '',
      urduTranslation: v.translations?.[1]?.text || '',
      audio: v.audio?.url || null,
      juz: v.juz_number || 1,
      page: v.page_number || 1,
      hizbQuarter: v.hizb_number || 1,
    }));

    return { meta, ayahs };
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
   * Get Tafseer for a Surah (using alquran.cloud tafseer edition)
   */
  async getTafseer(surahNumber: number, language: 'en' | 'ur' = 'en'): Promise<TafseerEntry[]> {
    const edition = language === 'en' ? 'en.maududi' : 'ur.maududi';
    try {
      const res = await fetch(`${ALQURAN_BASE}/surah/${surahNumber}/${edition}`);
      const json = await res.json();
      if (json.code === 200) {
        return json.data.ayahs.map((a: any) => ({
          ayah: a.numberInSurah,
          text: a.text,
          source: 'Maududi',
        }));
      }
      return [];
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
