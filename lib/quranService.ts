/**
 * QuranService - Optimized Quran API with intelligent caching
 * 
 * Performance optimizations:
 * - AsyncStorage persistence for offline-first experience
 * - In-memory cache for instant access
 * - Stale-while-revalidate pattern
 * - Prefetch support for app startup
 * - Non-blocking architecture
 * - Request deduplication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const QURANCOM_BASE = 'https://api.quran.com/api/v4';

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
   * Fetch surahs from API and cache
   */
  async fetchAndCacheSurahs(): Promise<SurahMeta[]> {
    try {
      const res = await fetch(`${ALQURAN_BASE}/surah`);
      const json = await res.json();
      
      if (json.code === 200 && json.data) {
        surahsCache = json.data.map((s: any) => ({
          number: s.number,
          name: s.name,
          englishName: s.englishName,
          englishNameTranslation: s.englishNameTranslation,
          numberOfAyahs: s.numberOfAyahs,
          revelationType: s.revelationType,
        }));
        // Persist to AsyncStorage (non-blocking)
        setCache(CACHE_KEYS.SURAHS_META, surahsCache).catch(() => {});
        return surahsCache!;
      }
      throw new Error('API error');
    } catch (e) {
      // Fallback to quran.com
      const res = await fetch(`${QURANCOM_BASE}/chapters?language=en`);
      const json = await res.json();
      surahsCache = json.chapters.map((s: any) => ({
        number: s.id,
        name: s.name_arabic,
        englishName: s.name_simple,
        englishNameTranslation: s.translated_name.name,
        numberOfAyahs: s.verses_count,
        revelationType: s.revelation_place,
      }));
      // Persist to AsyncStorage (non-blocking)
      setCache(CACHE_KEYS.SURAHS_META, surahsCache).catch(() => {});
      return surahsCache!;
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
   * Fetch surah from API and cache
   */
  async fetchAndCacheSurah(surahNumber: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
    try {
      // Fetch Arabic + English + Urdu in parallel for maximum speed
      const [arabicRes, englishRes, urduRes] = await Promise.all([
        fetch(`${ALQURAN_BASE}/surah/${surahNumber}/ar.alafasy`),
        fetch(`${ALQURAN_BASE}/surah/${surahNumber}/en.sahih`),
        fetch(`${ALQURAN_BASE}/surah/${surahNumber}/ur.jalandhry`),
      ]);

      const [arabicJson, englishJson, urduJson] = await Promise.all([
        arabicRes.json(),
        englishRes.json(),
        urduRes.json(),
      ]);

      if (arabicJson.code !== 200) throw new Error('Failed to load surah');

      const arabicData = arabicJson.data;
      const englishData = englishJson.data;
      const urduData = urduJson.data;

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

      const result = { meta, ayahs };
      
      // Store in memory cache
      surahDataCache.set(surahNumber, result);
      
      // Persist to AsyncStorage (non-blocking)
      setCache(CACHE_KEYS.SURAH_DATA(surahNumber), result).catch(() => {});
      
      return result;
    } catch (e) {
      console.error('Error loading surah:', e);
      throw e;
    }
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
   * Get a random Ayah with translation
   */
  async getRandomAyah(): Promise<{ arabic: string; english: string; urdu: string; surah: number; ayah: number; surahName: string }> {
    try {
      const randomAyah = Math.floor(Math.random() * 6236) + 1;
      const [arRes, enRes, urRes] = await Promise.all([
        fetch(`${ALQURAN_BASE}/ayah/${randomAyah}`),
        fetch(`${ALQURAN_BASE}/ayah/${randomAyah}/en.sahih`),
        fetch(`${ALQURAN_BASE}/ayah/${randomAyah}/ur.jalandhry`),
      ]);
      const [ar, en, ur] = await Promise.all([arRes.json(), enRes.json(), urRes.json()]);
      return {
        arabic: ar.data.text,
        english: en.data.text,
        urdu: ur.data.text,
        surah: ar.data.surah.number,
        ayah: ar.data.numberInSurah,
        surahName: ar.data.surah.englishName,
      };
    } catch (e) {
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
   * Search Quran for keywords
   */
  async searchQuran(query: string, language: string = 'en'): Promise<any[]> {
    try {
      const edition = language === 'ur' ? 'ur.jalandhry' : 'en.sahih';
      const res = await fetch(`${ALQURAN_BASE}/search/${encodeURIComponent(query)}/all/${edition}`);
      const json = await res.json();
      if (json.code === 200) return json.data.matches || [];
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Get Juz data
   */
  async getJuz(juzNumber: number): Promise<Ayah[]> {
    try {
      const res = await fetch(`${ALQURAN_BASE}/juz/${juzNumber}/ar.alafasy`);
      const json = await res.json();
      if (json.code === 200) {
        return json.data.ayahs.map((a: any) => ({
          number: a.number,
          numberInSurah: a.numberInSurah,
          text: a.text,
          audio: a.audio,
          juz: a.juz,
          page: a.page,
          hizbQuarter: a.hizbQuarter,
        }));
      }
      return [];
    } catch {
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
