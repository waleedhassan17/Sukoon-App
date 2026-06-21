/**
 * QuranVoiceService — Quran Voice Assistant brain.
 *
 * Turns a transcribed voice command (e.g. "Play Surah Rahman Ayah 13") into a
 * structured action the app can execute:
 *
 *     { surah_number: 55, ayah_number: 13, action: 'play' }
 *
 * How it works:
 *   - Calls Google Gemini's `generateContent` with the `gemini-2.5-flash-lite`
 *     model, using JSON / structured-output mode so the reply is always valid
 *     JSON matching our schema (no brittle text parsing).
 *   - Per product decision, Gemini is called DIRECTLY from the app (no backend
 *     server). The API key is read from the EXPO_PUBLIC_GEMINI_API_KEY
 *     environment variable, which lives in a gitignored `.env` locally and as an
 *     EAS environment variable for builds — it is never committed to git.
 *
 *   ⚠️ Trade-off: an EXPO_PUBLIC_* value is inlined into the JS bundle, so a
 *   determined user could extract it from the APK/AAB. This was an explicit
 *   choice to avoid running/maintaining a server. If the key ever needs to be
 *   fully hidden, move this call behind a tiny backend endpoint and have the app
 *   POST the transcribed text to it instead.
 */

const MODEL = 'gemini-2.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_RETRIES = 4; // for HTTP 429 (rate limit) only

const SYSTEM_INSTRUCTION = `You convert a transcribed Quran voice command into structured JSON telling the app which ayah to play or open.

Rules:
- Convert Surah names to their numbers. Examples: Al-Fatiha = 1, Al-Baqarah = 2, Yaseen (Ya-Sin) = 36, Ar-Rahman = 55, Al-Mulk = 67, Al-Ikhlas = 112, An-Nas = 114.
- If no ayah/verse is mentioned, default ayah_number to 1.
- Special case: "Ayat ul Kursi" / "Ayatul Kursi" / "Ayat al Kursi" -> surah_number 2, ayah_number 255.
- action is "play" by default. If the command uses the word "open" (e.g. "Open Surah Yaseen"), set action to "open" instead. Words like "play", "recite", "read aloud" mean "play".
- Be accurate. surah_number must be an integer 1-114 and ayah_number an integer >= 1. Never guess invalid values.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    surah_number: { type: 'INTEGER' },
    ayah_number: { type: 'INTEGER' },
    action: { type: 'STRING', enum: ['play', 'open'] },
  },
  required: ['surah_number', 'ayah_number', 'action'],
  propertyOrdering: ['surah_number', 'ayah_number', 'action'],
};

export type QuranCommandAction = 'play' | 'open';

export interface QuranCommand {
  surah_number: number;
  ayah_number: number;
  action: QuranCommandAction;
}

function getApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Validate the model output. Throws on anything outside the allowed ranges. */
function validateCommand(raw: any): QuranCommand {
  const surah = Number(raw?.surah_number);
  const ayah = Number(raw?.ayah_number);
  const action: QuranCommandAction = raw?.action === 'open' ? 'open' : 'play';

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error('INVALID_SURAH');
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    throw new Error('INVALID_AYAH');
  }
  return { surah_number: surah, ayah_number: ayah, action };
}

export const QuranVoiceService = {
  /** True if a Gemini API key is configured (feature can run). */
  isConfigured(): boolean {
    return !!getApiKey();
  },

  /**
   * Parse a transcribed command into a structured QuranCommand using Gemini.
   * Retries with exponential backoff on HTTP 429. Throws a coded Error on
   * failure (EMPTY_COMMAND, VOICE_NOT_CONFIGURED, RATE_LIMITED, INVALID_*,
   * GEMINI_* / network errors) so the UI can show a friendly message.
   */
  async parseCommand(text: string): Promise<QuranCommand> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('VOICE_NOT_CONFIGURED');

    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('EMPTY_COMMAND');

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ parts: [{ text: trimmed }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Rate limited — back off exponentially and retry.
      if (res.status === 429) {
        if (attempt === MAX_RETRIES) throw new Error('RATE_LIMITED');
        const backoff = Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        throw new Error(`GEMINI_HTTP_${res.status}`);
      }

      const json = await res.json();
      const rawText: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('GEMINI_EMPTY');

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error('GEMINI_BAD_JSON');
      }
      return validateCommand(parsed);
    }

    // Loop only exits via return or throw above; this satisfies the type checker.
    throw new Error('RATE_LIMITED');
  },
};

export default QuranVoiceService;
