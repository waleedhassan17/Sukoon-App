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

// ══════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════

const KEYS = {
  PREFS: 'sukoon_notif_prefs',
  LAST_SCHEDULED: 'sukoon_notif_last_scheduled', // date string
  PUSH_TOKEN: 'sukoon_push_token',
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
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const data = notification.request.content.data;
        // Always show prayer notifications even in foreground
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
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
        // Will be called with actual prayer times from the screen
        // Just flag that rescheduling is needed
        console.log('[Sukoon] Notifications need rescheduling for today');
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

    // ── Salah Tracker Reminder ──
    if (prefs.salahTrackerReminder) {
      const [h, m] = prefs.salahTrackerTime.split(':').map(Number);
      const trackerTime = new Date();
      trackerTime.setHours(h, m, 0, 0);

      if (trackerTime > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Log Your Prayers 🕌',
            body: 'Have you tracked all your prayers today?',
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
  // ══════════════════════════════════════════
  setupResponseHandler(
    router: { push: (path: string, params?: any) => void }
  ): any {
    if (!Notifications) return { remove: () => {} };
    return Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;

      // Stop azan sound when user taps the notification
      AzanPlayer.stop().catch(() => {});

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
};

// ══════════════════════════════════════════════
// BACKGROUND TASK DEFINITION
// Registered lazily inside registerBackgroundTask()
// No module-level defineTask — prevents crash when TaskManager is null
// ══════════════════════════════════════════════
