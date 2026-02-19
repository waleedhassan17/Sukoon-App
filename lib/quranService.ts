/**
 * QuranService - Open source Quran API integration
 * Uses alquran.cloud API for Arabic text, translations, and audio
 * Uses api.quran.com as fallback
 */

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const QURANCOM_BASE = 'https://api.quran.com/api/v4';

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

// Cache
let surahsCache: SurahMeta[] | null = null;
const surahDataCache: Record<number, { meta: SurahMeta; ayahs: Ayah[] }> = {};

export const QuranService = {
  /**
   * Get all 114 Surahs metadata
   */
  async getAllSurahs(): Promise<SurahMeta[]> {
    if (surahsCache) return surahsCache;
    
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
      return surahsCache!;
    }
  },

  /**
   * Get complete Surah with Arabic, English, Urdu translations and audio
   * Uses Mishary Rashid Alafasy for recitation
   */
  async getSurah(surahNumber: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
    if (surahDataCache[surahNumber]) return surahDataCache[surahNumber];

    try {
      // Fetch Arabic + English translation + Audio in parallel
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
      surahDataCache[surahNumber] = result;
      return result;
    } catch (e) {
      console.error('Error loading surah:', e);
      throw e;
    }
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

  clearCache() {
    surahsCache = null;
    Object.keys(surahDataCache).forEach(k => delete surahDataCache[Number(k)]);
  },
};

export default QuranService;
