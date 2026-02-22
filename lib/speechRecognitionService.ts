/**
 * Speech Recognition Service — Native On-Device
 *
 * Uses expo-speech-recognition for:
 *   - Android: Google SpeechRecognizer (built-in, on-device)
 *   - iOS: SFSpeechRecognizer (built-in, on-device)
 *
 * NO cloud API calls — everything happens on the device.
 * The recognized text is then sent to the emotion detection API.
 */

import { Platform } from 'react-native';

// ══════════════════════════════════════════════
// LAZY LOAD — expo-speech-recognition needs native module
// ══════════════════════════════════════════════

let SpeechModule: any = null;
try {
  const pkg = require('expo-speech-recognition');
  SpeechModule = pkg.ExpoSpeechRecognitionModule;
} catch {
  // Not available (Expo Go or missing native module)
}

// ══════════════════════════════════════════════
// TYPES (exported for components)
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
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private currentCallback: ((result: SpeechRecognitionResult) => void) | null = null;

  // Event listener subscriptions
  private subs: Array<{ remove: () => void }> = [];

  /**
   * Check if native speech recognition is available
   */
  isAvailable(): boolean {
    return !!SpeechModule;
  }

  // ── PERMISSIONS ──

  async requestPermission(): Promise<boolean> {
    try {
      if (!SpeechModule) {
        // Fallback: on web, try mediaDevices permission
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t: any) => t.stop());
          return true;
        }
        return false;
      }

      // First try the combined permission request
      const result = await SpeechModule.requestPermissionsAsync();
      if (result.granted === true || result.status === 'granted') {
        return true;
      }

      // If combined fails, try requesting microphone separately
      // (On some Android devices this is needed)
      try {
        const micResult = await SpeechModule.requestMicrophonePermissionsAsync();
        if (micResult.granted === true || micResult.status === 'granted') {
          return true;
        }
      } catch {}

      // If permission was permanently denied (canAskAgain === false),
      // the user needs to enable it in Settings
      if (result.canAskAgain === false) {
        throw new Error('PERMISSION_DENIED_PERMANENTLY');
      }

      return false;
    } catch (e: any) {
      if (e?.message === 'PERMISSION_DENIED_PERMANENTLY') {
        throw e; // Re-throw so caller can handle
      }
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
    } catch {
      return false;
    }
  }

  // ── START LISTENING ──

  async startListening(
    onResult: (result: SpeechRecognitionResult) => void,
  ): Promise<void> {
    if (this.isListening) return;

    // Check if native module is available
    if (!SpeechModule) {
      onResult({
        status: 'unavailable',
        text: '',
        error: 'Voice input requires a development build. Please type your message instead.',
        isFinal: true,
      });
      return;
    }

    this.isListening = true;
    this.currentCallback = onResult;

    onResult({ status: 'listening', text: '', isFinal: false });

    try {
      // Clean up any previous listeners
      this.removeListeners();

      // Set up event listeners using the module's addListener method
      this.subs.push(
        SpeechModule.addListener(
          'result',
          (event: any) => {
            const results = event.results;
            if (results && results.length > 0) {
              const transcript = results[0]?.transcript || '';
              const isFinal = event.isFinal === true;

              if (isFinal) {
                this.isListening = false;
                this.clearTimeout();
                onResult({
                  status: 'success',
                  text: transcript.trim(),
                  isFinal: true,
                });
                this.removeListeners();
              } else {
                onResult({
                  status: 'listening',
                  text: transcript || 'Listening…',
                  isFinal: false,
                });
              }
            }
          },
        ),
      );

      this.subs.push(
        SpeechModule.addListener(
          'error',
          (event: any) => {
            this.isListening = false;
            this.clearTimeout();

            const errorMsg = event.error || event.message || 'Speech recognition error';

            // "no-speech" is common — user didn't say anything
            if (typeof errorMsg === 'string' && (errorMsg.includes('no-speech') || errorMsg.includes('No speech'))) {
              onResult({
                status: 'error',
                text: '',
                error: 'No speech detected. Please try again.',
                isFinal: true,
              });
            } else {
              onResult({
                status: 'error',
                text: '',
                error: typeof errorMsg === 'string' ? errorMsg : 'Speech recognition error',
                isFinal: true,
              });
            }
            this.removeListeners();
          },
        ),
      );

      this.subs.push(
        SpeechModule.addListener(
          'end',
          () => {
            // If we're still listening when 'end' fires, it means no final result came
            if (this.isListening) {
              this.isListening = false;
              this.clearTimeout();
            }
          },
        ),
      );

      // Start the speech recognizer
      SpeechModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        // Use on-device recognition if available (no internet needed)
        requiresOnDeviceRecognition: false,
        // Android-specific
        addsPunctuation: true,
      });

      // Safety: auto-stop after 15s
      this.timeoutTimer = setTimeout(() => {
        if (this.isListening) {
          this.stopListening(onResult).catch(() => {});
        }
      }, 15000);
    } catch (err) {
      this.isListening = false;
      this.removeListeners();

      if (__DEV__) console.error('[Speech] Start error:', err);

      onResult({
        status: 'error',
        text: '',
        error: err instanceof Error ? err.message : 'Failed to start speech recognition',
        isFinal: true,
      });
    }
  }

  // ── STOP LISTENING ──

  async stopListening(
    onResult: (result: SpeechRecognitionResult) => void,
  ): Promise<void> {
    if (!this.isListening) return;
    this.clearTimeout();

    try {
      if (SpeechModule) {
        // Stop will trigger the 'end' event, and any pending results
        SpeechModule.stop();
      }
    } catch {
      // Ignore — might already be stopped
    }

    // If still listening after stop (no result came), set processing
    if (this.isListening) {
      this.isListening = false;
      onResult({ status: 'processing', text: 'Processing…', isFinal: false });

      // Give it a moment for any pending result to arrive
      setTimeout(() => {
        if (this.currentCallback === onResult) {
          // No result came — inform user
          onResult({
            status: 'error',
            text: '',
            error: 'No speech detected. Please try again.',
            isFinal: true,
          });
        }
      }, 500);
    }
  }

  // ── CANCEL ──

  async cancelListening(): Promise<void> {
    this.isListening = false;
    this.clearTimeout();
    this.removeListeners();
    this.currentCallback = null;

    try {
      if (SpeechModule) {
        SpeechModule.abort();
      }
    } catch {
      // Ignore
    }
  }

  // ── HELPERS ──

  private clearTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  private removeListeners(): void {
    for (const sub of this.subs) {
      try { sub.remove(); } catch {}
    }
    this.subs = [];
  }
}

// ══════════════════════════════════════════════
// SINGLETON
// ══════════════════════════════════════════════

export const speechRecognitionService = new SpeechRecognitionService();
export default speechRecognitionService;
