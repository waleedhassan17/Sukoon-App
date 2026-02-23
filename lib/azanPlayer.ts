/**
 * AzanPlayer — Plays the Azan sound via expo-av
 *
 * This is the PRIMARY mechanism for playing the azan at prayer time.
 * Android notification-channel sounds are limited (DND, volume, max duration).
 * Using expo-av guarantees the full 25-second azan plays reliably.
 *
 * Flow:
 *  1. Prayer notification fires → _layout.tsx receives it
 *  2. Foreground: addNotificationReceivedListener → handleNotification() → play()
 *  3. Background: Android channel sound plays (short) + when user taps notification,
 *     handleNotificationResponse() can play the full azan
 *  4. Killed: Only the channel sound plays (OS limitation)
 *
 * Anti-overlap: A mutex flag prevents double-plays from rapid notifications.
 * Cleanup: Sound is unloaded automatically when finished or on explicit stop().
 */

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ══════════════════════════════════════════════
// AZAN SOUND ASSETS (bundled locally for offline use)
// ══════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-var-requires */
const AZAN_SOUND = require('@/assets/sounds/azan.wav');
const AZAN_FAJR_SOUND = require('@/assets/sounds/azan_fajr.wav');
/* eslint-enable @typescript-eslint/no-var-requires */

const PREFS_KEY = 'sukoon_notif_prefs';

// Time window (ms) in which we consider the azan still "recent" enough to play
// when the app returns to foreground. Prevents playing stale azans hours later.
const AZAN_FRESHNESS_WINDOW = 5 * 60 * 1000; // 5 minutes

// ══════════════════════════════════════════════
// AZAN PLAYER SERVICE
// ══════════════════════════════════════════════

class AzanPlayerService {
  private sound: Audio.Sound | null = null;
  private isPlaying = false;
  /** Timestamp of the last azan notification received (even if not played) */
  private lastAzanTimestamp = 0;
  /** Prayer name from the last azan notification */
  private lastAzanPrayer: string | undefined;
  /** Lock to prevent concurrent play() calls from racing */
  private playLock = false;

  /**
   * Configure audio mode for azan playback.
   * - staysActiveInBackground: keeps audio session alive if user switches apps
   * - playsInSilentModeIOS: honors the "always play" preference
   * - DuckOthers: lowers music volume so azan is clearly heard
   */
  private async configureAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.warn('[AzanPlayer] Audio mode config error:', e);
    }
  }

  /**
   * Read user preferences (cached in AsyncStorage).
   * Defaults to enabled so first-time users hear the azan.
   */
  private async getPrefs(): Promise<{
    azanSound: boolean;
    fajrSpecialSound: boolean;
  }> {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) {
        const prefs = JSON.parse(raw);
        return {
          azanSound: prefs.azanSound !== false, // default true
          fajrSpecialSound: prefs.fajrSpecialSound !== false, // default true
        };
      }
    } catch {}
    return { azanSound: true, fajrSpecialSound: true };
  }

  /**
   * Play the azan sound for a given prayer.
   * Safe to call multiple times — mutex prevents overlapping playback.
   *
   * @param prayerName - 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'
   */
  async play(prayerName?: string): Promise<void> {
    // Mutex: prevent concurrent play() calls from racing
    if (this.playLock) {
      console.log('[AzanPlayer] Play already in progress (lock) — skipping');
      return;
    }
    this.playLock = true;

    try {
      // Don't play if already playing (prevents overlapping audio)
      if (this.isPlaying) {
        console.log('[AzanPlayer] Already playing — skipping');
        return;
      }

      // Check user preferences
      const prefs = await this.getPrefs();
      if (!prefs.azanSound) {
        console.log('[AzanPlayer] Azan sound disabled in preferences');
        return;
      }

      // Cleanup any previous sound instance before creating a new one
      await this.cleanup();

      // Configure audio session for loud, uninterrupted playback
      await this.configureAudio();

      // Pick the right azan sound (Fajr has a distinct melody)
      const isFajr = prayerName === 'fajr';
      const source = isFajr && prefs.fajrSpecialSound
        ? AZAN_FAJR_SOUND
        : AZAN_SOUND;

      console.log(`[AzanPlayer] Playing ${isFajr ? 'Fajr' : 'regular'} azan`);

      // Load and play in one atomic call
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume: 1.0,
        isLooping: false,
      });

      this.sound = sound;
      this.isPlaying = true;

      // Auto-cleanup when playback finishes (after ~25 seconds)
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('[AzanPlayer] Playback finished — cleaning up');
          this.cleanup();
        }
      });
    } catch (e) {
      console.error('[AzanPlayer] Play error:', e);
      this.isPlaying = false;
    } finally {
      this.playLock = false;
    }
  }

  /**
   * Stop any currently playing azan.
   * Called when: user taps notification, user dismisses, or new notification arrives.
   */
  async stop(): Promise<void> {
    console.log('[AzanPlayer] Stopping playback');
    await this.cleanup();
  }

  /**
   * Internal cleanup — safely unload the sound object and reset state.
   */
  private async cleanup(): Promise<void> {
    this.isPlaying = false;
    if (this.sound) {
      try {
        await this.sound.stopAsync().catch(() => {});
        await this.sound.unloadAsync().catch(() => {});
      } catch {}
      this.sound = null;
    }
  }

  /**
   * Handle an incoming notification (foreground listener).
   * Called from addNotificationReceivedListener in _layout.tsx.
   * This listener ONLY fires when the app is in the foreground,
   * so no AppState check is needed here.
   *
   * @param notification - The raw notification object from expo-notifications
   */
  async handleNotification(notification: any): Promise<void> {
    try {
      const data = notification?.request?.content?.data;
      if (!data) return;

      // Only play for prayer azan notifications (not pre-alerts or reminders)
      if (data.type === 'prayer' && data.action === 'azan') {
        // Record the azan event so we can decide later if we should play on resume
        this.lastAzanTimestamp = Date.now();
        this.lastAzanPrayer = data.prayer;

        // Play immediately — we're in the foreground (listener guarantees this)
        await this.play(data.prayer);
      }
    } catch (e) {
      console.warn('[AzanPlayer] Handle notification error:', e);
    }
  }

  /**
   * Handle notification response (user tapped the notification).
   * If the azan isn't currently playing and the notification is fresh,
   * play it now. This covers the background → foreground transition.
   */
  async handleNotificationResponse(notification: any): Promise<void> {
    try {
      const data = notification?.request?.content?.data;
      if (!data) return;

      if (data.type === 'prayer' && data.action === 'azan') {
        // Record the event
        this.lastAzanTimestamp = Date.now();
        this.lastAzanPrayer = data.prayer;

        // Play the full azan now that the user is in the app
        if (!this.isPlaying) {
          await this.play(data.prayer);
        }
      }
    } catch (e) {
      console.warn('[AzanPlayer] Handle notification response error:', e);
    }
  }

  /**
   * Called when app returns to foreground (AppState → active).
   * If an azan notification arrived recently while app was in background,
   * play it now so the user hears the full azan.
   */
  async handleAppForeground(): Promise<void> {
    try {
      if (this.isPlaying) return; // Already playing

      const elapsed = Date.now() - this.lastAzanTimestamp;
      if (this.lastAzanTimestamp > 0 && elapsed < AZAN_FRESHNESS_WINDOW) {
        console.log(`[AzanPlayer] App returned to foreground — playing missed azan (${Math.round(elapsed / 1000)}s ago)`);
        await this.play(this.lastAzanPrayer);
        // Clear so we don't replay on next foreground
        this.lastAzanTimestamp = 0;
        this.lastAzanPrayer = undefined;
      }
    } catch (e) {
      console.warn('[AzanPlayer] Foreground resume error:', e);
    }
  }

  /** Whether the azan is currently playing */
  get playing(): boolean {
    return this.isPlaying;
  }
}

// Singleton export
export const AzanPlayer = new AzanPlayerService();
