/**
 * AudioPlayer - Premium Quran Recitation Engine
 * Robust audio playback with queue, repeat, speed, fade, seek, and PRELOADING support
 * Uses expo-av with optimized buffering for minimal gaps between ayahs
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

interface PreloadedAudio {
  sound: Audio.Sound;
  uri: string;
  loadedAt: number;
}

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

const FADE_DURATION_MS = 150; // Reduced from 200 for faster transitions
const FADE_STEPS = 8; // Reduced from 10 for faster fades
const VALID_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const PRELOAD_CACHE_SIZE = 3; // Number of audios to keep preloaded
const PRELOAD_CACHE_MAX_AGE = 60000; // 60 seconds max cache age

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
  
  // Preloading system for gapless playback
  private preloadCache: Map<string, PreloadedAudio> = new Map();
  private preloadQueue: string[] = [];
  private isPreloading = false;

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
      // Only update error state if this is a real error, not just an unload transition
      if ((status as any).error) {
        this.updateState({
          isLoaded: false,
          isPlaying: false,
          isBuffering: false,
          error: (status as any).error || null,
        });
      }
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
    // Guard: don't handle finish if sound was already unloaded (race condition)
    if (!this.sound || !this.state.isLoaded) return;

    if (this.repeatMode === 'one') {
      // Replay same track
      try {
        await this.seekTo(0);
        await this.sound?.playAsync();
      } catch {
        // Sound may have been unloaded between finish and replay
      }
    } else {
      // Signal parent to handle next or stop
      this.finishCallback?.();
    }
  }

  /* ═══════════════════════════════════════════
     PLAYBACK CONTROLS
     ═══════════════════════════════════════════ */

  private isUnloading = false;

  async play(uri: string): Promise<void> {
    if (!uri) return;
    await this.init();

    try {
      // Wait for any in-progress unload
      while (this.isUnloading) await this.delay(10);

      if (this.sound) {
        // Same URI: just restart from beginning (no reload needed)
        if (this.currentUri === uri) {
          try {
            await this.sound.setPositionAsync(0);
            await this.sound.playAsync();
            return;
          } catch {
            // Sound became invalid — fall through to reload
            await this.unload();
          }
        } else {
          // Different URI: properly await cleanup
          await this.unload();
        }
      }

      // Check if we have this audio preloaded for instant playback
      const preloaded = this.preloadCache.get(uri);
      if (preloaded && (Date.now() - preloaded.loadedAt) < PRELOAD_CACHE_MAX_AGE) {
        this.preloadCache.delete(uri);
        try {
          // Try to use preloaded audio — near-instant playback
          this.sound = preloaded.sound;
          this.currentUri = uri;
          this.sound.setOnPlaybackStatusUpdate(this.onStatus);
          await this.sound.setPositionAsync(0);
          await this.sound.playAsync();
          this.updateState({ currentUri: uri, isBuffering: false, isLoaded: true });
          if (__DEV__) console.log('[AudioPlayer] Playing from preload cache');
          return;
        } catch {
          // Preloaded sound became invalid — fall through to fresh load
          this.sound = null;
          this.currentUri = null;
          preloaded.sound.unloadAsync().catch(() => {});
        }
      }

      this.updateState({ isBuffering: true, isPlaying: false, error: null });

      // Load and play with default ExoPlayer backend (fast streaming)
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

  /**
   * Preload audio for gapless playback
   * Call this with the next ayah's URI while current one is playing
   */
  async preload(uri: string): Promise<void> {
    if (!uri || this.preloadCache.has(uri) || this.currentUri === uri) return;
    if (this.isPreloading) {
      // Queue it for later
      if (!this.preloadQueue.includes(uri)) {
        this.preloadQueue.push(uri);
      }
      return;
    }

    this.isPreloading = true;
    try {
      await this.init();
      
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay: false, // Don't play yet, just load
          rate: this.speed,
          shouldCorrectPitch: true,
          volume: 1.0,
        }
      );

      // Clean up old cache entries if at capacity
      if (this.preloadCache.size >= PRELOAD_CACHE_SIZE) {
        const oldest = [...this.preloadCache.entries()]
          .sort((a, b) => a[1].loadedAt - b[1].loadedAt)[0];
        if (oldest) {
          await oldest[1].sound.unloadAsync().catch(() => {});
          this.preloadCache.delete(oldest[0]);
        }
      }

      this.preloadCache.set(uri, { sound, uri, loadedAt: Date.now() });
      if (__DEV__) console.log('[AudioPlayer] Preloaded:', uri.slice(-30));
    } catch (e) {
      if (__DEV__) console.warn('[AudioPlayer] Preload failed:', e);
    } finally {
      this.isPreloading = false;
      
      // Process queue
      if (this.preloadQueue.length > 0) {
        const next = this.preloadQueue.shift();
        if (next) this.preload(next);
      }
    }
  }

  /**
   * Preload multiple URIs (e.g., next 2-3 ayahs)
   */
  async preloadBatch(uris: string[]): Promise<void> {
    for (const uri of uris.slice(0, PRELOAD_CACHE_SIZE)) {
      await this.preload(uri);
    }
  }

  /**
   * Clear preload cache
   */
  async clearPreloadCache(): Promise<void> {
    for (const [, preloaded] of this.preloadCache) {
      await preloaded.sound.unloadAsync().catch(() => {});
    }
    this.preloadCache.clear();
    this.preloadQueue = [];
  }

  async pause(): Promise<void> {
    try {
      if (this.sound && this.state.isLoaded && this.state.isPlaying) {
        await this.fadeOut();
        if (this.sound && this.state.isLoaded) await this.sound.pauseAsync();
      }
    } catch (e) {
      if (__DEV__) console.warn('[AudioPlayer] Pause error:', e);
    }
  }

  async resume(): Promise<void> {
    try {
      if (this.sound && this.state.isLoaded && !this.state.isPlaying) {
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
    if (!this.sound || !this.state.isLoaded || this.isFading) return;
    this.isFading = true;
    try {
      const step = 1.0 / FADE_STEPS;
      const interval = FADE_DURATION_MS / FADE_STEPS;
      for (let i = FADE_STEPS - 1; i >= 0; i--) {
        if (!this.sound || !this.state.isLoaded) break;
        await this.sound.setVolumeAsync(i * step);
        await this.delay(interval);
      }
    } catch {
      // Ignore fade errors — sound may have been unloaded mid-fade
    } finally {
      this.isFading = false;
    }
  }

  private async fadeIn(): Promise<void> {
    if (!this.sound || !this.state.isLoaded || this.isFading) return;
    this.isFading = true;
    try {
      const step = 1.0 / FADE_STEPS;
      const interval = FADE_DURATION_MS / FADE_STEPS;
      for (let i = 1; i <= FADE_STEPS; i++) {
        if (!this.sound || !this.state.isLoaded) break;
        await this.sound.setVolumeAsync(i * step);
        await this.delay(interval);
      }
    } catch {
      // Ignore fade errors — sound may have been unloaded mid-fade
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
    if (this.isUnloading) return;
    this.isUnloading = true;
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
    } finally {
      this.isUnloading = false;
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