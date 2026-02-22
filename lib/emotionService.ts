/**
 * EmotionService v2.0 — Production ML-Powered Emotion Detection
 * 
 * Backend: https://waleedhassan-sukoon-emotion-api.hf.space
 * Model: Custom fine-tuned transformer, 50 emotion classes
 * Languages: English, Urdu, Roman Urdu
 * 
 * Architecture:
 * - Primary: POST /predict → real ML inference + Quranic verses
 * - Fallback: Local keyword matching (if API unreachable)
 * - Voice: POST /predict/voice → voice-based emotion detection
 */

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface EmotionResult {
  emotion: string;
  confidence: number;
}

export interface VerseRecommendation {
  surah: number;
  ayah: number;
  arabic: string;
  english: string;
  urdu?: string;
  surahName: string;
  reference: string;
  matchedEmotion: string;
  relevanceScore: number;
}

export interface AnalysisResult {
  emotions: EmotionResult[];
  verses: VerseRecommendation[];
  languageDetected: string;
  modelVersion: string;
  inferenceTime: number;
  source: 'api' | 'fallback';
}

interface APIResponse {
  input_text: string;
  predicted_emotions: string[];
  confidence_scores: number[];
  language_detected: string;
  model_version: string;
  inference_time: number;
  verses: APIVerse[];
}

interface APIVerse {
  reference: string;
  surah_name: string;
  surah_number: number;
  ayah: number;
  arabic: string;
  english: string;
  urdu: string;
  matched_emotion: string;
  relevance_score: number;
}

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════

const API_BASE = 'https://waleedhassan-sukoon-emotion-api.hf.space';
const TIMEOUT_MS = 30000; // 30s (HF spaces can cold-start)
const MAX_RETRIES = 2;

// ══════════════════════════════════════════════
// FETCH WITH TIMEOUT + RETRY
// ══════════════════════════════════════════════

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(url, options, TIMEOUT_MS);
      if (res.ok) return res;
      if (res.status >= 500 && i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    } catch (e: any) {
      lastError = e;
      if (e.name === 'AbortError') {
        lastError = new Error('Request timed out');
      }
      if (i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastError || new Error('API request failed');
}

// ══════════════════════════════════════════════
// LOCAL FALLBACK (when API is down)
// ══════════════════════════════════════════════

const FALLBACK_KEYWORDS: Record<string, string[]> = {
  peace: ['calm', 'peace', 'tranquil', 'serene', 'relaxed', 'sukoon'],
  hope: ['hope', 'optimistic', 'future', 'better', 'inshallah'],
  gratitude: ['grateful', 'thankful', 'blessed', 'alhamdulillah'],
  sadness: ['sad', 'unhappy', 'depressed', 'cry', 'tears', 'grief', 'heartbroken'],
  anxiety: ['anxious', 'stressed', 'overwhelmed', 'panic', 'worried'],
  fear: ['afraid', 'fear', 'scared', 'worry', 'frightened'],
  guidance: ['lost', 'confused', 'direction', 'guide', 'searching'],
  patience: ['patient', 'waiting', 'endure', 'struggle', 'difficult'],
  forgiveness: ['forgive', 'sorry', 'regret', 'mistake', 'guilt'],
  love: ['love', 'care', 'family', 'heart', 'miss'],
  anger: ['angry', 'frustrated', 'furious', 'rage', 'annoyed'],
  joy: ['happy', 'joy', 'excited', 'wonderful', 'celebrate'],
  loneliness: ['lonely', 'alone', 'isolated', 'abandoned'],
  trust: ['trust', 'faith', 'believe', 'tawakkul', 'iman'],
  strength: ['strong', 'courage', 'brave', 'resilient', 'overcome'],
};

const FALLBACK_VERSES: Record<string, { surah: number; ayah: number; surahName: string; arabic: string; english: string; urdu: string }[]> = {
  sadness: [
    { surah: 93, ayah: 3, surahName: 'Ad-Duha', arabic: 'مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ', english: 'Your Lord has not forsaken you, nor is He displeased.', urdu: 'تمہارے رب نے نہ تمہیں چھوڑا اور نہ ناراض ہوا۔' },
    { surah: 94, ayah: 5, surahName: 'Ash-Sharh', arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', english: 'Indeed, with hardship comes ease.', urdu: 'بے شک مشکل کے ساتھ آسانی ہے۔' },
  ],
  anxiety: [
    { surah: 13, ayah: 28, surahName: 'Ar-Ra\'d', arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', english: 'Verily, in the remembrance of Allah do hearts find rest.', urdu: 'خبردار! اللہ کی یاد سے دلوں کو سکون ملتا ہے۔' },
  ],
  peace: [
    { surah: 89, ayah: 27, surahName: 'Al-Fajr', arabic: 'يَا أَيَّتُهَا النَّفْسُ الْمُطْمَئِنَّةُ', english: 'O soul at peace!', urdu: 'اے مطمئن نفس!' },
  ],
  guidance: [
    { surah: 1, ayah: 6, surahName: 'Al-Fatiha', arabic: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', english: 'Guide us to the straight path.', urdu: 'ہمیں سیدھے راستے کی ہدایت دے۔' },
  ],
  hope: [
    { surah: 94, ayah: 6, surahName: 'Ash-Sharh', arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', english: 'Indeed, with hardship comes ease.', urdu: 'بے شک مشکل کے ساتھ آسانی ہے۔' },
  ],
  gratitude: [
    { surah: 14, ayah: 7, surahName: 'Ibrahim', arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', english: 'If you are grateful, I will give you more.', urdu: 'اگر تم شکر کرو گے تو میں تمہیں اور زیادہ دوں گا۔' },
  ],
  forgiveness: [
    { surah: 39, ayah: 53, surahName: 'Az-Zumar', arabic: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ', english: 'Do not despair of the mercy of Allah.', urdu: 'اللہ کی رحمت سے ناامید نہ ہو۔' },
  ],
  love: [
    { surah: 30, ayah: 21, surahName: 'Ar-Rum', arabic: 'وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً', english: 'And He placed between you affection and mercy.', urdu: 'اور تمہارے درمیان محبت اور رحمت رکھ دی۔' },
  ],
  fear: [
    { surah: 3, ayah: 173, surahName: 'Al-Imran', arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', english: 'Sufficient for us is Allah, and He is the best disposer of affairs.', urdu: 'ہمارے لیے اللہ کافی ہے اور وہ بہترین کارساز ہے۔' },
  ],
  patience: [
    { surah: 2, ayah: 153, surahName: 'Al-Baqarah', arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', english: 'Indeed, Allah is with the patient.', urdu: 'بے شک اللہ صبر کرنے والوں کے ساتھ ہے۔' },
  ],
  anger: [
    { surah: 3, ayah: 134, surahName: 'Al-Imran', arabic: 'وَالْكَاظِمِينَ الْغَيْظَ وَالْعَافِينَ عَنِ النَّاسِ', english: 'Those who restrain anger and pardon people.', urdu: 'غصہ پینے والے اور لوگوں سے درگزر کرنے والے۔' },
  ],
  joy: [
    { surah: 10, ayah: 58, surahName: 'Yunus', arabic: 'بِفَضْلِ اللَّهِ وَبِرَحْمَتِهِ فَبِذَٰلِكَ فَلْيَفْرَحُوا', english: 'In the bounty of Allah and in His mercy — in that let them rejoice.', urdu: 'اللہ کے فضل اور اس کی رحمت پر خوش ہو جائیں۔' },
  ],
  trust: [
    { surah: 65, ayah: 3, surahName: 'At-Talaq', arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', english: 'Whoever relies upon Allah — He is sufficient for him.', urdu: 'جو اللہ پر بھروسہ کرے اللہ اسے کافی ہے۔' },
  ],
  strength: [
    { surah: 8, ayah: 46, surahName: 'Al-Anfal', arabic: 'وَاصْبِرُوا ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', english: 'And be patient. Indeed, Allah is with the patient.', urdu: 'اور صبر کرو بے شک اللہ صبر والوں کے ساتھ ہے۔' },
  ],
  loneliness: [
    { surah: 2, ayah: 186, surahName: 'Al-Baqarah', arabic: 'فَإِنِّي قَرِيبٌ', english: 'Indeed I am near.', urdu: 'میں قریب ہوں۔' },
  ],
};

function localFallbackAnalyze(text: string): { emotions: EmotionResult[]; verses: VerseRecommendation[] } {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [emotion, keywords] of Object.entries(FALLBACK_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) matchCount++;
    }
    if (matchCount > 0) {
      scores[emotion] = Math.min(matchCount / 3, 1.0);
    }
  }

  if (Object.keys(scores).length === 0) {
    scores['guidance'] = 0.6;
    scores['peace'] = 0.4;
  }

  const emotions = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([emotion, confidence]) => ({ emotion, confidence: Math.round(confidence * 100) / 100 }));

  const verses: VerseRecommendation[] = [];
  const seen = new Set<string>();
  for (const { emotion, confidence } of emotions) {
    const pool = FALLBACK_VERSES[emotion] || FALLBACK_VERSES['guidance'] || [];
    for (const v of pool) {
      const key = `${v.surah}:${v.ayah}`;
      if (!seen.has(key) && verses.length < 5) {
        seen.add(key);
        verses.push({
          surah: v.surah,
          ayah: v.ayah,
          arabic: v.arabic,
          english: v.english,
          urdu: v.urdu,
          surahName: v.surahName,
          reference: `Surah ${v.surahName} ${v.surah}:${v.ayah}`,
          matchedEmotion: emotion,
          relevanceScore: confidence,
        });
      }
    }
  }

  return { emotions, verses };
}

// ══════════════════════════════════════════════
// MAIN SERVICE
// ══════════════════════════════════════════════

export const EmotionService = {

  /**
   * Analyze text via ML API → returns emotions + Quranic verses
   * Falls back to local keyword matching if API is down
   */
  async analyze(text: string, maxEmotions = 5, maxVerses = 5): Promise<AnalysisResult> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          max_emotions: maxEmotions,
          max_verses: maxVerses,
          threshold: null,
        }),
      });

      const data: APIResponse = await res.json();

      const emotions: EmotionResult[] = data.predicted_emotions.map((em, i) => ({
        emotion: em,
        confidence: data.confidence_scores[i] ?? 0,
      }));

      const verses: VerseRecommendation[] = (data.verses || []).map(v => ({
        surah: v.surah_number,
        ayah: v.ayah,
        arabic: v.arabic,
        english: v.english,
        urdu: v.urdu || '',
        surahName: v.surah_name,
        reference: v.reference,
        matchedEmotion: v.matched_emotion,
        relevanceScore: v.relevance_score,
      }));

      return {
        emotions,
        verses,
        languageDetected: data.language_detected || 'en',
        modelVersion: data.model_version || 'v2.0',
        inferenceTime: data.inference_time || 0,
        source: 'api',
      };
    } catch (error) {
      if (__DEV__) console.warn('[EmotionService] API failed, using fallback:', error);

      const fallback = localFallbackAnalyze(text);
      return {
        ...fallback,
        languageDetected: 'unknown',
        modelVersion: 'local',
        inferenceTime: 0,
        source: 'fallback',
      };
    }
  },

  /**
   * Legacy compatibility: synchronous emotion analysis (local only)
   */
  analyzeEmotion(text: string): EmotionResult[] {
    return localFallbackAnalyze(text).emotions;
  },

  /**
   * Legacy compatibility: get verse recommendations (local only)
   */
  async getRecommendedVerses(emotions: EmotionResult[], count = 5): Promise<VerseRecommendation[]> {
    const allVerses: VerseRecommendation[] = [];
    const seen = new Set<string>();
    for (const { emotion, confidence } of emotions) {
      const pool = FALLBACK_VERSES[emotion] || FALLBACK_VERSES['guidance'] || [];
      for (const v of pool) {
        const key = `${v.surah}:${v.ayah}`;
        if (!seen.has(key) && allVerses.length < count) {
          seen.add(key);
          allVerses.push({
            surah: v.surah,
            ayah: v.ayah,
            arabic: v.arabic,
            english: v.english,
            urdu: v.urdu,
            surahName: v.surahName,
            reference: `Surah ${v.surahName} ${v.surah}:${v.ayah}`,
            matchedEmotion: emotion,
            relevanceScore: confidence,
          });
        }
      }
    }
    return allVerses;
  },

  /**
   * Pre-warm API (HF spaces sleep after inactivity)
   * Call on app launch in background
   */
  async warmUp(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/health`, { method: 'GET' }, 10000);
      const data = await res.json();
      return data.status === 'healthy' && data.model_loaded === true;
    } catch {
      return false;
    }
  },
};

export default EmotionService;
