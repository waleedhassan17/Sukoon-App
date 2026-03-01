/**
 * Speech Recognition Service — Native On-Device (Production)
 *
 * Bulletproof speech recognition with:
 *   - Race-condition-proof stop/result delivery via session IDs
 *   - Interim transcript forwarding for live preview
 *   - Clean lifecycle: start → listening → (stop) → processing → success/error → idle
 *   - Single-delivery guarantee (resolved flag prevents duplicate callbacks)
 *   - Automatic cleanup on session expiry
 *
 * Platform: expo-speech-recognition
 *   - Android: Google SpeechRecognizer (on-device)
 *   - iOS: SFSpeechRecognizer (on-device)
 */

import { Platform } from 'react-native';

// ══════════════════════════════════════════════
// LAZY LOAD
// ══════════════════════════════════════════════

let SpeechModule: any = null;
try {
  const pkg = require('expo-speech-recognition');
  SpeechModule = pkg.ExpoSpeechRecognitionModule;
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

export interface SpeechRecognitionResult {
  status: SpeechRecognitionStatus;
  text: string;
  error?: string;
  isFinal: boolean;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

class SpeechRecognitionService {
  private isListening = false;
  private sessionId = 0;           // Incremented per session; prevents stale callbacks
  private resolved = false;        // true once a final result/error is delivered — blocks duplicates
  private lastInterimText = '';    // Latest partial transcript for live preview
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;  // Auto-stop after 3s of silence
  private currentCallback: ((r: SpeechRecognitionResult) => void) | null = null;
  private subs: Array<{ remove: () => void }> = [];

  isAvailable(): boolean { return !!SpeechModule; }

  // ── PERMISSIONS ──

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
      if (result.granted === true || result.status === 'granted') return true;

      try {
        const micResult = await SpeechModule.requestMicrophonePermissionsAsync();
        if (micResult.granted === true || micResult.status === 'granted') return true;
      } catch {}

      if (result.canAskAgain === false) throw new Error('PERMISSION_DENIED_PERMANENTLY');
      return false;
    } catch (e: any) {
      if (e?.message === 'PERMISSION_DENIED_PERMANENTLY') throw e;
      if (__DEV__) console.warn('[Speech] requestPermission error:', e);
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
      return result.granted === true || result.status === 'granted';
    } catch { return false; }
  }

  // ── START LISTENING ──

  async startListening(
    onResult: (result: SpeechRecognitionResult) => void,
  ): Promise<void> {
    // Prevent overlapping sessions
    if (this.isListening) {
      await this.cancelListening();
    }

    if (!SpeechModule) {
      onResult({
        status: 'unavailable', text: '',
        error: 'Voice input requires a development build. Please type your message instead.',
        isFinal: true,
      });
      return;
    }

    // ── New session ──
    this.sessionId++;
    const sid = this.sessionId;
    this.isListening = true;
    this.resolved = false;
    this.lastInterimText = '';
    this.currentCallback = onResult;

    onResult({ status: 'listening', text: '', isFinal: false });

    // Helper: deliver a final result exactly once per session
    const deliverFinal = (result: SpeechRecognitionResult) => {
      if (this.resolved || sid !== this.sessionId) return; // stale or already resolved
      this.resolved = true;
      this.isListening = false;
      this.clearAllTimers();
      this.removeListeners();
      this.currentCallback = null;
      onResult(result);
    };

    try {
      this.removeListeners();

      // ── RESULT event ──
      this.subs.push(
        SpeechModule.addListener('result', (event: any) => {
          if (sid !== this.sessionId) return; // stale session
          const results = event.results;
          if (!results || results.length === 0) return;

          const transcript = results[0]?.transcript || '';
          const isFinal = event.isFinal === true;

          if (isFinal) {
            deliverFinal({
              status: 'success',
              text: transcript.trim(),
              isFinal: true,
            });
          } else {
            // Forward interim text for live preview
            this.lastInterimText = transcript;
            if (!this.resolved) {
              onResult({
                status: 'listening',
                text: transcript,
                isFinal: false,
              });

              // ── Silence detection: reset 3s auto-stop on every new interim result ──
              this.resetSilenceTimer(sid, onResult);
            }
          }
        }),
      );

      // ── ERROR event ──
      this.subs.push(
        SpeechModule.addListener('error', (event: any) => {
          if (sid !== this.sessionId) return;
          const errorMsg = event.error || event.message || 'Speech recognition error';
          const isNoSpeech = typeof errorMsg === 'string' &&
            (errorMsg.includes('no-speech') || errorMsg.includes('No speech'));

          deliverFinal({
            status: 'error',
            text: '',
            error: isNoSpeech
              ? 'No speech detected. Please try again.'
              : (typeof errorMsg === 'string' ? errorMsg : 'Speech recognition error'),
            isFinal: true,
          });
        }),
      );

      // ── END event — fires AFTER result/error; acts as cleanup backstop ──
      this.subs.push(
        SpeechModule.addListener('end', () => {
          if (sid !== this.sessionId || this.resolved) return;
          // END fired without a result → no speech captured
          deliverFinal({
            status: 'error',
            text: '',
            error: 'No speech detected. Please try again.',
            isFinal: true,
          });
        }),
      );

      // Start the recognizer
      SpeechModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });

      // Safety: auto-stop after 15s of continuous listening
      this.safetyTimer = setTimeout(() => {
        if (this.isListening && sid === this.sessionId && !this.resolved) {
          this.stopListening(onResult).catch(() => {});
        }
      }, 15000);

    } catch (err) {
      deliverFinal({
        status: 'error',
        text: '',
        error: err instanceof Error ? err.message : 'Failed to start speech recognition',
        isFinal: true,
      });
    }
  }

  // ── STOP LISTENING (user taps stop) ──

  async stopListening(
    onResult: (result: SpeechRecognitionResult) => void,
  ): Promise<void> {
    if (!this.isListening || this.resolved) return;
    this.clearAllTimers();

    const sid = this.sessionId;

    // Show processing state with interim text so UI stays informative
    onResult({
      status: 'processing',
      text: this.lastInterimText,
      isFinal: false,
    });

    try {
      if (SpeechModule) {
        // .stop() asks native recognizer to finalize — it should fire 'result' with isFinal=true
        SpeechModule.stop();
      }
    } catch {
      // Already stopped
    }

    // Fallback: if native doesn't deliver a final within 3s, use interim text or error
    this.fallbackTimer = setTimeout(() => {
      if (sid !== this.sessionId || this.resolved) return;

      if (this.lastInterimText.trim()) {
        // We have partial text — deliver it as success
        const deliverFinal = (result: SpeechRecognitionResult) => {
          if (this.resolved || sid !== this.sessionId) return;
          this.resolved = true;
          this.isListening = false;
          this.removeListeners();
          this.currentCallback = null;
          onResult(result);
        };
        deliverFinal({
          status: 'success',
          text: this.lastInterimText.trim(),
          isFinal: true,
        });
      } else {
        // No text at all
        const deliverFinal = (result: SpeechRecognitionResult) => {
          if (this.resolved || sid !== this.sessionId) return;
          this.resolved = true;
          this.isListening = false;
          this.removeListeners();
          this.currentCallback = null;
          onResult(result);
        };
        deliverFinal({
          status: 'error',
          text: '',
          error: 'No speech detected. Please try again.',
          isFinal: true,
        });
      }
    }, 3000);
  }

  // ── CANCEL (unmount / new session) ──

  async cancelListening(): Promise<void> {
    this.resolved = true; // Block any pending callbacks
    this.isListening = false;
    this.clearAllTimers();
    this.removeListeners();
    this.currentCallback = null;
    this.lastInterimText = '';

    try {
      if (SpeechModule) SpeechModule.abort();
    } catch {}
  }

  // ── HELPERS ──

  /**
   * Silence detection: after the user stops speaking for 3s,
   * automatically trigger stopListening to finalize the result.
   * Resets on every interim transcript so it only fires after a true pause.
   */
  private resetSilenceTimer(
    sid: number,
    onResult: (r: SpeechRecognitionResult) => void,
  ): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    this.silenceTimer = setTimeout(() => {
      if (this.isListening && sid === this.sessionId && !this.resolved) {
        this.stopListening(onResult).catch(() => {});
      }
    }, 3000);
  }

  private clearAllTimers(): void {
    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = null; }
    if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
  }

  private removeListeners(): void {
    for (const sub of this.subs) { try { sub.remove(); } catch {} }
    this.subs = [];
  }
}

// ══════════════════════════════════════════════
// SINGLETON
// ══════════════════════════════════════════════

export const speechRecognitionService = new SpeechRecognitionService();
export default speechRecognitionService;
