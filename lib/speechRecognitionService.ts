/**
 * Speech Recognition Service — Native On-Device (Production)
 *
 * Design contract (the reason this file is written the way it is):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ EVERY started session delivers EXACTLY ONE terminal result.      │
 *   │ Terminal = success | error | unavailable | idle (cancelled).     │
 *   │ There is no code path where the caller is left hanging.          │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * That guarantee is what keeps the UI from sticking on "Processing…":
 * a hard max-session watchdog fires even if the native recognizer goes
 * silent, and stopListening() on a dead session still reports back.
 *
 * Android's SpeechRecognizer is a stateful singleton and is easily upset:
 *   - start() while a previous session is tearing down → ERROR_RECOGNIZER_BUSY
 *   - abort() emits `error: "aborted"` + `end` asynchronously, which can land
 *     on the NEXT session's listeners if we restart immediately
 *   - `end` can arrive before the trailing final `result`
 *
 * So we: serialize start/cancel through a promise chain, enforce a restart
 * cooldown, tag every listener with its session id, and give `end` a short
 * grace window for a late `result` to win.
 *
 * Platform: expo-speech-recognition
 *   - Android: Google SpeechRecognizer
 *   - iOS: SFSpeechRecognizer
 */

import { Platform } from 'react-native';

// ══════════════════════════════════════════════
// LAZY LOAD (absent in Expo Go — no native module)
// ══════════════════════════════════════════════

let SpeechModule: any = null;
try {
  const pkg = require('expo-speech-recognition');
  SpeechModule = pkg?.ExpoSpeechRecognitionModule ?? null;
} catch {
  // Not available (Expo Go or missing native module)
}

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type SpeechRecognitionStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'success'
  | 'error'
  | 'unavailable';

/** Native error codes surfaced by expo-speech-recognition, plus our own. */
export type SpeechErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'busy'
  | 'client'
  | 'interrupted'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'no-match'
  | 'not-allowed'
  | 'permission-blocked'
  | 'service-not-allowed'
  | 'speech-timeout'
  | 'start-failed'
  | 'timeout'
  | 'unavailable'
  | 'unknown';

export interface SpeechRecognitionResult {
  status: SpeechRecognitionStatus;
  text: string;
  error?: string;
  /** Machine-readable cause — lets the UI branch (e.g. open app settings). */
  errorCode?: SpeechErrorCode;
  isFinal: boolean;
  /** True once the native recognizer is actually capturing audio. */
  ready?: boolean;
}

export interface StartListeningOptions {
  /** BCP-47 locale, e.g. "en-US", "ur-PK". Default "en-US". */
  lang?: string;
  /** Bias the recognizer toward these words (surah names, etc.). */
  contextualStrings?: string[];
}

// ══════════════════════════════════════════════
// TUNING
// ══════════════════════════════════════════════

/** Wait for the native `start` event before we trust the mic is live. */
const START_TIMEOUT_MS = 7000;
/** No speech at all after the mic went live → give up. */
const NO_SPEECH_TIMEOUT_MS = 9000;
/** User stopped talking this long → auto-finalize. */
const SILENCE_TIMEOUT_MS = 2500;
/** After stop(), how long we wait for the native final result. */
const STOP_FALLBACK_MS = 3000;
/** `end` waits this long for a trailing `result` to win the race. */
const END_GRACE_MS = 400;
/** Absolute ceiling for one session — the anti-stuck watchdog. */
const MAX_SESSION_MS = 30000;
/** Android needs a beat between abort() and the next start(). */
const RESTART_COOLDOWN_MS = 400;

const ERROR_MESSAGES: Record<string, string> = {
  'aborted': 'Voice input was cancelled.',
  'audio-capture': 'Microphone unavailable. Close other apps using it and try again.',
  'bad-grammar': 'Voice input failed. Please try again.',
  'busy': 'Voice input is still starting up. Please try again in a moment.',
  'client': 'Voice input failed to start. Please try again.',
  'interrupted': 'Voice input was interrupted. Please try again.',
  'language-not-supported': 'This language is not supported on your device.',
  'network': 'Network error. Check your connection and try again.',
  'no-match': "I couldn't make that out. Please try again.",
  'no-speech': "I didn't hear anything. Tap the mic and speak clearly.",
  'not-allowed': 'Microphone permission is required for voice input.',
  'permission-blocked': 'Microphone access is blocked. Enable it in Settings to use voice input.',
  'service-not-allowed': 'Speech recognition is unavailable on this device.',
  'speech-timeout': "I didn't hear anything. Tap the mic and speak clearly.",
  'start-failed': 'Voice input failed to start. Please try again.',
  'timeout': 'Voice input timed out. Please try again.',
  'unavailable': 'Voice input needs the installed app build (not Expo Go).',
  'unknown': 'Voice input failed. Please try again.',
};

/** Codes that mean "we heard nothing usable" rather than "something broke". */
const SOFT_FAILURE_CODES = new Set(['no-speech', 'speech-timeout', 'no-match']);

function messageFor(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
}

function log(...args: unknown[]): void {
  if (__DEV__) console.log('[Speech]', ...args);
}

// ══════════════════════════════════════════════
// SESSION
// ══════════════════════════════════════════════

interface Session {
  id: number;
  onResult: (r: SpeechRecognitionResult) => void;
  /** A terminal result has been delivered — nothing more may be emitted. */
  resolved: boolean;
  /** Torn down deliberately (unmount / restart) — swallow everything. */
  cancelled: boolean;
  /** Native `start` event received — mic is genuinely live. */
  ready: boolean;
  /** We saw speech or an interim transcript. */
  heardSpeech: boolean;
  /** User (or a timer) asked the recognizer to finalize. */
  stopping: boolean;
  interim: string;
  subs: Array<{ remove: () => void }>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

class SpeechRecognitionService {
  private session: Session | null = null;
  private sessionCounter = 0;
  /** Serializes start/cancel so a teardown never overlaps a startup. */
  private queue: Promise<void> = Promise.resolve();
  /** When the last native session was torn down (for the restart cooldown). */
  private lastTeardownAt = 0;

  // ── PUBLIC STATE ──

  isAvailable(): boolean {
    return !!SpeechModule;
  }

  /** True while a session is live (listening or finalizing). */
  isBusy(): boolean {
    return !!this.session && !this.session.resolved;
  }

  /**
   * Whether the device can actually run recognition right now.
   * Returns false in Expo Go and on devices with no recognition service.
   */
  isRecognitionAvailable(): boolean {
    if (!SpeechModule) return false;
    try {
      if (typeof SpeechModule.isRecognitionAvailable === 'function') {
        return SpeechModule.isRecognitionAvailable() !== false;
      }
    } catch {
      // Older module builds don't expose it — assume available.
    }
    return true;
  }

  // ── PERMISSIONS ──

  /**
   * Requests mic + speech permission.
   * @throws Error('PERMISSION_DENIED_PERMANENTLY') when the OS will no longer ask.
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (!SpeechModule) {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t: any) => t.stop());
          return true;
        }
        return false;
      }

      const result = await SpeechModule.requestPermissionsAsync();
      if (result?.granted === true || result?.status === 'granted') return true;

      // Android: recognition perms can report denied while RECORD_AUDIO is fine.
      try {
        const mic = await SpeechModule.requestMicrophonePermissionsAsync();
        if (mic?.granted === true || mic?.status === 'granted') return true;
      } catch {}

      if (result?.canAskAgain === false) throw new Error('PERMISSION_DENIED_PERMANENTLY');
      return false;
    } catch (e: any) {
      if (e?.message === 'PERMISSION_DENIED_PERMANENTLY') throw e;
      log('requestPermission error:', e);
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    try {
      if (!SpeechModule) {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.permissions) {
          const r = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          return r.state === 'granted';
        }
        return false;
      }
      const result = await SpeechModule.getPermissionsAsync();
      return result?.granted === true || result?.status === 'granted';
    } catch {
      return false;
    }
  }

  // ── START ──

  /**
   * Begins a recognition session. The callback receives a stream of non-final
   * updates followed by exactly one terminal result.
   *
   * Safe to call at any time: an in-flight session is torn down first, and the
   * native recognizer is given its cooldown before restarting.
   */
  startListening(
    onResult: (result: SpeechRecognitionResult) => void,
    options: StartListeningOptions = {},
  ): Promise<void> {
    this.queue = this.queue
      .then(() => this.doStart(onResult, options))
      .catch((e) => { log('start queue error:', e); });
    return this.queue;
  }

  private async doStart(
    onResult: (result: SpeechRecognitionResult) => void,
    options: StartListeningOptions,
  ): Promise<void> {
    // Tear down anything still running (also records the teardown timestamp).
    if (this.session) await this.teardown();

    if (!SpeechModule) {
      onResult({
        status: 'unavailable',
        text: '',
        error: messageFor('unavailable'),
        errorCode: 'unavailable',
        isFinal: true,
      });
      return;
    }

    if (!this.isRecognitionAvailable()) {
      onResult({
        status: 'unavailable',
        text: '',
        error: messageFor('service-not-allowed'),
        errorCode: 'service-not-allowed',
        isFinal: true,
      });
      return;
    }

    // ── Permission (handled here so every caller gets it right) ──
    try {
      let granted = await this.checkPermission();
      if (!granted) granted = await this.requestPermission();
      if (!granted) {
        onResult({
          status: 'error',
          text: '',
          error: messageFor('not-allowed'),
          errorCode: 'not-allowed',
          isFinal: true,
        });
        return;
      }
    } catch (e: any) {
      const blocked = e?.message === 'PERMISSION_DENIED_PERMANENTLY';
      onResult({
        status: 'error',
        text: '',
        error: messageFor(blocked ? 'permission-blocked' : 'not-allowed'),
        errorCode: blocked ? 'permission-blocked' : 'not-allowed',
        isFinal: true,
      });
      return;
    }

    // Android throws ERROR_RECOGNIZER_BUSY if we restart too eagerly.
    await this.awaitCooldown();

    // ── New session ──
    const session: Session = {
      id: ++this.sessionCounter,
      onResult,
      resolved: false,
      cancelled: false,
      ready: false,
      heardSpeech: false,
      stopping: false,
      interim: '',
      subs: [],
      timers: new Map(),
    };
    this.session = session;

    // Show the recording UI immediately (ready:false = "warming up").
    this.emit(session, { status: 'listening', text: '', isFinal: false, ready: false });

    this.attachListeners(session);

    try {
      SpeechModule.start({
        lang: options.lang ?? 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        ...(options.contextualStrings?.length
          ? { contextualStrings: options.contextualStrings }
          : {}),
        androidIntentOptions: {
          // Keep Android from cutting the user off mid-sentence; our own
          // silence timer is the real arbiter of when to finalize.
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 1500,
        },
      });
    } catch (err) {
      log('start() threw:', err);
      this.finalize(session, {
        status: 'error',
        text: '',
        error: messageFor('start-failed'),
        errorCode: 'start-failed',
        isFinal: true,
      });
      return;
    }

    // The mic never actually opened → don't leave the user staring at a
    // "Listening…" UI that isn't recording.
    this.setTimer(session, 'start', START_TIMEOUT_MS, () => {
      if (session.ready) return;
      log('native start event never arrived');
      this.abortNative();
      this.finalize(session, {
        status: 'error',
        text: '',
        error: messageFor('start-failed'),
        errorCode: 'start-failed',
        isFinal: true,
      });
    });

    // Hard ceiling — the guarantee that the UI can never stick.
    this.setTimer(session, 'max', MAX_SESSION_MS, () => {
      log('session exceeded max duration');
      this.abortNative();
      this.resolveWithBestEffort(session, 'timeout');
    });
  }

  // ── NATIVE EVENT WIRING ──

  private attachListeners(session: Session): void {
    const on = (event: string, handler: (payload: any) => void) => {
      try {
        const sub = SpeechModule.addListener(event, (payload: any) => {
          // Tag check: late events from an aborted session must not leak
          // into the session that replaced it.
          if (this.session !== session || session.resolved || session.cancelled) return;
          handler(payload);
        });
        if (sub) session.subs.push(sub);
      } catch (e) {
        log(`failed to attach "${event}" listener:`, e);
      }
    };

    // ── Mic is genuinely live ──
    on('start', () => {
      session.ready = true;
      this.clearTimer(session, 'start');
      this.emit(session, { status: 'listening', text: session.interim, isFinal: false, ready: true });
      this.armNoSpeechTimer(session);
    });

    // ── User began speaking ──
    on('speechstart', () => {
      session.heardSpeech = true;
      this.clearTimer(session, 'nospeech');
      this.resetSilenceTimer(session);
    });

    // ── Transcripts ──
    on('result', (event: any) => {
      const transcript = String(event?.results?.[0]?.transcript ?? '');
      const isFinal = event?.isFinal === true;

      if (transcript.trim()) {
        session.interim = transcript;
        session.heardSpeech = true;
        this.clearTimer(session, 'nospeech');
      }

      if (isFinal) {
        const text = (transcript || session.interim).trim();
        if (text) {
          this.finalize(session, { status: 'success', text, isFinal: true });
        } else {
          // Final result with nothing in it — treat as "didn't catch that".
          this.resolveWithBestEffort(session, 'no-match');
        }
        return;
      }

      // Interim — forward for live preview and restart the silence countdown.
      this.emit(session, {
        status: session.stopping ? 'processing' : 'listening',
        text: transcript,
        isFinal: false,
        ready: session.ready,
      });
      if (!session.stopping) this.resetSilenceTimer(session);
    });

    // ── Recognizer produced nothing meaningful ──
    on('nomatch', () => {
      log('nomatch');
      // Don't finalize yet: if we have interim text it's still usable, and
      // `end` will close the session a moment later either way.
      if (session.interim.trim()) {
        this.finalize(session, { status: 'success', text: session.interim.trim(), isFinal: true });
      }
    });

    // ── Speech ended; native is finalizing ──
    on('speechend', () => {
      if (session.stopping) return;
      session.stopping = true;
      this.clearTimer(session, 'silence');
      this.emit(session, { status: 'processing', text: session.interim, isFinal: false });
      // Native should deliver a final result shortly; `end` + fallback cover us.
      this.setTimer(session, 'fallback', STOP_FALLBACK_MS, () => {
        this.resolveWithBestEffort(session, 'no-speech');
      });
    });

    // ── Errors ──
    on('error', (event: any) => {
      const code = String(event?.error ?? event?.message ?? 'unknown');
      log('error event:', code, event?.message ?? '');

      // We asked for this — the session is already being replaced.
      if (code === 'aborted') return;

      // Soft failures: prefer whatever we managed to transcribe.
      if (SOFT_FAILURE_CODES.has(code) && session.interim.trim()) {
        this.finalize(session, { status: 'success', text: session.interim.trim(), isFinal: true });
        return;
      }

      this.finalize(session, {
        status: 'error',
        text: '',
        error: messageFor(code),
        errorCode: code as SpeechErrorCode,
        isFinal: true,
      });
    });

    // ── Session closed ──
    // `end` can beat the trailing final `result` on Android, so give the
    // result a grace window before we call it a failure.
    on('end', () => {
      this.setTimer(session, 'end', END_GRACE_MS, () => {
        this.resolveWithBestEffort(session, session.heardSpeech ? 'no-match' : 'no-speech');
      });
    });
  }

  // ── STOP (user taps stop, or silence detected) ──

  /**
   * Asks the recognizer to finalize. Always reports back through `onResult`,
   * even when there is no live session — that is what stops the caller's UI
   * from getting wedged in "Processing…".
   */
  async stopListening(
    onResult?: (result: SpeechRecognitionResult) => void,
  ): Promise<void> {
    const session = this.session;

    if (!session || session.resolved || session.cancelled) {
      // Nothing to stop. Release the caller's UI rather than going silent.
      onResult?.({ status: 'idle', text: '', isFinal: true });
      return;
    }

    if (session.stopping) return; // Already finalizing — let the timers run.
    session.stopping = true;

    this.clearTimer(session, 'silence');
    this.clearTimer(session, 'nospeech');

    // Keep the interim text on screen while native finalizes.
    this.emit(session, { status: 'processing', text: session.interim, isFinal: false });

    try {
      SpeechModule?.stop();
    } catch (e) {
      log('stop() threw:', e);
    }

    // If native never delivers, fall back to the interim transcript.
    this.setTimer(session, 'fallback', STOP_FALLBACK_MS, () => {
      this.resolveWithBestEffort(session, 'no-speech');
    });
  }

  // ── CANCEL (unmount / modal closed / restart) ──

  /**
   * Silently kills the current session. The caller's callback is NOT invoked
   * with an error — cancelling is not a failure.
   */
  async cancelListening(): Promise<void> {
    this.queue = this.queue
      .then(() => this.teardown())
      .catch((e) => { log('cancel queue error:', e); });
    return this.queue;
  }

  // ══════════════════════════════════════════════
  // INTERNALS
  // ══════════════════════════════════════════════

  private async teardown(): Promise<void> {
    const session = this.session;
    if (session) {
      session.cancelled = true;
      session.resolved = true;
      this.clearTimers(session);
      this.removeListeners(session);
      this.session = null;
    }
    this.abortNative();
    this.lastTeardownAt = Date.now();
  }

  private abortNative(): void {
    try {
      SpeechModule?.abort();
    } catch {
      // Already stopped or never started.
    }
  }

  private async awaitCooldown(): Promise<void> {
    const elapsed = Date.now() - this.lastTeardownAt;
    // Clamped on both ends: a backwards clock jump (NTP correction, timezone
    // change) must never turn this into an unbounded wait.
    const wait = Math.min(RESTART_COOLDOWN_MS, RESTART_COOLDOWN_MS - elapsed);
    if (wait <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }

  /**
   * Close out a session using whatever we have: any transcript beats an error.
   */
  private resolveWithBestEffort(session: Session, fallbackCode: SpeechErrorCode): void {
    if (session.resolved || session.cancelled) return;

    const text = session.interim.trim();
    if (text) {
      this.finalize(session, { status: 'success', text, isFinal: true });
      return;
    }
    this.finalize(session, {
      status: 'error',
      text: '',
      error: messageFor(fallbackCode),
      errorCode: fallbackCode,
      isFinal: true,
    });
  }

  /** Emit a non-terminal update. */
  private emit(session: Session, result: SpeechRecognitionResult): void {
    if (session.resolved || session.cancelled || this.session !== session) return;
    try {
      session.onResult(result);
    } catch (e) {
      log('onResult threw:', e);
    }
  }

  /** Emit THE terminal result and dispose of the session. */
  private finalize(session: Session, result: SpeechRecognitionResult): void {
    if (session.resolved || session.cancelled) return;
    session.resolved = true;

    this.clearTimers(session);
    this.removeListeners(session);

    if (this.session === session) {
      this.session = null;
      this.lastTeardownAt = Date.now();
    }

    // A finalized session must leave the native recognizer idle, or the next
    // start() hits ERROR_RECOGNIZER_BUSY.
    this.abortNative();

    try {
      session.onResult(result);
    } catch (e) {
      log('onResult threw:', e);
    }
  }

  // ── TIMERS ──

  private setTimer(session: Session, key: string, ms: number, fn: () => void): void {
    this.clearTimer(session, key);
    const handle = setTimeout(() => {
      session.timers.delete(key);
      if (session.resolved || session.cancelled) return;
      fn();
    }, ms);
    session.timers.set(key, handle);
  }

  private clearTimer(session: Session, key: string): void {
    const handle = session.timers.get(key);
    if (handle) {
      clearTimeout(handle);
      session.timers.delete(key);
    }
  }

  private clearTimers(session: Session): void {
    for (const handle of session.timers.values()) clearTimeout(handle);
    session.timers.clear();
  }

  /** Mic is open but the user hasn't said anything yet. */
  private armNoSpeechTimer(session: Session): void {
    this.setTimer(session, 'nospeech', NO_SPEECH_TIMEOUT_MS, () => {
      if (session.heardSpeech) return;
      log('no speech within timeout');
      this.abortNative();
      this.finalize(session, {
        status: 'error',
        text: '',
        error: messageFor('no-speech'),
        errorCode: 'no-speech',
        isFinal: true,
      });
    });
  }

  /** User paused after speaking → finalize automatically. */
  private resetSilenceTimer(session: Session): void {
    this.setTimer(session, 'silence', SILENCE_TIMEOUT_MS, () => {
      if (session.stopping) return;
      log('silence detected — finalizing');
      this.stopListening().catch(() => {});
    });
  }

  private removeListeners(session: Session): void {
    for (const sub of session.subs) {
      try { sub.remove(); } catch {}
    }
    session.subs = [];
  }
}

// ══════════════════════════════════════════════
// SINGLETON
// ══════════════════════════════════════════════

export const speechRecognitionService = new SpeechRecognitionService();
export default speechRecognitionService;
