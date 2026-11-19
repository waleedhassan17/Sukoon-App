/**
 * EmotionService v2.1 — ML-powered emotion detection with a hard deadline.
 *
 * Backend: https://waleedhassan-sukoon-emotion-api.hf.space
 * Model: Custom fine-tuned transformer, 50 emotion classes
 * Languages: English, Urdu, Roman Urdu
 *
 * Architecture:
 * - Primary: POST /predict → real ML inference + Quranic verses
 * - Fallback: local keyword matching when the API is unreachable, slow or returns
 *   something unusable. The result says WHY (`fallbackReason`) so the UI can be
 *   honest instead of silently showing generic guidance.
 *
 * Reliability contract: `analyze()` ALWAYS settles within TOTAL_BUDGET_MS (plus a
 * hair). The previous version allowed 3 attempts × 30 s (~93 s) with no way out,
 * which on a slow or blocked network looked like an app stuck on "loading".
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
  /** First ayah of the (possibly ranged) reference — safe for save/share/bookmarks. */
  ayah: number;
  /** Display form when the API returns a range, e.g. "5-6". Absent for a single ayah. */
  ayahLabel?: string;
  arabic: string;
  english: string;
  urdu?: string;
  surahName: string;
  reference: string;
  matchedEmotion: string;
  relevanceScore: number;
}

export type FallbackReason = 'timeout' | 'network' | 'server' | 'invalid' | 'cancelled';

export interface AnalysisResult {
  emotions: EmotionResult[];
  verses: VerseRecommendation[];
  languageDetected: string;
  modelVersion: string;
  inferenceTime: number;
  source: 'api' | 'fallback';
  /** Why the offline fallback was used (only when source === 'fallback'). */
  fallbackReason?: FallbackReason;
}

interface APIResponse {
  input_text?: string;
  predicted_emotions: string[];
  confidence_scores: number[];
  language_detected?: string;
  model_version?: string;
  inference_time?: number;
  verses?: APIVerse[];
}

interface APIVerse {
  reference: string;
  surah_name: string;
  surah_number: number;
  /** A number for a single ayah, or a string range like "5-6". */
  ayah: number | string;
  arabic: string;
  english: string;
  urdu?: string;
  matched_emotion: string;
  relevance_score: number;
}

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════

const DEFAULT_API_BASE = 'https://waleedhassan-sukoon-emotion-api.hf.space';
/** Overridable at build time (EXPO_PUBLIC_*) so the backend can move without an app release. */
export const API_BASE = (process.env.EXPO_PUBLIC_EMOTION_API_URL || DEFAULT_API_BASE).replace(/\/+$/, '');

/** One attempt. HF Spaces can cold-start, so this is generous but bounded. */
export const ATTEMPT_TIMEOUT_MS = 12_000;
/** Everything — attempts, backoff and parsing — must finish inside this. */
export const TOTAL_BUDGET_MS = 20_000;
/** One retry, only for transient failures (network/5xx). Never for 4xx. */
const MAX_RETRIES = 1;
const MIN_ATTEMPT_MS = 2_000;

// ══════════════════════════════════════════════
// NETWORK (deadline-bound)
// ══════════════════════════════════════════════

export class HttpError extends Error {
  status: number;
  constructor(status: number, statusText: string) {
    super(`API returned ${status}: ${statusText}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'TimeoutError';
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One request with a single deadline that covers connecting, headers AND reading
 * the body (the timer is only cleared after `json()` resolves). Honors an
 * external AbortSignal so the user can cancel.
 */
async function requestJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort);
  }

  // Some RN/Android versions have been known to leave a fetch (or body read)
  // pending after abort(). Racing against the abort signal guarantees we settle
  // on time even then — the whole point of this function is "never hang".
  const aborted = new Promise<never>((_, reject) => {
    if (controller.signal.aborted) reject(new Error('aborted'));
    else controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  aborted.catch(() => {}); // the race below handles it; avoid an unhandled-rejection warning

  try {
    const res = await Promise.race([fetch(url, { ...init, signal: controller.signal }), aborted]);
    if (!res.ok) throw new HttpError(res.status, res.statusText);
    return (await Promise.race([res.json(), aborted])) as T;
  } catch (e) {
    if (external?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'CancelledError' });
    if (timedOut || (e as any)?.name === 'AbortError') throw new TimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

function classify(e: unknown): FallbackReason {
  const name = (e as any)?.name;
  if (name === 'CancelledError') return 'cancelled';
  if (name === 'TimeoutError') return 'timeout';
  if (name === 'HttpError') return 'server';
  if (name === 'InvalidResponseError') return 'invalid';
  return 'network';
}

// ══════════════════════════════════════════════
// RESPONSE PARSING (pure, unit-tested)
// ══════════════════════════════════════════════

/** "5-6" → start 5 label "5-6"; 5 → start 5, no label; junk → start 1. */
export function parseAyah(raw: unknown): { start: number; label?: string } {
  if (typeof raw === 'number') {
    return { start: Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 1 };
  }
  const str = String(raw ?? '').trim();
  const m = /^(\d+)/.exec(str);
  const start = m ? Math.max(1, parseInt(m[1], 10)) : 1;
  // Only a genuine range ("5-6", "5–6") earns a display label; junk gets none.
  const isRange = /^\d+\s*[-–—]\s*\d+$/.test(str);
  return isRange ? { start, label: str.replace(/\s+/g, '') } : { start };
}

/** Validate + normalise the API payload. Returns null if it is unusable. */
export function parseApiResponse(data: any): Omit<AnalysisResult, 'source' | 'fallbackReason'> | null {
  if (!data || !Array.isArray(data.predicted_emotions) || data.predicted_emotions.length === 0) return null;
  const scores: unknown[] = Array.isArray(data.confidence_scores) ? data.confidence_scores : [];

  const emotions: EmotionResult[] = data.predicted_emotions
    .map((em: unknown, i: number) => ({
      emotion: String(em),
      confidence: Number.isFinite(Number(scores[i])) ? Number(scores[i]) : 0,
    }))
    .filter((e: EmotionResult) => e.emotion.length > 0);
  if (emotions.length === 0) return null;

  const verses: VerseRecommendation[] = (Array.isArray(data.verses) ? data.verses : [])
    .filter((v: any) => v && Number.isFinite(Number(v.surah_number)))
    .map((v: APIVerse) => {
      const { start, label } = parseAyah(v.ayah);
      return {
        surah: Number(v.surah_number),
        ayah: start,
        ayahLabel: label,
        arabic: String(v.arabic || '').replace(/[۟۠]/g, ''),
        english: String(v.english || ''),
        urdu: v.urdu || '',
        surahName: String(v.surah_name || ''),
        reference: String(v.reference || `${v.surah_name} ${v.surah_number}:${v.ayah}`),
        matchedEmotion: String(v.matched_emotion || ''),
        relevanceScore: Number.isFinite(Number(v.relevance_score)) ? Number(v.relevance_score) : 0,
      };
    });

  return {
    emotions,
    verses,
    languageDetected: data.language_detected || 'en',
    modelVersion: data.model_version || 'v2.0',
    inferenceTime: Number(data.inference_time) || 0,
  };
}

// ══════════════════════════════════════════════
// LOCAL FALLBACK (when the API is down / slow)
// ══════════════════════════════════════════════

/**
 * English + Urdu script + Roman Urdu. Matching is by WHOLE WORD (or a longer
 * stem prefix), never raw substring — the old `includes()` made "scared" match
 * "care" and score `love`. Multi-word entries match as phrases.
 */
export const FALLBACK_KEYWORDS: Record<string, string[]> = {
  peace: ['calm', 'peace', 'peaceful', 'tranquil', 'serene', 'relaxed', 'sukoon', 'sakoon', 'chain', 'سکون', 'چین'],
  hope: ['hope', 'hopeful', 'optimistic', 'future', 'better', 'inshallah', 'umeed', 'ummeed', 'امید', 'ان شاء اللہ'],
  gratitude: ['grateful', 'thankful', 'blessed', 'alhamdulillah', 'mashallah', 'shukar', 'shukr', 'shukriya', 'شکر', 'شکریہ', 'الحمدللہ'],
  sadness: ['sad', 'sadness', 'unhappy', 'depressed', 'depression', 'cry', 'crying', 'tears', 'grief', 'heartbroken', 'udas', 'udaas', 'gham', 'ghum', 'dukh', 'rona', 'dil toot', 'اداس', 'غم', 'دکھ', 'رونا', 'آنسو'],
  anxiety: ['anxious', 'anxiety', 'stressed', 'stress', 'overwhelmed', 'panic', 'worried', 'worry', 'pareshan', 'pareshani', 'tension', 'ghabra', 'ghabrahat', 'fikr', 'پریشان', 'پریشانی', 'ٹینشن', 'گھبراہٹ', 'فکر'],
  fear: ['afraid', 'fear', 'scared', 'frightened', 'terrified', 'darr', 'dar lag', 'khauf', 'ڈر', 'خوف'],
  guidance: ['lost', 'confused', 'confusion', 'direction', 'guide', 'guidance', 'searching', 'rahnumai', 'hidayat', 'raasta', 'bhatak', 'رہنمائی', 'ہدایت', 'راستہ', 'بھٹک'],
  patience: ['patient', 'patience', 'waiting', 'endure', 'struggle', 'difficult', 'sabr', 'mushkil', 'صبر', 'مشکل'],
  forgiveness: ['forgive', 'forgiveness', 'sorry', 'regret', 'mistake', 'guilt', 'guilty', 'maafi', 'maaf', 'gunah', 'tauba', 'astaghfirullah', 'معافی', 'گناہ', 'توبہ', 'استغفر'],
  love: ['love', 'loved', 'loving', 'care', 'family', 'heart', 'miss', 'mohabbat', 'muhabbat', 'pyar', 'محبت', 'پیار'],
  anger: ['angry', 'anger', 'frustrated', 'furious', 'rage', 'annoyed', 'gussa', 'ghussa', 'naraz', 'غصہ', 'ناراض'],
  joy: ['happy', 'joy', 'joyful', 'excited', 'wonderful', 'celebrate', 'khush', 'khushi', 'خوش', 'خوشی'],
  loneliness: ['lonely', 'loneliness', 'alone', 'isolated', 'abandoned', 'akela', 'akeli', 'tanha', 'tanhai', 'اکیلا', 'اکیلی', 'تنہا', 'تنہائی'],
  trust: ['trust', 'faith', 'believe', 'tawakkul', 'iman', 'bharosa', 'yaqeen', 'بھروسہ', 'یقین', 'توکل', 'ایمان'],
  strength: ['strong', 'strength', 'courage', 'brave', 'resilient', 'overcome', 'himmat', 'taqat', 'hosla', 'ہمت', 'طاقت', 'حوصلہ'],
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

/** Lower-case, strip Latin + Arabic-script punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return ` ${String(text ?? '')
    .toLowerCase()
    .replace(/[.,!?;:()"“”‘’\-–—_/\\|[\]{}<>@#$%^&*+=~`،؛؟۔…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/** Inflections we accept after an English keyword: love → loved/loving?/lovely/loves… */
const SUFFIXES = '(?:s|es|ed|d|ing|ly|ness|ful|er)?';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Precompiled once. Each keyword matches as a WHOLE WORD (or whole phrase) with
 * an optional common suffix — so "scared" can never match "care" and "mission"
 * can never match "miss". The text is space-padded by `normalizeText`.
 */
const KEYWORD_MATCHERS: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(FALLBACK_KEYWORDS).map(([emotion, kws]) => [
    emotion,
    kws.map((kw) => new RegExp(` ${escapeRegExp(kw)}${kw.includes(' ') ? '' : SUFFIXES} `)),
  ]),
);

export function localFallbackAnalyze(text: string): { emotions: EmotionResult[]; verses: VerseRecommendation[] } {
  const padded = normalizeText(text);
  const scores: Record<string, number> = {};

  for (const [emotion, matchers] of Object.entries(KEYWORD_MATCHERS)) {
    let matchCount = 0;
    for (const re of matchers) {
      if (re.test(padded)) matchCount++;
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

function fallbackResult(text: string, reason: FallbackReason): AnalysisResult {
  return {
    ...localFallbackAnalyze(text),
    languageDetected: 'unknown',
    modelVersion: 'local',
    inferenceTime: 0,
    source: 'fallback',
    fallbackReason: reason,
  };
}

// ══════════════════════════════════════════════
// MAIN SERVICE
// ══════════════════════════════════════════════

export const EmotionService = {

  /**
   * Analyze text via the ML API → emotions + Quranic verses.
   * Always settles within ~TOTAL_BUDGET_MS and never throws: on any failure it
   * returns local keyword guidance tagged with `fallbackReason`.
   *
   * Pass `signal` to let the user cancel; a cancelled call resolves immediately
   * with the local result.
   */
  async analyze(
    text: string,
    maxEmotions = 5,
    maxVerses = 5,
    opts: { signal?: AbortSignal } = {},
  ): Promise<AnalysisResult> {
    const started = Date.now();
    const body = JSON.stringify({ text, max_emotions: maxEmotions, max_verses: maxVerses, threshold: null });
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
      if (remaining < MIN_ATTEMPT_MS) break;

      try {
        const data = await requestJson<APIResponse>(
          `${API_BASE}/predict`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
          Math.min(ATTEMPT_TIMEOUT_MS, remaining),
          opts.signal,
        );
        const parsed = parseApiResponse(data);
        if (!parsed) {
          throw Object.assign(new Error('Unexpected API response'), { name: 'InvalidResponseError' });
        }
        return { ...parsed, source: 'api' };
      } catch (e) {
        lastError = e;
        const reason = classify(e);
        if (__DEV__) console.warn('[EmotionService] attempt failed:', reason, e);

        // Do not retry: user cancelled, client error, or a malformed (not transient) response.
        if (reason === 'cancelled' || reason === 'invalid') break;
        if (e instanceof HttpError && e.status < 500) break;

        // Brief backoff, but never past the budget.
        const left = TOTAL_BUDGET_MS - (Date.now() - started);
        if (attempt < MAX_RETRIES && left > MIN_ATTEMPT_MS + 600) await sleep(600);
      }
    }

    return fallbackResult(text, classify(lastError ?? new TimeoutError()));
  },

  /** Instant local guidance (the "Use offline guidance" escape hatch). */
  analyzeOffline(text: string, reason: FallbackReason = 'cancelled'): AnalysisResult {
    return fallbackResult(text, reason);
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
   * Pre-warm the API (HF Spaces sleep after inactivity and take a while to wake).
   * Call early and often — it is cheap and bounded.
   */
  async warmUp(): Promise<boolean> {
    try {
      const data = await requestJson<{ status?: string; model_loaded?: boolean }>(
        `${API_BASE}/health`,
        { method: 'GET' },
        10_000,
      );
      return data.status === 'healthy' && data.model_loaded === true;
    } catch {
      return false;
    }
  },
};

export default EmotionService;
