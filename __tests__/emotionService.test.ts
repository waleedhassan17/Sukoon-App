/** EmotionService: deadline, retry policy, validation, ayah ranges, offline fallback. */

import {
  ATTEMPT_TIMEOUT_MS,
  EmotionService,
  localFallbackAnalyze,
  normalizeText,
  parseApiResponse,
  parseAyah,
  TOTAL_BUDGET_MS,
} from '../lib/emotionService';

const GOOD_PAYLOAD = {
  input_text: 'x',
  predicted_emotions: ['sadness', 'hope'],
  confidence_scores: [0.8, 0.4],
  language_detected: 'en',
  model_version: 'v2.0',
  inference_time: 0.12,
  verses: [
    {
      reference: 'Ash-Sharh 94:5-6',
      surah_name: 'Ash-Sharh',
      surah_number: 94,
      ayah: '5-6',
      arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
      english: 'Indeed, with hardship comes ease.',
      urdu: 'بے شک مشکل کے ساتھ آسانی ہے۔',
      matched_emotion: 'sadness',
      relevance_score: 0.9,
    },
    {
      reference: 'Ad-Duha 93:3',
      surah_name: 'Ad-Duha',
      surah_number: 93,
      ayah: 3,
      arabic: 'مَا وَدَّعَكَ رَبُّكَ',
      english: 'Your Lord has not forsaken you.',
      matched_emotion: 'sadness',
      relevance_score: 0.8,
    },
  ],
};

const ok = (body: any) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });
const bad = (status: number) => ({ ok: false, status, statusText: 'err', json: async () => ({}) });

/** A fetch that never answers on its own — it only ends when its signal aborts. */
function hangingFetch() {
  return jest.fn(
    (_url: string, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      }),
  );
}

const realFetch = (global as any).fetch;
afterEach(() => {
  (global as any).fetch = realFetch;
  jest.useRealTimers();
});

describe('parseAyah', () => {
  it('numbers pass through, ranges keep a display label', () => {
    expect(parseAyah(13)).toEqual({ start: 13 });
    expect(parseAyah('7')).toEqual({ start: 7 });
    expect(parseAyah('5-6')).toEqual({ start: 5, label: '5-6' });
    expect(parseAyah('255 ')).toEqual({ start: 255 });
  });
  it('is safe on junk', () => {
    expect(parseAyah(undefined)).toEqual({ start: 1 });
    expect(parseAyah('abc')).toEqual({ start: 1 }); // junk never becomes a label
    expect(parseAyah('5 – 6')).toEqual({ start: 5, label: '5–6' });
    expect(parseAyah(0)).toEqual({ start: 1 });
    expect(parseAyah(NaN)).toEqual({ start: 1 });
  });
});

describe('parseApiResponse', () => {
  it('maps emotions and normalises verse ayah ranges to a number', () => {
    const r = parseApiResponse(GOOD_PAYLOAD)!;
    expect(r.emotions).toEqual([
      { emotion: 'sadness', confidence: 0.8 },
      { emotion: 'hope', confidence: 0.4 },
    ]);
    expect(r.verses[0].ayah).toBe(5); // number, safe for save/share
    expect(r.verses[0].ayahLabel).toBe('5-6'); // display keeps the range
    expect(r.verses[1].ayah).toBe(3);
    expect(r.verses[1].ayahLabel).toBeUndefined();
    expect(typeof r.verses[0].ayah).toBe('number');
  });

  it('rejects unusable payloads', () => {
    expect(parseApiResponse(null)).toBeNull();
    expect(parseApiResponse({})).toBeNull();
    expect(parseApiResponse({ predicted_emotions: [] })).toBeNull();
    expect(parseApiResponse({ predicted_emotions: 'sad' })).toBeNull();
  });

  it('tolerates missing scores and verses', () => {
    const r = parseApiResponse({ predicted_emotions: ['joy'] })!;
    expect(r.emotions[0]).toEqual({ emotion: 'joy', confidence: 0 });
    expect(r.verses).toEqual([]);
  });

  it('skips verses without a surah number', () => {
    const r = parseApiResponse({ ...GOOD_PAYLOAD, verses: [{ surah_name: 'x' }, GOOD_PAYLOAD.verses[1]] })!;
    expect(r.verses).toHaveLength(1);
  });
});

describe('local fallback', () => {
  const top = (t: string) => localFallbackAnalyze(t).emotions[0].emotion;

  it('English', () => {
    expect(top('I feel so sad and I cry every night')).toBe('sadness');
    expect(top('I am anxious and overwhelmed')).toBe('anxiety');
  });

  it('whole-word matching: "scared" is fear, not love ("care")', () => {
    const e = localFallbackAnalyze('I am scared').emotions.map((x) => x.emotion);
    expect(e).toContain('fear');
    expect(e).not.toContain('love');
  });

  it('"mission" does not match "miss"', () => {
    const e = localFallbackAnalyze('on a mission').emotions.map((x) => x.emotion);
    expect(e).not.toContain('love');
  });

  it('accepts common inflections', () => {
    expect(top('she is so loving and loved')).toBe('love');
  });

  it('Urdu script', () => {
    expect(top('میں بہت اداس ہوں')).toBe('sadness');
    expect(top('مجھے بہت ڈر لگ رہا ہے')).toBe('fear');
    expect(top('مجھے اپنے گناہوں پر توبہ کرنی ہے')).toBe('forgiveness');
  });

  it('Roman Urdu', () => {
    expect(top('main bohat pareshan hoon')).toBe('anxiety');
    expect(top('mujhe bohat gussa aa raha hai')).toBe('anger');
    expect(top('main akela hoon')).toBe('loneliness');
    expect(top('Allah ka shukar hai')).toBe('gratitude');
  });

  it('multi-word phrase', () => {
    expect(localFallbackAnalyze('mera dil toot gaya').emotions.map((e) => e.emotion)).toContain('sadness');
  });

  it('no match → generic guidance/peace, with verses', () => {
    const r = localFallbackAnalyze('qwerty asdf');
    expect(r.emotions.map((e) => e.emotion)).toEqual(['guidance', 'peace']);
    expect(r.verses.length).toBeGreaterThan(0);
  });

  it('normalizeText strips Latin and Arabic punctuation', () => {
    expect(normalizeText('Sad!!! ... اداس،')).toBe(' sad اداس ');
  });
});

describe('EmotionService.analyze — reliability', () => {
  it('success → source api, no fallback reason', async () => {
    (global as any).fetch = jest.fn(async () => ok(GOOD_PAYLOAD));
    const r = await EmotionService.analyze('I feel sad');
    expect(r.source).toBe('api');
    expect(r.fallbackReason).toBeUndefined();
    expect(r.verses[0].ayah).toBe(5);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('NEVER hangs: a connection that never answers settles within the total budget', async () => {
    jest.useFakeTimers();
    const f = hangingFetch();
    (global as any).fetch = f;

    const p = EmotionService.analyze('hello there');
    await jest.advanceTimersByTimeAsync(TOTAL_BUDGET_MS + 1000);
    const r = await p;

    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('timeout');
    expect(r.emotions.length).toBeGreaterThan(0);
    // At most one retry — the old code made 3 attempts of 30 s (~93 s).
    expect(f.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('a single attempt is bounded by ATTEMPT_TIMEOUT_MS', async () => {
    jest.useFakeTimers();
    const f = hangingFetch();
    (global as any).fetch = f;
    let settled = false;
    const p = EmotionService.analyze('x').then((r) => { settled = true; return r; });

    await jest.advanceTimersByTimeAsync(ATTEMPT_TIMEOUT_MS - 100);
    expect(settled).toBe(false); // still on attempt #1
    await jest.advanceTimersByTimeAsync(TOTAL_BUDGET_MS);
    await p;
    expect(settled).toBe(true);
  });

  it('settles even if fetch ignores the abort signal entirely', async () => {
    jest.useFakeTimers();
    (global as any).fetch = jest.fn(() => new Promise(() => {})); // never settles, never listens
    const p = EmotionService.analyze('hello');
    await jest.advanceTimersByTimeAsync(TOTAL_BUDGET_MS + 1000);
    const r = await p;
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('timeout');
  });

  it('settles even if the response BODY never resolves', async () => {
    jest.useFakeTimers();
    (global as any).fetch = jest.fn(async () => ({
      ok: true, status: 200, statusText: 'OK', json: () => new Promise(() => {}),
    }));
    const p = EmotionService.analyze('hello');
    await jest.advanceTimersByTimeAsync(TOTAL_BUDGET_MS + 1000);
    const r = await p;
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('timeout');
  });

  it('retries once on a 5xx and succeeds', async () => {
    jest.useFakeTimers();
    const f = jest.fn().mockResolvedValueOnce(bad(503)).mockResolvedValueOnce(ok(GOOD_PAYLOAD));
    (global as any).fetch = f;
    const p = EmotionService.analyze('sad');
    await jest.advanceTimersByTimeAsync(2000);
    const r = await p;
    expect(r.source).toBe('api');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 4xx', async () => {
    const f = jest.fn(async () => bad(400));
    (global as any).fetch = f;
    const r = await EmotionService.analyze('sad');
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('server');
  });

  it('a malformed payload falls back as "invalid" without retrying', async () => {
    const f = jest.fn(async () => ok({ nothing: true }));
    (global as any).fetch = f;
    const r = await EmotionService.analyze('sad');
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.fallbackReason).toBe('invalid');
  });

  it('a network error retries once then reports "network"', async () => {
    jest.useFakeTimers();
    const f = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    (global as any).fetch = f;
    const p = EmotionService.analyze('hello');
    await jest.advanceTimersByTimeAsync(3000);
    const r = await p;
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.fallbackReason).toBe('network');
  });

  it('the user can cancel: resolves immediately with local guidance, no retry', async () => {
    const f = hangingFetch();
    (global as any).fetch = f;
    const ctrl = new AbortController();
    const p = EmotionService.analyze('I feel sad', 5, 5, { signal: ctrl.signal });
    ctrl.abort();
    const r = await p;
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('cancelled');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('an already-aborted signal does not even wait', async () => {
    (global as any).fetch = hangingFetch();
    const ctrl = new AbortController();
    ctrl.abort();
    const r = await EmotionService.analyze('x', 5, 5, { signal: ctrl.signal });
    expect(r.fallbackReason).toBe('cancelled');
  });

  it('analyzeOffline is instant and local', () => {
    const r = EmotionService.analyzeOffline('I am lonely');
    expect(r.source).toBe('fallback');
    expect(r.emotions[0].emotion).toBe('loneliness');
  });
});

describe('EmotionService.warmUp', () => {
  it('true only when healthy and the model is loaded', async () => {
    (global as any).fetch = jest.fn(async () => ok({ status: 'healthy', model_loaded: true }));
    expect(await EmotionService.warmUp()).toBe(true);
    (global as any).fetch = jest.fn(async () => ok({ status: 'healthy', model_loaded: false }));
    expect(await EmotionService.warmUp()).toBe(false);
  });
  it('false (never throws) when unreachable', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await EmotionService.warmUp()).toBe(false);
  });
});
