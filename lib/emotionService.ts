/**
 * EmotionService - Emotion detection & Quranic verse recommendation
 * Uses keyword-based analysis (mocked ML) with real Quran API data
 */

import { QuranService } from './quranService';

interface EmotionResult {
  emotion: string;
  confidence: number;
}

interface VerseRecommendation {
  surah: number;
  ayah: number;
  arabic: string;
  english: string;
  urdu?: string;
  surahName: string;
  emotions: string[];
}

// Keyword to emotion mapping
const EMOTION_KEYWORDS: Record<string, string[]> = {
  peace: ['calm', 'peace', 'tranquil', 'serene', 'quiet', 'still', 'relaxed', 'content', 'sukoon'],
  hope: ['hope', 'optimistic', 'bright', 'future', 'better', 'positive', 'looking forward', 'inshallah'],
  gratitude: ['grateful', 'thankful', 'blessed', 'alhamdulillah', 'appreciate', 'gift', 'gratitude'],
  fear: ['afraid', 'fear', 'scared', 'worry', 'terror', 'dread', 'frightened', 'nervous'],
  sadness: ['sad', 'unhappy', 'depressed', 'cry', 'tears', 'sorrow', 'grief', 'heartbroken', 'down'],
  anxiety: ['anxious', 'stressed', 'overwhelmed', 'panic', 'restless', 'uneasy', 'tension', 'worried'],
  guidance: ['lost', 'confused', 'direction', 'guide', 'path', 'way', 'seek', 'searching'],
  patience: ['patient', 'waiting', 'endure', 'difficult', 'test', 'trial', 'struggle', 'hard'],
  forgiveness: ['forgive', 'sorry', 'regret', 'mistake', 'sin', 'repent', 'guilt', 'ashamed', 'wrong'],
  love: ['love', 'care', 'affection', 'family', 'heart', 'companion', 'together', 'miss'],
  strength: ['strong', 'strength', 'courage', 'brave', 'fight', 'resilient', 'power', 'overcome'],
  trust: ['trust', 'faith', 'believe', 'tawakkul', 'rely', 'depend', 'confidence', 'iman'],
  loneliness: ['lonely', 'alone', 'isolated', 'nobody', 'abandoned', 'solitude', 'friendless'],
  anger: ['angry', 'frustrated', 'mad', 'furious', 'rage', 'annoyed', 'irritated', 'upset'],
  joy: ['happy', 'joy', 'delighted', 'excited', 'wonderful', 'amazing', 'celebrate', 'smile'],
  wisdom: ['understand', 'knowledge', 'learn', 'wisdom', 'insight', 'reflect', 'think', 'ponder'],
};

// Curated verse recommendations by emotion
const VERSE_MAP: Record<string, { surah: number; ayah: number }[]> = {
  peace: [
    { surah: 13, ayah: 28 }, { surah: 89, ayah: 27 }, { surah: 2, ayah: 286 },
    { surah: 48, ayah: 4 }, { surah: 6, ayah: 127 },
  ],
  hope: [
    { surah: 94, ayah: 5 }, { surah: 94, ayah: 6 }, { surah: 65, ayah: 3 },
    { surah: 12, ayah: 87 }, { surah: 39, ayah: 53 },
  ],
  gratitude: [
    { surah: 14, ayah: 7 }, { surah: 2, ayah: 152 }, { surah: 31, ayah: 12 },
    { surah: 16, ayah: 18 }, { surah: 55, ayah: 13 },
  ],
  fear: [
    { surah: 2, ayah: 286 }, { surah: 3, ayah: 173 }, { surah: 9, ayah: 51 },
    { surah: 65, ayah: 3 }, { surah: 8, ayah: 46 },
  ],
  sadness: [
    { surah: 93, ayah: 3 }, { surah: 93, ayah: 4 }, { surah: 94, ayah: 5 },
    { surah: 2, ayah: 155 }, { surah: 3, ayah: 139 },
  ],
  anxiety: [
    { surah: 13, ayah: 28 }, { surah: 94, ayah: 5 }, { surah: 2, ayah: 286 },
    { surah: 65, ayah: 3 }, { surah: 3, ayah: 173 },
  ],
  guidance: [
    { surah: 1, ayah: 6 }, { surah: 93, ayah: 7 }, { surah: 2, ayah: 186 },
    { surah: 20, ayah: 114 }, { surah: 6, ayah: 161 },
  ],
  patience: [
    { surah: 2, ayah: 153 }, { surah: 2, ayah: 155 }, { surah: 3, ayah: 200 },
    { surah: 11, ayah: 115 }, { surah: 103, ayah: 3 },
  ],
  forgiveness: [
    { surah: 39, ayah: 53 }, { surah: 4, ayah: 110 }, { surah: 3, ayah: 135 },
    { surah: 11, ayah: 114 }, { surah: 25, ayah: 70 },
  ],
  love: [
    { surah: 30, ayah: 21 }, { surah: 3, ayah: 31 }, { surah: 19, ayah: 96 },
    { surah: 85, ayah: 14 }, { surah: 2, ayah: 165 },
  ],
  strength: [
    { surah: 8, ayah: 46 }, { surah: 3, ayah: 139 }, { surah: 29, ayah: 69 },
    { surah: 2, ayah: 286 }, { surah: 47, ayah: 7 },
  ],
  trust: [
    { surah: 3, ayah: 173 }, { surah: 65, ayah: 3 }, { surah: 9, ayah: 51 },
    { surah: 14, ayah: 12 }, { surah: 8, ayah: 2 },
  ],
  loneliness: [
    { surah: 2, ayah: 186 }, { surah: 93, ayah: 3 }, { surah: 20, ayah: 46 },
    { surah: 94, ayah: 5 }, { surah: 29, ayah: 69 },
  ],
  anger: [
    { surah: 3, ayah: 134 }, { surah: 42, ayah: 37 }, { surah: 41, ayah: 34 },
    { surah: 7, ayah: 199 }, { surah: 16, ayah: 126 },
  ],
  joy: [
    { surah: 55, ayah: 13 }, { surah: 10, ayah: 58 }, { surah: 30, ayah: 4 },
    { surah: 14, ayah: 7 }, { surah: 3, ayah: 170 },
  ],
  wisdom: [
    { surah: 2, ayah: 269 }, { surah: 31, ayah: 12 }, { surah: 20, ayah: 114 },
    { surah: 39, ayah: 9 }, { surah: 96, ayah: 1 },
  ],
};

export const EmotionService = {
  /**
   * Analyze text for emotions using keyword matching
   */
  analyzeEmotion(text: string): EmotionResult[] {
    const lower = text.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) matchCount++;
      }
      if (matchCount > 0) {
        scores[emotion] = Math.min(matchCount / 3, 1.0);
      }
    }

    // If no matches, default to "guidance" and "peace"
    if (Object.keys(scores).length === 0) {
      scores['guidance'] = 0.6;
      scores['peace'] = 0.4;
    }

    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([emotion, confidence]) => ({ emotion, confidence: Math.round(confidence * 100) / 100 }));
  },

  /**
   * Get recommended verses based on detected emotions
   */
  async getRecommendedVerses(emotions: EmotionResult[], count: number = 5): Promise<VerseRecommendation[]> {
    const versesToFetch: { surah: number; ayah: number; emotions: string[] }[] = [];
    const seen = new Set<string>();

    for (const { emotion } of emotions) {
      const emotionVerses = VERSE_MAP[emotion] || VERSE_MAP['guidance'];
      for (const v of emotionVerses) {
        const key = `${v.surah}:${v.ayah}`;
        if (!seen.has(key) && versesToFetch.length < count) {
          seen.add(key);
          versesToFetch.push({ ...v, emotions: [emotion] });
        }
      }
    }

    // Fetch actual verse data from API
    const results: VerseRecommendation[] = [];
    for (const v of versesToFetch.slice(0, count)) {
      try {
        const globalAyahNum = await getGlobalAyahNumber(v.surah, v.ayah);
        const [arRes, enRes, urRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/ayah/${globalAyahNum}`),
          fetch(`https://api.alquran.cloud/v1/ayah/${globalAyahNum}/en.sahih`),
          fetch(`https://api.alquran.cloud/v1/ayah/${globalAyahNum}/ur.jalandhry`),
        ]);
        const [ar, en, ur] = await Promise.all([arRes.json(), enRes.json(), urRes.json()]);
        
        if (ar.code === 200) {
          results.push({
            surah: v.surah,
            ayah: v.ayah,
            arabic: ar.data.text,
            english: en.data.text,
            urdu: ur.data?.text,
            surahName: ar.data.surah.englishName,
            emotions: v.emotions,
          });
        }
      } catch (e) {
        console.error('Error fetching verse:', e);
      }
    }

    return results;
  },
};

// Helper to calculate global ayah number
async function getGlobalAyahNumber(surah: number, ayah: number): Promise<number> {
  // Surah starting ayah numbers (approximate, for the first few surahs)
  const surahStarts: Record<number, number> = {
    1: 1, 2: 8, 3: 294, 4: 494, 5: 670, 6: 790, 7: 957, 8: 1163, 9: 1236,
    10: 1365, 11: 1474, 12: 1597, 13: 1708, 14: 1751, 15: 1803, 16: 1852,
    17: 1981, 18: 2092, 19: 2203, 20: 2302, 21: 2437, 22: 2549, 23: 2627,
    24: 2746, 25: 2810, 26: 2887, 27: 3114, 28: 3207, 29: 3296, 30: 3365,
    31: 3425, 32: 3459, 33: 3489, 34: 3563, 35: 3608, 36: 3654, 37: 3737,
    38: 3919, 39: 4007, 40: 4082, 41: 4167, 42: 4221, 43: 4274, 44: 4363,
    45: 4400, 46: 4437, 47: 4472, 48: 4510, 49: 4539, 50: 4557, 51: 4602,
    52: 4662, 53: 4711, 54: 4773, 55: 4828, 56: 4906, 57: 5002, 58: 5031,
    59: 5053, 60: 5077, 61: 5090, 62: 5104, 63: 5115, 64: 5126, 65: 5144,
    66: 5157, 67: 5169, 68: 5200, 69: 5252, 70: 5304, 71: 5348, 72: 5376,
    73: 5404, 74: 5424, 75: 5480, 76: 5520, 77: 5551, 78: 5601, 79: 5641,
    80: 5687, 81: 5729, 82: 5758, 83: 5777, 84: 5813, 85: 5838, 86: 5861,
    87: 5878, 88: 5897, 89: 5923, 90: 5953, 91: 5973, 92: 5988, 93: 6009,
    94: 6020, 95: 6028, 96: 6036, 97: 6055, 98: 6060, 99: 6068, 100: 6076,
    101: 6087, 102: 6098, 103: 6106, 104: 6109, 105: 6118, 106: 6123,
    107: 6127, 108: 6134, 109: 6137, 110: 6143, 111: 6146, 112: 6151,
    113: 6155, 114: 6161,
  };
  
  const start = surahStarts[surah];
  if (start) return start + ayah - 1;
  
  // Fallback: use the API to find it
  return ayah; // This is approximate
}

export default EmotionService;
