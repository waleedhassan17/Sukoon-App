/**
 * Regression tests for the speech-recognition state machine.
 *
 * These lock in the two production bugs this module was rewritten to kill:
 *   1. The UI wedging on "Processing…" forever (a session that never delivers
 *      a terminal result, or a stop() on a dead session that answers nothing).
 *   2. A spurious "No speech detected" the instant the mic opens (late events
 *      from an aborted session leaking into its replacement, and `end` beating
 *      the trailing final `result`).
 *
 * The native module is mocked, so we drive the exact event orderings Android's
 * SpeechRecognizer produces.
 */

import type {
  SpeechRecognitionResult,
  SpeechRecognitionStatus,
} from '../lib/speechRecognitionService';

// ── Native module mock ─────────────────────────────────────────

type Listener = (payload: any) => void;
const listeners = new Map<string, Set<Listener>>();

const mockSpeechModule = {
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  isRecognitionAvailable: jest.fn(() => true),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  requestMicrophonePermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  addListener: jest.fn((event: string, cb: Listener) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(cb);
    return { remove: () => { listeners.get(event)?.delete(cb); } };
  }),
};

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: mockSpeechModule,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { speechRecognitionService } = require('../lib/speechRecognitionService');

// ── Helpers ────────────────────────────────────────────────────

/** Fire a native event at every currently-registered listener. */
function emitNative(event: string, payload: any = null): void {
  for (const cb of Array.from(listeners.get(event) ?? [])) cb(payload);
}

function resultEvent(transcript: string, isFinal: boolean) {
  return { isFinal, results: [{ transcript, confidence: 0.9, segments: [] }] };
}

/** Let queued promises settle, then advance fake timers. */
async function tick(ms = 0): Promise<void> {
  await Promise.resolve();
  await jest.advanceTimersByTimeAsync(ms);
}

/** Collector that records the callback stream for one session. */
function collector() {
  const results: SpeechRecognitionResult[] = [];
  const fn = (r: SpeechRecognitionResult) => { results.push(r); };
  const terminal = () => results.filter(
    (r) => (['success', 'error', 'unavailable', 'idle'] as SpeechRecognitionStatus[]).includes(r.status),
  );
  return { results, fn, terminal };
}

/** Start a session and run it up to the point where the mic is live. */
async function startAndReady(onResult: (r: SpeechRecognitionResult) => void) {
  const started = speechRecognitionService.startListening(onResult);
  await tick(500);          // permission promises + restart cooldown
  await started;
  emitNative('start');
  await tick(0);
}

// ── Setup ──────────────────────────────────────────────────────

beforeEach(async () => {
  jest.useFakeTimers();
  listeners.clear();
  jest.clearAllMocks();
  mockSpeechModule.isRecognitionAvailable.mockReturnValue(true);
  mockSpeechModule.getPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true } as any);
});

afterEach(async () => {
  await speechRecognitionService.cancelListening();
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════
// 1. The "stuck on Processing…" family
// ═══════════════════════════════════════════════════════════════

describe('terminal-result guarantee', () => {
  it('answers stopListening even when no session is running', async () => {
    const c = collector();

    await speechRecognitionService.stopListening(c.fn);

    // The old implementation returned silently here, leaving the caller's UI
    // pinned on "Processing…" with the submit button disabled.
    expect(c.terminal()).toHaveLength(1);
    expect(c.terminal()[0].status).toBe('idle');
    expect(c.terminal()[0].isFinal).toBe(true);
  });

  it('answers stopListening after the session already finished', async () => {
    const c = collector();
    await startAndReady(c.fn);

    emitNative('result', resultEvent('play surah rahman', true));
    await tick(0);
    expect(c.terminal()).toHaveLength(1);

    // User taps stop a beat late — must still release the UI.
    await speechRecognitionService.stopListening(c.fn);
    expect(c.terminal()).toHaveLength(2);
    expect(c.terminal()[1].status).toBe('idle');
  });

  it('force-terminates a session the recognizer abandons', async () => {
    const c = collector();
    await startAndReady(c.fn);

    emitNative('result', resultEvent('surah', false));
    await tick(0);

    // Native goes completely silent — no result, no error, no end.
    await tick(40000);

    const terminal = c.terminal();
    expect(terminal).toHaveLength(1);
    expect(terminal[0].isFinal).toBe(true);
    // Whatever we did capture is preferred over an error.
    expect(terminal[0].status).toBe('success');
    expect(terminal[0].text).toBe('surah');
    expect(mockSpeechModule.abort).toHaveBeenCalled();
  });

  it('delivers exactly one terminal result per session', async () => {
    const c = collector();
    await startAndReady(c.fn);

    // Android sprays several closing events at once.
    emitNative('result', resultEvent('open surah yaseen', true));
    emitNative('error', { error: 'no-speech', message: 'no speech' });
    emitNative('end');
    await tick(5000);

    expect(c.terminal()).toHaveLength(1);
    expect(c.terminal()[0]).toMatchObject({ status: 'success', text: 'open surah yaseen' });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. The spurious "No speech detected" family
// ═══════════════════════════════════════════════════════════════

describe('event-ordering races', () => {
  it('lets a trailing final result beat the end event', async () => {
    const c = collector();
    await startAndReady(c.fn);

    // `end` first, final `result` a moment later — the ordering that used to
    // produce "No speech detected" on top of a perfectly good transcript.
    emitNative('end');
    await tick(100);
    emitNative('result', resultEvent('play ayat ul kursi', true));
    await tick(2000);

    expect(c.terminal()).toHaveLength(1);
    expect(c.terminal()[0]).toMatchObject({ status: 'success', text: 'play ayat ul kursi' });
  });

  it('keeps interim text when the recognizer reports no-speech', async () => {
    const c = collector();
    await startAndReady(c.fn);

    emitNative('result', resultEvent('play surah mulk', false));
    await tick(0);
    emitNative('error', { error: 'no-speech', message: 'no speech' });
    await tick(0);

    expect(c.terminal()[0]).toMatchObject({ status: 'success', text: 'play surah mulk' });
  });

  it('never surfaces a user-facing error for a deliberate abort', async () => {
    const c = collector();
    await startAndReady(c.fn);

    const cancelled = speechRecognitionService.cancelListening();
    emitNative('error', { error: 'aborted', message: 'aborted' });
    emitNative('end');
    await tick(2000);
    await cancelled;

    expect(c.terminal()).toHaveLength(0);
    expect(c.results.some((r) => r.status === 'error')).toBe(false);
  });

  it('does not leak a dead session\'s events into its replacement', async () => {
    const first = collector();
    await startAndReady(first.fn);

    const second = collector();
    const restarting = speechRecognitionService.startListening(second.fn);

    // The old recognizer's teardown events arrive while the new one boots.
    emitNative('error', { error: 'aborted', message: 'aborted' });
    emitNative('end');

    await tick(500);
    await restarting;
    emitNative('start');
    await tick(0);

    // New session is listening, not dead on arrival.
    expect(second.terminal()).toHaveLength(0);
    expect(second.results.at(-1)).toMatchObject({ status: 'listening', ready: true });

    emitNative('result', resultEvent('play surah kahf', true));
    await tick(0);
    expect(second.terminal()[0]).toMatchObject({ status: 'success', text: 'play surah kahf' });

    // The abandoned session was never told anything terminal.
    expect(first.terminal()).toHaveLength(0);
  });

  it('reports an error when the mic never actually opens', async () => {
    const c = collector();
    const started = speechRecognitionService.startListening(c.fn);
    await tick(500);
    await started;

    // No `start` event ever arrives (recognizer wedged / service missing).
    await tick(8000);

    expect(c.terminal()).toHaveLength(1);
    expect(c.terminal()[0]).toMatchObject({ status: 'error', errorCode: 'start-failed' });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Normal operation
// ═══════════════════════════════════════════════════════════════

describe('happy path', () => {
  it('reports warming-up before the mic is live, then listening', async () => {
    const c = collector();
    const started = speechRecognitionService.startListening(c.fn);
    await tick(500);
    await started;

    expect(c.results[0]).toMatchObject({ status: 'listening', ready: false });

    emitNative('start');
    await tick(0);
    expect(c.results.at(-1)).toMatchObject({ status: 'listening', ready: true });
  });

  it('streams interim transcripts for live preview', async () => {
    const c = collector();
    await startAndReady(c.fn);

    emitNative('result', resultEvent('play', false));
    emitNative('result', resultEvent('play surah', false));
    await tick(0);

    const interim = c.results.filter((r) => r.status === 'listening' && r.text);
    expect(interim.map((r) => r.text)).toEqual(['play', 'play surah']);
    expect(c.terminal()).toHaveLength(0);
  });

  it('auto-finalizes with the interim text after the user stops talking', async () => {
    const c = collector();
    await startAndReady(c.fn);

    emitNative('result', resultEvent('play surah rahman ayah 13', false));
    await tick(0);

    // Silence → auto-stop; native then fails to produce a final result.
    await tick(3000);
    expect(mockSpeechModule.stop).toHaveBeenCalled();
    expect(c.results.some((r) => r.status === 'processing')).toBe(true);

    await tick(4000);
    expect(c.terminal()[0]).toMatchObject({
      status: 'success',
      text: 'play surah rahman ayah 13',
    });
  });

  it('errors once when nothing at all is said', async () => {
    const c = collector();
    await startAndReady(c.fn);

    await tick(12000);

    expect(c.terminal()).toHaveLength(1);
    expect(c.terminal()[0]).toMatchObject({ status: 'error', errorCode: 'no-speech' });
  });

  it('passes contextual hints and locale through to the recognizer', async () => {
    const c = collector();
    const started = speechRecognitionService.startListening(c.fn, {
      lang: 'en-GB',
      contextualStrings: ['Ar-Rahman'],
    });
    await tick(500);
    await started;

    expect(mockSpeechModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'en-GB',
        interimResults: true,
        contextualStrings: ['Ar-Rahman'],
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Preconditions
// ═══════════════════════════════════════════════════════════════

describe('preconditions', () => {
  it('fails fast and never listens when permission is denied', async () => {
    mockSpeechModule.getPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: true } as any);
    mockSpeechModule.requestPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: true } as any);
    mockSpeechModule.requestMicrophonePermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' } as any);

    const c = collector();
    const started = speechRecognitionService.startListening(c.fn);
    await tick(500);
    await started;

    expect(mockSpeechModule.start).not.toHaveBeenCalled();
    expect(c.terminal()).toHaveLength(1);
    expect(c.terminal()[0]).toMatchObject({ status: 'error', errorCode: 'not-allowed' });
  });

  it('flags a permanently blocked permission so the UI can offer Settings', async () => {
    mockSpeechModule.getPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false } as any);
    mockSpeechModule.requestPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false } as any);
    mockSpeechModule.requestMicrophonePermissionsAsync.mockRejectedValue(new Error('nope'));

    const c = collector();
    const started = speechRecognitionService.startListening(c.fn);
    await tick(500);
    await started;

    expect(c.terminal()[0]).toMatchObject({ status: 'error', errorCode: 'permission-blocked' });
  });

  it('reports unavailable when the device has no recognition service', async () => {
    mockSpeechModule.isRecognitionAvailable.mockReturnValue(false);

    const c = collector();
    const started = speechRecognitionService.startListening(c.fn);
    await tick(500);
    await started;

    expect(mockSpeechModule.start).not.toHaveBeenCalled();
    expect(c.terminal()[0]).toMatchObject({ status: 'unavailable' });
  });

  it('maps native error codes to human-readable messages', async () => {
    const c = collector();
    await startAndReady(c.fn);

    emitNative('error', { error: 'network', message: 'network failure' });
    await tick(0);

    const terminal = c.terminal()[0];
    expect(terminal.status).toBe('error');
    expect(terminal.errorCode).toBe('network');
    expect(terminal.error).toMatch(/connection/i);
    expect(terminal.error).not.toMatch(/network failure/); // not the raw native string
  });
});
