/**
 * AudioPlayer - Premium Quran Recitation Engine
 * Robust audio playback with queue, repeat, speed, fade, and seek support
 * Uses expo-av
 */

import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';

/* ─── Types ─── */
export type RepeatMode = 'none' | 'one' | 'all';
export type PlaybackSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export interface PlayerState {
  isPlaying: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  positionMs: number;
  durationMs: number;
  progress: number;
  speed: PlaybackSpeed;
  repeatMode: RepeatMode;
  currentUri: string | null;
  error: string | null;
}

type StatusCallback = ((state: PlayerState) => void) | null;
type FinishCallback = (() => void) | null;

const INITIAL_STATE: PlayerState = {
  isPlaying: false,
  isBuffering: false,
  isLoaded: false,
  positionMs: 0,
  durationMs: 0,
  progress: 0,
  speed: 1.0,
  repeatMode: 'none',
  currentUri: null,
  error: null,
};

const FADE_DURATION_MS = 200;
const FADE_STEPS = 10;
const VALID_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

class AudioPlayer {
  private sound: Audio.Sound | null = null;
  private statusCallback: StatusCallback = null;
  private finishCallback: FinishCallback = null;
  private currentUri: string | null = null;
  private state: PlayerState = { ...INITIAL_STATE };
  private speed: PlaybackSpeed = 1.0;
  private repeatMode: RepeatMode = 'none';
  private isInitialized = false;
  private isFading = false;

  constructor() {
    this.init();
  }

  /* ═══════════════════════════════════════════
     INITIALIZATION
     ═══════════════════════════════════════════ */

  private async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.isInitialized = true;
    } catch (e) {
      if (__DEV__) console.warn('[AudioPlayer] Init error:', e);
    }
  }

  /* ═══════════════════════════════════════════
     CALLBACKS
     ═══════════════════════════════════════════ */

  setStatusCallback(cb: StatusCallback): void {
    this.statusCallback = cb;
  }

  setFinishCallback(cb: FinishCallback): void {
    this.finishCallback = cb;
  }

  private emitState(): void {
    this.statusCallback?.(this.state);
  }

  private updateState(partial: Partial<PlayerState>): void {
    this.state = { ...this.state, ...partial };
    this.emitState();
  }

  /* ═══════════════════════════════════════════
     STATUS HANDLER
     ═══════════════════════════════════════════ */

  private onStatus = (status: AVPlaybackStatus): void => {
    // Guard: ignore stale callbacks from unloaded/previous sounds
    if (!this.sound) return;

    if (!status.isLoaded) {
      this.updateState({
        isLoaded: false,
        isPlaying: false,
        isBuffering: false,
        error: (status as any).error || null,
      });
      return;
    }

    const s = status as AVPlaybackStatusSuccess;
    const durationMs = s.durationMillis ?? 0;
    const positionMs = s.positionMillis ?? 0;

    this.updateState({
      isLoaded: true,
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
      positionMs,
      durationMs,
      progress: durationMs > 0 ? positionMs / durationMs : 0,
      speed: this.speed,
      repeatMode: this.repeatMode,
      currentUri: this.currentUri,
      error: null,
    });

    // Handle track finish
    if (s.didJustFinish) {
      this.handleFinish();
    }
  };

  private async handleFinish(): Promise<void> {
    if (this.repeatMode === 'one') {
      // Replay same track
      await this.seekTo(0);
      await this.sound?.playAsync();
    } else {
      // Signal parent to handle next or stop
      this.finishCallback?.();
    }
  }

  /* ═══════════════════════════════════════════
     PLAYBACK CONTROLS
     ═══════════════════════════════════════════ */

  async play(uri: string): Promise<void> {
    if (!uri) return;
    await this.init();

    try {
      if (this.sound) {
        // Same URI: just restart from beginning (no reload needed)
        if (this.currentUri === uri) {
          await this.sound.setPositionAsync(0);
          await this.sound.playAsync();
          return;
        }
        
        // Different URI: properly await cleanup to prevent Android race conditions
        await this.unload();
      }

      this.updateState({ isBuffering: true, isPlaying: false, error: null });

      // Re-initialize audio mode before each play (handles interruptions like phone calls)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => {});

      // Retry logic for network audio loading (CDN can be flaky on mobile)
      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            {
              shouldPlay: true,
              rate: this.speed,
              shouldCorrectPitch: true,
              progressUpdateIntervalMillis: 250,
              volume: 1.0,
            },
            this.onStatus
          );

          this.sound = sound;
          this.currentUri = uri;
          this.updateState({ currentUri: uri });
          return; // Success — exit
        } catch (e) {
          lastErr = e;
          if (attempt < 1) {
            await this.delay(500); // Brief wait before retry
          }
        }
      }

      // Both attempts failed
      throw lastErr;
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to play audio';
      if (__DEV__) console.error('[AudioPlayer] Play error:', errorMsg);
      this.updateState({
        isBuffering: false,
        isPlaying: false,
        error: errorMsg,
      });
      throw e;
    }
  }

  async pause(): Promise<void> {
    try {
      if (this.sound && this.state.isPlaying) {
        await this.fadeOut();
        await this.sound.pauseAsync();
      }
    } catch (e) {
      if (__DEV__) console.error('[AudioPlayer] Pause error:', e);
    }
  }

  async resume(): Promise<void> {
    try {
      if (this.sound && !this.state.isPlaying) {
        // Re-claim audio focus on Android (lost after phone calls / other apps)
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        }).catch(() => {});
        await this.sound.playAsync();
        await this.fadeIn();
      }
    } catch (e) {
      if (__DEV__) console.error('[AudioPlayer] Resume error:', e);
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.sound) {
        if (this.state.isPlaying) {
          await this.fadeOut();
        }
        await this.unload();
      }
      this.updateState({ ...INITIAL_STATE });
    } catch {
      // Silently handle stop errors
      this.sound = null;
      this.currentUri = null;
    }
  }

  async togglePlayPause(): Promise<void> {
    if (this.state.isPlaying) {
      await this.pause();
    } else {
      await this.resume();
    }
  }

  /* ═══════════════════════════════════════════
     SEEK & SPEED
     ═══════════════════════════════════════════ */

  async seekTo(positionMs: number): Promise<void> {
    try {
      if (this.sound && this.state.isLoaded) {
        const clamped = Math.max(0, Math.min(positionMs, this.state.durationMs));
        await this.sound.setPositionAsync(clamped);
      }
    } catch (e) {
      if (__DEV__) console.error('[AudioPlayer] Seek error:', e);
    }
  }

  async seekByDelta(deltaMs: number): Promise<void> {
    await this.seekTo(this.state.positionMs + deltaMs);
  }

  async setSpeed(speed: PlaybackSpeed): Promise<void> {
    if (!VALID_SPEEDS.includes(speed)) return;
    this.speed = speed;
    try {
      if (this.sound && this.state.isLoaded) {
        await this.sound.setRateAsync(speed, true);
      }
      this.updateState({ speed });
    } catch (e) {
      if (__DEV__) console.error('[AudioPlayer] Speed error:', e);
    }
  }

  cycleSpeed(): PlaybackSpeed {
    const idx = VALID_SPEEDS.indexOf(this.speed);
    const next = VALID_SPEEDS[(idx + 1) % VALID_SPEEDS.length];
    this.setSpeed(next);
    return next;
  }

  /* ═══════════════════════════════════════════
     REPEAT MODE
     ═══════════════════════════════════════════ */

  setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
    this.updateState({ repeatMode: mode });
  }

  cycleRepeatMode(): RepeatMode {
    const modes: RepeatMode[] = ['none', 'one', 'all'];
    const idx = modes.indexOf(this.repeatMode);
    const next = modes[(idx + 1) % modes.length];
    this.setRepeatMode(next);
    return next;
  }

  /* ═══════════════════════════════════════════
     FADE TRANSITIONS
     ═══════════════════════════════════════════ */

  private async fadeOut(): Promise<void> {
    if (!this.sound || this.isFading) return;
    this.isFading = true;
    try {
      const step = 1.0 / FADE_STEPS;
      const interval = FADE_DURATION_MS / FADE_STEPS;
      for (let i = FADE_STEPS - 1; i >= 0; i--) {
        await this.sound.setVolumeAsync(i * step);
        await this.delay(interval);
      }
    } catch {
      // Ignore fade errors
    } finally {
      this.isFading = false;
    }
  }

  private async fadeIn(): Promise<void> {
    if (!this.sound || this.isFading) return;
    this.isFading = true;
    try {
      const step = 1.0 / FADE_STEPS;
      const interval = FADE_DURATION_MS / FADE_STEPS;
      for (let i = 1; i <= FADE_STEPS; i++) {
        await this.sound.setVolumeAsync(i * step);
        await this.delay(interval);
      }
    } catch {
      // Ignore fade errors
    } finally {
      this.isFading = false;
    }
  }

  /* ═══════════════════════════════════════════
     GETTERS
     ═══════════════════════════════════════════ */

  getState(): PlayerState {
    return { ...this.state };
  }

  async getStatus(): Promise<AVPlaybackStatus | null> {
    try {
      if (this.sound) return await this.sound.getStatusAsync();
      return null;
    } catch {
      return null;
    }
  }

  getSpeed(): PlaybackSpeed {
    return this.speed;
  }

  getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  isActive(): boolean {
    return this.sound !== null && this.state.isLoaded;
  }

  /** Current playback position in milliseconds (for saving resume state) */
  getPositionMs(): number {
    return this.state.positionMs;
  }

  /* ═══════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════ */

  private async unload(): Promise<void> {
    try {
      if (this.sound) {
        this.sound.setOnPlaybackStatusUpdate(null);
        await this.sound.stopAsync().catch(() => {});
        await this.sound.unloadAsync().catch(() => {});
        this.sound = null;
        this.currentUri = null;
      }
    } catch {
      this.sound = null;
      this.currentUri = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Format milliseconds as MM:SS */
  static formatTime(ms: number): string {
    if (!ms || ms < 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
}

const audioPlayer = new AudioPlayer();
export default audioPlayer;