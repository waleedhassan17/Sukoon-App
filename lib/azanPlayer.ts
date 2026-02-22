/**
 * AzanPlayer — Plays the Azan sound via expo-av
 *
 * This is the PRIMARY mechanism for playing the azan at prayer time.
 * Android notification-channel sounds are unreliable (DND, volume, channel cache).
 * Using expo-av guarantees the sound plays when the app is in the foreground.
 *
 * Flow:
 *  1. Prayer notification fires → _layout.tsx receives it
 *  2. If notification data has type === 'prayer' and action === 'azan' → play azan
 *  3. Uses expo-av Audio.Sound for reliable playback
 *  4. Respects user preferences (azanSound, fajrSpecialSound)
 */

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ══════════════════════════════════════════════
// AZAN SOUND ASSETS
// ══════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-var-requires */
const AZAN_SOUND = require('@/assets/sounds/azan.wav');
const AZAN_FAJR_SOUND = require('@/assets/sounds/azan_fajr.wav');
/* eslint-enable @typescript-eslint/no-var-requires */

const PREFS_KEY = 'sukoon_notif_prefs';

// ══════════════════════════════════════════════
// AZAN PLAYER SERVICE
// ══════════════════════════════════════════════

class AzanPlayerService {
  private sound: Audio.Sound | null = null;
  private isPlaying = false;

  /**
   * Configure audio mode for azan playback.
   * - Plays over silent mode (staysActiveInBackground)
   * - Ducks other audio (lowers volume of music etc.)
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
   * Check user preferences to see if azan sound is enabled
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
   * Call this when a prayer notification is received in foreground.
   *
   * @param prayerName - 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'
   */
  async play(prayerName?: string): Promise<void> {
    try {
      // Don't play if already playing
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

      // Cleanup any previous sound instance
      await this.stop();

      // Configure audio for loud playback
      await this.configureAudio();

      // Pick the right azan sound
      const isFajr = prayerName === 'fajr';
      const source = isFajr && prefs.fajrSpecialSound
        ? AZAN_FAJR_SOUND
        : AZAN_SOUND;

      console.log(`[AzanPlayer] Playing ${isFajr ? 'Fajr' : 'regular'} azan`);

      // Load and play
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume: 1.0,
        isLooping: false,
      });

      this.sound = sound;
      this.isPlaying = true;

      // Auto-cleanup when playback finishes
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.cleanup();
        }
      });
    } catch (e) {
      console.error('[AzanPlayer] Play error:', e);
      this.isPlaying = false;
    }
  }

  /**
   * Stop any currently playing azan
   */
  async stop(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Internal cleanup — unload the sound object
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
   * Handle an incoming notification — decide if we should play the azan.
   * This is called from the notification received listener in _layout.tsx.
   *
   * @param notification - The raw notification object from expo-notifications
   */
  async handleNotification(notification: any): Promise<void> {
    try {
      const data = notification?.request?.content?.data;
      if (!data) return;

      // Only play for prayer azan notifications (not pre-alerts or reminders)
      if (data.type === 'prayer' && data.action === 'azan') {
        // Only play if app is in foreground
        if (AppState.currentState === 'active') {
          await this.play(data.prayer);
        }
      }
    } catch (e) {
      console.warn('[AzanPlayer] Handle notification error:', e);
    }
  }
}

// Singleton export
export const AzanPlayer = new AzanPlayerService();
