/**
 * Safe lazy imports — expo-notifications was removed from Expo Go in SDK 53.
 * We lazy-load all notification modules so the app doesn't crash on import.
 * Each module is loaded independently to prevent one failure from blocking others.
 */
let Notifications: any = null;
let TaskManager: any = null;
let BackgroundFetch: any = null;
let _modulesLoaded = false;

function loadModules(): boolean {
  if (_modulesLoaded) return !!Notifications;
  _modulesLoaded = true;
  try { Notifications = require('expo-notifications'); } catch {}
  try { TaskManager = require('expo-task-manager'); } catch {}
  try { BackgroundFetch = require('expo-background-fetch'); } catch {}

  if (!Notifications && __DEV__) {
    console.warn('[Sukoon] Notification modules not available (Expo Go?)');
  }
  return !!Notifications;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerTimeEntry {
  name: PrayerName;
  label: string;
  time: Date; // today's prayer time as a Date object
}

export interface NotificationPreferences {
  enabled: boolean;                      // master toggle
  prayerAlerts: Record<PrayerName, boolean>;  // per-prayer on/off
  preAlertMinutes: number;               // 0 = disabled, 5/10/15/30
  azanSound: boolean;                    // play azan sound or silent
  fajrSpecialSound: boolean;             // different azan for Fajr
  salahTrackerReminder: boolean;         // "Did you pray?" reminder
  salahTrackerTime: string;              // "22:00" — when to ask
  quranReminder: boolean;                // daily reading reminder
  quranReminderTime: string;             // "08:00" — morning nudge
}

import { AzanPlayer } from './azanPlayer';
import { NotificationStorage } from './notificationStorage';

// ══════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════

const KEYS = {
  PREFS: 'sukoon_notif_prefs',
  LAST_SCHEDULED: 'sukoon_notif_last_scheduled', // date string
  PUSH_TOKEN: 'sukoon_push_token',
  // NEW: Track end-of-day reminder sent today
  EOD_REMINDER_SENT: 'sukoon_eod_reminder_sent',
  // NEW: Track internet off notification sent today
  INTERNET_NOTIF_SENT: 'sukoon_internet_notif_sent',
};

const BACKGROUND_TASK_NAME = 'SUKOON_PRAYER_RESCHEDULE';

// ══════════════════════════════════════════════
// DEFAULT PREFERENCES
// ══════════════════════════════════════════════

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  prayerAlerts: {
    fajr: true,
    sunrise: false,  // most people don't want sunrise alert
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
  preAlertMinutes: 10,
  azanSound: true,
  fajrSpecialSound: true,
  salahTrackerReminder: true,
  salahTrackerTime: '22:00',
  quranReminder: false,
  quranReminderTime: '08:00',
};

// ══════════════════════════════════════════════
// NOTIFICATION CHANNELS (Android)
// ══════════════════════════════════════════════

async function setupChannels(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;

  // Delete old channels so Android picks up updated sound files
  // (Android caches channel config — once created, sound can't change without deleting)
  try {
    await Notifications.deleteNotificationChannelAsync('prayer-azan').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('prayer-fajr').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('prayer-reminder').catch(() => {});
    await Notifications.deleteNotificationChannelAsync('daily-reminder').catch(() => {});
  } catch {}

  // High-importance channel for azan
  await Notifications.setNotificationChannelAsync('prayer-azan', {
    name: 'Prayer Azan',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'azan.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2D6A4F',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
  });

  // Fajr-specific channel (different sound)
  await Notifications.setNotificationChannelAsync('prayer-fajr', {
    name: 'Fajr Prayer',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'azan_fajr.wav',
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#56A8E2',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    enableVibrate: true,
  });

  // Pre-alert channel (gentle reminder)
  await Notifications.setNotificationChannelAsync('prayer-reminder', {
    name: 'Prayer Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'reminder.wav',
    vibrationPattern: [0, 200],
    lightColor: '#D4A373',
  });

  // Tracker & Quran reminders (low priority)
  await Notifications.setNotificationChannelAsync('daily-reminder', {
    name: 'Daily Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'reminder.wav',
  });
}

// ══════════════════════════════════════════════
// PERMISSION HANDLING
// ══════════════════════════════════════════════

async function requestPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  // Check existing permissions first
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  // Request if not granted
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: false, // requires Apple entitlement
    },
  });

  return status === 'granted';
}

// ══════════════════════════════════════════════
// MAIN SERVICE
// ══════════════════════════════════════════════

export const NotificationService = {

  // ── INITIALIZE (call once on app start) ──
  async init(): Promise<void> {
    if (!loadModules()) {
      if (__DEV__) console.log('[Sukoon] Notifications unavailable — skipping init');
      return;
    }

    // Set up notification handler (how to display when app is foreground)
    // Configure how notifications are displayed when app is in the foreground.
    // For prayer azan notifications, we DISABLE the system sound because
    // AzanPlayer (expo-av) handles the full 25-second azan reliably.
    // This prevents double-sound (channel sound + expo-av playing together).
    //
    // IMPORTANT: This handler also persists notifications to storage.
    // In release mode, addNotificationReceivedListener alone is unreliable
    // because it only fires in the foreground. Saving here ensures
    // notifications are captured before they're displayed.
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const data = notification.request.content.data;
        const isPrayerAzan = data?.type === 'prayer' && data?.action === 'azan';

        // Persist notification to storage (fire-and-forget, non-blocking)
        // This is the PRIMARY save point for foreground notifications.
        try {
          await NotificationStorage.addFromNotification(notification);
        } catch {}

        return {
          shouldShowAlert: true,
          // Disable system sound for azan in foreground — expo-av handles it
          shouldPlaySound: !isPrayerAzan,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: data?.type === 'prayer'
            ? Notifications.AndroidNotificationPriority.HIGH
            : Notifications.AndroidNotificationPriority.DEFAULT,
        };
      },
    });

    // Set up Android channels
    await setupChannels();

    // Check if we need to reschedule (new day)
    const prefs = await this.getPreferences();
    if (prefs.enabled) {
      const lastScheduled = await AsyncStorage.getItem(KEYS.LAST_SCHEDULED);
      const today = new Date().toDateString();
      if (lastScheduled !== today) {
        // Attempt to reschedule from cached prayer times immediately
        // This ensures notifications are scheduled even before the user
        // opens the prayer screen (which triggers a fresh API fetch).
        await this.rescheduleFromCache().catch(() => {});
        console.log('[Sukoon] Auto-rescheduled notifications from cache on init');
      }
    }
  },

  // ── PREFERENCES ──
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PREFS);
      if (raw) {
        const stored = JSON.parse(raw);
        // Merge with defaults (handles new fields added in updates)
        return { ...DEFAULT_PREFS, ...stored };
      }
      return { ...DEFAULT_PREFS };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  },

  async savePreferences(prefs: NotificationPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));

      // Keep schedules in sync with latest preferences.
      // This covers toggles like prayer selection, pre-alert minutes,
      // quran reminder time, and azan sound settings.
      if (prefs.enabled) {
        await setupChannels().catch(() => {});
        await this.rescheduleFromCache().catch(() => {});
      } else {
        await this.cancelPrayerNotifications().catch(() => {});
      }
    } catch {}
  },

  // ── MASTER ENABLE/DISABLE ──
  async enableNotifications(): Promise<boolean> {
    if (!loadModules()) return false;
    const granted = await requestPermissions();
    if (!granted) return false;

    const prefs = await this.getPreferences();
    prefs.enabled = true;
    await this.savePreferences(prefs);
    return true;
  },

  async disableNotifications(): Promise<void> {
    const prefs = await this.getPreferences();
    prefs.enabled = false;
    await this.savePreferences(prefs);
    await this.cancelAll();
  },

  // ══════════════════════════════════════════
  // SCHEDULE PRAYER NOTIFICATIONS
  // Call this whenever:
  //   1. App launches with notifications enabled
  //   2. User enables notifications
  //   3. Prayer times are fetched/updated
  //   4. User changes notification preferences
  //   5. Background task runs at midnight
  // ══════════════════════════════════════════
  async schedulePrayerNotifications(
    prayerTimes: PrayerTimeEntry[]
  ): Promise<number> {
    if (!loadModules()) return 0;
    const prefs = await this.getPreferences();
    if (!prefs.enabled) return 0;

    // Cancel all existing prayer notifications first
    await this.cancelPrayerNotifications();

    const now = new Date();
    let scheduled = 0;

    for (const prayer of prayerTimes) {
      // Skip if this prayer is disabled
      if (!prefs.prayerAlerts[prayer.name]) continue;

      // Skip sunrise (not a salah)
      if (prayer.name === 'sunrise') continue;

      const prayerTime = new Date(prayer.time);

      // ── Main azan notification (at prayer time) ──
      if (prayerTime > now) {
        const isFajr = prayer.name === 'fajr';
        const soundFile = isFajr && prefs.fajrSpecialSound
          ? 'azan_fajr.wav'
          : prefs.azanSound ? 'azan.wav' : undefined;

        const channelId = isFajr ? 'prayer-fajr' : 'prayer-azan';

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${prayer.label} Prayer Time`,
            body: this._getPrayerBody(prayer.name),
            sound: soundFile || undefined,
            data: {
              type: 'prayer',
              prayer: prayer.name,
              action: 'azan',
            },
            ...(Platform.OS === 'android' && { channelId }),
            // iOS critical alert (if entitled):
            // interruptionLevel: 'timeSensitive',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: prayerTime,
          },
          identifier: `prayer-${prayer.name}`,
        });
        scheduled++;

        // ── Pre-alert notification (X minutes before) ──
        if (prefs.preAlertMinutes > 0) {
          const preTime = new Date(prayerTime.getTime() - prefs.preAlertMinutes * 60000);
          if (preTime > now) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `${prayer.label} in ${prefs.preAlertMinutes} minutes`,
                body: `Prepare for ${prayer.label} prayer`,
                sound: 'reminder.wav',
                data: {
                  type: 'prayer-reminder',
                  prayer: prayer.name,
                  action: 'pre-alert',
                },
                ...(Platform.OS === 'android' && { channelId: 'prayer-reminder' }),
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: preTime,
              },
              identifier: `prayer-pre-${prayer.name}`,
            });
            scheduled++;
          }
        }
      }
    }

    // ── Salah Tracker Reminder (Fixed at 10:00 PM with smart messages) ──
    if (prefs.salahTrackerReminder) {
      const trackerTime = new Date();
      trackerTime.setHours(22, 0, 0, 0); // Fixed at 10:00 PM

      if (trackerTime > now) {
        // Get smart notification content based on today's prayer data
        const { title, body } = await this._getSmartTrackerNotification();
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'reminder.wav',
            data: { type: 'tracker-reminder', action: 'open-tracker' },
            ...(Platform.OS === 'android' && { channelId: 'daily-reminder' }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trackerTime,
          },
          identifier: 'salah-tracker-reminder',
        });
        scheduled++;
      }
    }

    // ── Quran Reading Reminder ──
    if (prefs.quranReminder) {
      const [h, m] = prefs.quranReminderTime.split(':').map(Number);
      const quranTime = new Date();
      quranTime.setHours(h, m, 0, 0);

      if (quranTime > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Daily Quran Reading 📖',
            body: 'Take a moment to connect with the Quran today',
            sound: 'reminder.wav',
            data: { type: 'quran-reminder', action: 'open-quran' },
            ...(Platform.OS === 'android' && { channelId: 'daily-reminder' }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: quranTime,
          },
          identifier: 'quran-reading-reminder',
        });
        scheduled++;
      }
    }

    // Mark today as scheduled
    await AsyncStorage.setItem(KEYS.LAST_SCHEDULED, new Date().toDateString());

    console.log(`[Sukoon] Scheduled ${scheduled} notifications for today`);
    return scheduled;
  },

  // ── Helper: prayer body messages ──
  _getPrayerBody(prayer: PrayerName): string {
    const messages: Record<PrayerName, string> = {
      fajr:    'Rise for Fajr — the angels witness this prayer 🌅',
      sunrise: 'The sun has risen',
      dhuhr:   'It\'s time for Dhuhr prayer 🕐',
      asr:     'Asr prayer time has arrived ☀️',
      maghrib: 'Break your fast (if fasting) and pray Maghrib 🌅',
      isha:    'Complete your day with Isha prayer 🌙',
    };
    return messages[prayer] || `It's time for ${prayer} prayer`;
  },

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * SMART SALAH TRACKER NOTIFICATION
   * Evaluates today's prayer tracking data and returns appropriate message:
   * - All 5 prayers completed → Congratulatory message
   * - Some prayers completed → Motivational reminder
   * - No prayers tracked → Gentle reminder to start
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async _getSmartTrackerNotification(): Promise<{ title: string; body: string }> {
    try {
      // Get today's date key (YYYY-MM-DD format)
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const storageKey = `sukoon_salah_${dateKey}`;
      
      // Fetch today's prayer data
      const stored = await AsyncStorage.getItem(storageKey);
      const dayData = stored ? JSON.parse(stored) : null;
      
      // Count completed prayers (prayed, jamaah, or qasr count as completed)
      let completedCount = 0;
      if (dayData) {
        const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
        for (const prayer of prayers) {
          const status = dayData[prayer];
          if (status === 'prayed' || status === 'jamaah' || status === 'qasr') {
            completedCount++;
          }
        }
      }
      
      // ═══ Case 1: All 5 prayers completed ═══
      if (completedCount === 5) {
        const congratsMessages = [
          {
            title: '🌟 MashaAllah! All Prayers Complete',
            body: 'You completed all your Salah today.\n"Whoever guards the five prayers, they will be a light for him on the Day of Judgment."',
          },
          {
            title: '🤍 Beautiful Consistency!',
            body: '"Indeed, the prayer has been decreed upon the believers at fixed times." (Quran 4:103)',
          },
          {
            title: '✨ All Five Prayers Done!',
            body: 'May Allah accept and elevate your rank. Keep up this beautiful devotion.',
          },
        ];
        return congratsMessages[Math.floor(Math.random() * congratsMessages.length)];
      }
      
      // ═══ Case 2: Some prayers completed (1-4) ═══
      if (completedCount > 0) {
        const motivationalMessages = [
          {
            title: '🌿 Keep Going!',
            body: `You prayed ${completedCount}/5 today. Keep striving!\n"Indeed, prayer restrains from immorality and wrongdoing." (Quran 29:45)`,
          },
          {
            title: '🤲 Every Prayer Matters',
            body: `${completedCount} prayer${completedCount > 1 ? 's' : ''} tracked. Don't miss the rest.\n"The first matter that the slave will be brought to account for is the prayer."`,
          },
          {
            title: '🌙 Almost There!',
            body: `${completedCount}/5 prayers completed. Allah loves consistency, even if small. Complete the rest 🤍`,
          },
        ];
        return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
      }
      
      // ═══ Case 3: No prayers tracked today ═══
      const reminderMessages = [
        {
          title: "🌙 Don't Forget Your Salah",
          body: '"Establish prayer for My remembrance." (Quran 20:14)\nTrack your prayers now.',
        },
        {
          title: '🤍 Connect with Allah',
          body: 'Salah is your daily connection with Allah. Start now — even one prayer matters.',
        },
        {
          title: "🌿 It's Never Too Late",
          body: "It's never too late to return to prayer. Open the tracker and log your Salah today.",
        },
      ];
      return reminderMessages[Math.floor(Math.random() * reminderMessages.length)];
      
    } catch (error) {
      // Fallback message if something goes wrong
      console.warn('[Sukoon] Error getting smart notification:', error);
      return {
        title: 'Log Your Prayers 🕌',
        body: 'Have you tracked all your prayers today?',
      };
    }
  },

  // ── Cancel helpers ──
  async cancelPrayerNotifications(): Promise<void> {
    if (!Notifications) return;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      const id = notif.identifier;
      if (id.startsWith('prayer-') || id === 'salah-tracker-reminder' || id === 'quran-reading-reminder') {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
  },

  async cancelAll(): Promise<void> {
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  // ── Debug: list all scheduled ──
  async getScheduledNotifications(): Promise<any[]> {
    if (!Notifications) return [];
    return Notifications.getAllScheduledNotificationsAsync();
  },

  // ══════════════════════════════════════════
  // NOTIFICATION RESPONSE HANDLER
  // Handles what happens when user taps a notification
  // Also persists the notification to storage (covers background/killed state).
  // ══════════════════════════════════════════
  setupResponseHandler(
    router: { push: (path: string, params?: any) => void }
  ): any {
    if (!Notifications) return { remove: () => {} };
    return Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;

      // Persist notification to storage when user taps it.
      // This is critical for background/killed state where the
      // foreground listener never fires.
      NotificationStorage.addFromNotification(response.notification).catch(() => {});

      // When user taps an azan notification:
      // 1. If azan is already playing (foreground), stop it (user acknowledged)
      // 2. If azan is NOT playing (came from background/killed), play it now
      if (data?.action === 'azan') {
        if (AzanPlayer.playing) {
          AzanPlayer.stop().catch(() => {});
        } else {
          AzanPlayer.handleNotificationResponse(response.notification).catch(() => {});
        }
      } else {
        // Stop any playing azan for non-azan notification taps
        AzanPlayer.stop().catch(() => {});
      }

      if (!data) return;

      switch (data.action) {
        case 'azan':
        case 'pre-alert':
          // Open Salah Tracker when prayer notification tapped
          router.push('/tools/salah-tracker');
          break;
        case 'open-tracker':
          router.push('/tools/salah-tracker');
          break;
        case 'open-quran':
          // Open last-read position or surah list
          router.push('/(tabs)/quran');
          break;
        default:
          break;
      }
    });
  },

  // ══════════════════════════════════════════
  // RESCHEDULE FROM CACHED PRAYER TIMES
  // Used by background task and on app init when prayer times
  // haven't been fetched yet (before the user opens prayer screen).
  // Reads last cached prayer times from AsyncStorage and schedules.
  // ══════════════════════════════════════════
  async rescheduleFromCache(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem('sukoon_prayer_cache');
      if (!raw) return;
      const cached = JSON.parse(raw);
      // Validate cache is for today (format: YYYY-MM-DD)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (cached.date !== todayStr) return; // stale cache — skip

      const data = cached.data;
      if (!data?.Fajr) return; // invalid cache

      // Import bridge inline to avoid circular deps
      const { convertToNotifFormat } = require('./prayerTimeNotifBridge');
      const entries = convertToNotifFormat(data);
      await this.schedulePrayerNotifications(entries);
    } catch (e) {
      if (__DEV__) console.warn('[Sukoon] rescheduleFromCache error:', e);
    }
  },

  // ══════════════════════════════════════════
  // SYNC DELIVERED NOTIFICATIONS
  // Called on app resume (foreground). Captures notifications that
  // were delivered while the app was in background/killed state.
  // These won't have been caught by addNotificationReceivedListener.
  // ══════════════════════════════════════════
  async syncDeliveredNotifications(): Promise<void> {
    if (!Notifications) return;
    try {
      // Get notifications currently visible in the notification shade
      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const notif of presented) {
        // Wrap in the same shape as addNotificationReceivedListener provides
        await NotificationStorage.addFromNotification(notif).catch(() => {});
      }

      // Also handle the case where the app was launched by tapping a notification
      // (killed state). getLastNotificationResponseAsync returns the last tap.
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse?.notification) {
        await NotificationStorage.addFromNotification(lastResponse.notification).catch(() => {});
      }
    } catch {}
  },

  // ══════════════════════════════════════════
  // PUSH TOKEN (for Firebase remote pushes)
  // ══════════════════════════════════════════
  async getExpoPushToken(): Promise<string | null> {
    if (!loadModules()) return null;
    try {
      const granted = await requestPermissions();
      if (!granted) return null;

      // For Expo-only pushes, use projectId from app.json
      // If you setup Firebase, you'd use Firebase messaging instead
      const token = await Notifications.getExpoPushTokenAsync();

      await AsyncStorage.setItem(KEYS.PUSH_TOKEN, token.data);
      return token.data;
    } catch (e) {
      console.error('[Sukoon] Push token error:', e);
      return null;
    }
  },

  // ══════════════════════════════════════════
  // BACKGROUND RESCHEDULING
  // Runs daily to reschedule prayer notifications
  // for the new day (prayer times change daily)
  // ══════════════════════════════════════════
  async registerBackgroundTask(): Promise<void> {
    if (!loadModules() || !TaskManager || !BackgroundFetch) return;
    try {
      // Define the task handler first (must happen before register)
      TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
        try {
          const prefs = await NotificationService.getPreferences();
          if (!prefs.enabled) return BackgroundFetch.BackgroundFetchResult.NoData;

          // Actually reschedule from cached prayer times
          await NotificationService.rescheduleFromCache();
          console.log('[Sukoon] Background: rescheduled notifications');
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch {
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      if (isRegistered) return;

      await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
        minimumInterval: 60 * 60 * 6,  // every 6 hours
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log('[Sukoon] Background task registered');
    } catch (e) {
      if (__DEV__) console.warn('[Sukoon] Background task registration failed:', e);
    }
  },

  async unregisterBackgroundTask(): Promise<void> {
    if (!TaskManager) return;
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
      }
    } catch {}
  },

  // ══════════════════════════════════════════
  // TEST AZAN NOTIFICATION
  // Schedules a test azan notification after `delaySec` seconds.
  // Also saves the notification to persistent storage.
  // ── TEST ONLY — remove before production release ──
  // ══════════════════════════════════════════
  async scheduleTestAzan(delaySec: number = 5): Promise<boolean> {
    if (!loadModules()) return false;

    const granted = await requestPermissions();
    if (!granted) return false;

    const triggerDate = new Date(Date.now() + delaySec * 1000);
    const prayerName = 'dhuhr'; // Use Dhuhr for test

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Dhuhr Prayer Time (TEST)',
          body: this._getPrayerBody('dhuhr'),
          sound: 'azan.wav',
          data: {
            type: 'prayer',
            prayer: prayerName,
            action: 'azan',
            isTest: true, // Flag so we know it's a test
          },
          ...(Platform.OS === 'android' && { channelId: 'prayer-azan' }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
        identifier: `test-azan-${Date.now()}`,
      });

      // Save to persistent notification storage immediately
      await NotificationStorage.addManual({
        title: 'Dhuhr Prayer Time (TEST)',
        message: this._getPrayerBody('dhuhr'),
        type: 'azan',
        data: { prayer: prayerName, action: 'azan', isTest: true },
      });

      console.log(`[Sukoon] Test azan scheduled in ${delaySec}s`);
      return true;
    } catch (e) {
      console.error('[Sukoon] scheduleTestAzan error:', e);
      return false;
    }
  },

  // ══════════════════════════════════════════════════════════════
  // END-OF-DAY UNTRACKED PRAYER REMINDER
  // NEW: Send notification after Isha if any prayer is untracked today.
  // Only sends once per day.
  // ══════════════════════════════════════════════════════════════
  async sendEndOfDayReminder(untrackedCount: number): Promise<boolean> {
    if (!loadModules()) return false;
    if (untrackedCount === 0) return false; // All prayers tracked

    try {
      // Check if already sent today
      const today = new Date().toDateString();
      const lastSent = await AsyncStorage.getItem(KEYS.EOD_REMINDER_SENT);
      if (lastSent === today) {
        console.log('[Sukoon] End-of-day reminder already sent today');
        return false;
      }

      const granted = await requestPermissions();
      if (!granted) return false;

      const eodTitle = '🕌 Salah Reminder';
      const eodBody = "You haven't completed tracking today's prayers.";

      await Notifications.scheduleNotificationAsync({
        content: {
          title: eodTitle,
          body: eodBody,
          sound: 'reminder.wav',
          data: {
            type: 'eod-reminder',
            action: 'open-tracker',
            untrackedCount,
          },
          ...(Platform.OS === 'android' && { channelId: 'daily-reminder' }),
        },
        trigger: null, // Send immediately
        identifier: 'eod-prayer-reminder',
      });

      // Persist to notification storage so it appears on the Notifications screen
      await NotificationStorage.addManual({
        title: eodTitle,
        message: eodBody,
        type: 'reminder',
        data: { type: 'eod-reminder', action: 'open-tracker', untrackedCount },
      });

      // Mark as sent for today
      await AsyncStorage.setItem(KEYS.EOD_REMINDER_SENT, today);
      console.log(`[Sukoon] End-of-day reminder sent (${untrackedCount} untracked)`);
      return true;
    } catch (e) {
      console.error('[Sukoon] sendEndOfDayReminder error:', e);
      return false;
    }
  },

  // ══════════════════════════════════════════════════════════════
  // INTERNET OFF NOTIFICATION
  // NEW: Send notification when internet is off and reminders are enabled.
  // Only sends once per day to avoid spam.
  // ══════════════════════════════════════════════════════════════
  async sendInternetOffNotification(): Promise<boolean> {
    if (!loadModules()) return false;

    try {
      // Check if reminders are enabled
      const prefs = await this.getPreferences();
      if (!prefs.enabled) return false; // Notifications disabled, no need to warn

      // Check if already sent today
      const today = new Date().toDateString();
      const lastSent = await AsyncStorage.getItem(KEYS.INTERNET_NOTIF_SENT);
      if (lastSent === today) {
        console.log('[Sukoon] Internet off notification already sent today');
        return false;
      }

      const granted = await requestPermissions();
      if (!granted) return false;

      const internetTitle = '⚠️ Internet Required';
      const internetBody = 'Turn on internet to receive Salah reminders.';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: internetTitle,
          body: internetBody,
          sound: 'reminder.wav',
          data: {
            type: 'internet-warning',
            action: 'none',
          },
          ...(Platform.OS === 'android' && { channelId: 'daily-reminder' }),
        },
        trigger: null, // Send immediately
        identifier: 'internet-off-warning',
      });

      // Persist to notification storage so it appears on the Notifications screen
      await NotificationStorage.addManual({
        title: internetTitle,
        message: internetBody,
        type: 'general',
        data: { type: 'internet-warning', action: 'none' },
      });

      // Mark as sent for today
      await AsyncStorage.setItem(KEYS.INTERNET_NOTIF_SENT, today);
      console.log('[Sukoon] Internet off notification sent');
      return true;
    } catch (e) {
      console.error('[Sukoon] sendInternetOffNotification error:', e);
      return false;
    }
  },

  // Reset daily notification flags (call at midnight or app start on new day)
  async resetDailyFlags(): Promise<void> {
    try {
      const today = new Date().toDateString();
      const lastReset = await AsyncStorage.getItem('sukoon_last_flag_reset');
      if (lastReset !== today) {
        await AsyncStorage.multiRemove([KEYS.EOD_REMINDER_SENT, KEYS.INTERNET_NOTIF_SENT]);
        await AsyncStorage.setItem('sukoon_last_flag_reset', today);
      }
    } catch {}
  },
};

// ══════════════════════════════════════════════
// BACKGROUND TASK DEFINITION
// Registered lazily inside registerBackgroundTask()
// No module-level defineTask — prevents crash when TaskManager is null
// ══════════════════════════════════════════════
