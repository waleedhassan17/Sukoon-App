/**
 * NotificationService — local prayer/azan notifications.
 *
 * Architecture (why alerts keep firing without opening the app)
 * ─────────────────────────────────────────────────────────────
 *  • Prayer times are computed OFFLINE (lib/prayerEngine.ts) from the last-known
 *    coordinates, so there is nothing to fetch and nothing that can fail.
 *  • lib/prayerSchedule.ts (pure, unit-tested) decides WHAT to schedule: up to
 *    30 days of date-triggered azans on Android, as many whole days as fit under
 *    iOS's 64-notification cap, plus repeating DAILY reminders.
 *  • This module only APPLIES that plan: it diffs against what is already
 *    scheduled (by identifier + signature), cancels stale items and adds new or
 *    changed ones. It never wipes a longer window to lay a shorter one.
 *  • Every call funnels through ONE queue (`syncSchedule`) so concurrent callers
 *    — app start, foreground, location change, settings toggles, the background
 *    task — can never interleave a cancel with a re-lay.
 *  • A module-scope background task (lib/prayerBackgroundTask.ts) tops the
 *    window up periodically as a bonus, but reliability does NOT depend on it.
 *
 * Android channel note: expo-notifications reads the channel from the TRIGGER
 * (`trigger.channelId`), not from the content. Putting it in `content` is
 * silently ignored and the notification lands on the fallback channel with the
 * default sound — so every scheduled notification here sets it on the trigger.
 */

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
import { Platform } from 'react-native';
import { AzanPlayer } from './azanPlayer';
import { NotificationStorage } from './notificationStorage';
import { PrayerTimesService } from './prayerTimes';
import { isValidCoords, LatLng } from './prayerEngine';
import {
  azanChannelAndSound,
  buildSchedule,
  CHANNEL_ID,
  DailySpec,
  dailySig,
  DateSpec,
  diffSchedule,
  isOurId,
  LEGACY_CHANNEL_IDS,
  platformBudget,
  prayerBody,
  ScheduleResult,
} from './prayerSchedule';
import { PRAYER_TASK_NAME } from './prayerBackgroundTask';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

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

export interface SyncResult {
  ok: boolean;
  /** Why nothing was scheduled, when `ok` is false (or the master toggle is off). */
  reason?: 'unavailable' | 'disabled' | 'permission' | 'no-location' | 'no-times' | 'error';
  /** True when at least one notification was added, changed or cancelled. */
  changed: boolean;
  /** Total notifications that should now be pending. */
  count: number;
  /** Epoch ms of the end of the covered window (azans), if any. */
  through: number | null;
}

export interface ScheduleHealth {
  available: boolean;
  permission: 'granted' | 'denied' | 'undetermined';
  /** All pending notifications owned by this scheduler. */
  scheduledCount: number;
  azanCount: number;
  /** Epoch ms of the soonest / furthest pending azan. */
  nextAzanAt: number | null;
  lastAzanAt: number | null;
  /** Android channels the user has turned fully off in system settings. */
  blockedChannels: string[];
}

// ══════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════

const KEYS = {
  PREFS: 'sukoon_notif_prefs',
  SCHEDULE_META: 'sukoon_notif_schedule_meta', // { at, through, count, daysCovered }
  CHANNELS_VERSION: 'sukoon_notif_channels_version',
  PUSH_TOKEN: 'sukoon_push_token',
  // Track end-of-day reminder sent today
  EOD_REMINDER_SENT: 'sukoon_eod_reminder_sent',
};

const CHANNELS_VERSION = '2';

// ══════════════════════════════════════════════
// DEFAULT PREFERENCES
// ══════════════════════════════════════════════

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  prayerAlerts: {
    fajr: true,
    sunrise: false,  // sunrise is not a salah — never scheduled
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

/**
 * Create the (versioned) channels that don't exist yet. We never delete and
 * recreate on every launch: Android restores a deleted channel's old settings
 * when the same id returns, and deleting also clears delivered notifications.
 * Changed channel config ⇒ bump the id suffix in lib/prayerSchedule.ts instead.
 */
async function setupChannels(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;

  // One-time removal of the pre-v2 channels (their sounds were never applied
  // because notifications were never routed to them).
  try {
    const done = await AsyncStorage.getItem(KEYS.CHANNELS_VERSION);
    if (done !== CHANNELS_VERSION) {
      for (const id of LEGACY_CHANNEL_IDS) {
        await Notifications.deleteNotificationChannelAsync(id).catch(() => {});
      }
      await AsyncStorage.setItem(KEYS.CHANNELS_VERSION, CHANNELS_VERSION);
    }
  } catch {}

  const N = Notifications;
  const defs: { id: string; config: any }[] = [
    {
      id: CHANNEL_ID.azan,
      config: {
        name: 'Prayer Azan',
        description: 'Azan at prayer time',
        importance: N.AndroidImportance.HIGH,
        sound: 'azan.wav',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2D6A4F',
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        enableLights: true,
        enableVibrate: true,
      },
    },
    {
      id: CHANNEL_ID['azan-fajr'],
      config: {
        name: 'Fajr Azan',
        description: 'Special azan for Fajr',
        importance: N.AndroidImportance.HIGH,
        sound: 'azan_fajr.wav',
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#56A8E2',
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        enableLights: true,
        enableVibrate: true,
      },
    },
    {
      id: CHANNEL_ID['azan-silent'],
      config: {
        name: 'Prayer Alerts (silent)',
        description: 'Prayer-time alerts without the azan sound',
        importance: N.AndroidImportance.HIGH,
        sound: null,
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
      },
    },
    {
      id: CHANNEL_ID.reminder,
      config: {
        name: 'Prayer Reminders',
        description: 'Gentle reminder shortly before prayer time',
        importance: N.AndroidImportance.DEFAULT,
        sound: 'reminder.wav',
        vibrationPattern: [0, 200],
        lightColor: '#D4A373',
      },
    },
    {
      id: CHANNEL_ID.daily,
      config: {
        name: 'Daily Reminders',
        description: 'Salah tracker and Quran reading reminders',
        importance: N.AndroidImportance.DEFAULT,
        sound: 'reminder.wav',
      },
    },
    {
      // Target of the Cloud Function push notifications (Salah Buddy).
      id: 'sukoon-friends',
      config: {
        name: 'Friends & Streaks',
        description: 'Salah Buddy nudges and streak updates',
        importance: N.AndroidImportance.DEFAULT,
      },
    },
  ];

  let existing = new Set<string>();
  try {
    const list = await Notifications.getNotificationChannelsAsync();
    existing = new Set((list ?? []).map((c: any) => c.id));
  } catch {}

  for (const d of defs) {
    if (existing.has(d.id)) continue;
    try {
      await Notifications.setNotificationChannelAsync(d.id, d.config);
    } catch (e) {
      if (__DEV__) console.warn('[Sukoon] channel setup failed:', d.id, e);
    }
  }
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
// SERIALISATION
// All schedule mutations run through this queue, so a foreground re-sync can
// never interleave with a settings change or the background task.
// ══════════════════════════════════════════════

let _queue: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const p = _queue.then(fn, fn);
  _queue = p.catch(() => {});
  return p;
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

    // Channels first (cheap, only creates what's missing)…
    await setupChannels();

    // …then top the window up in the background. Everything here is offline, but
    // a first-time lay of ~300 notifications takes a moment, so never hold the
    // splash screen for it. The queue makes overlapping calls safe.
    this.syncSchedule().catch(() => {});
  },

  // ── PREFERENCES ──
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PREFS);
      if (raw) {
        const stored = JSON.parse(raw);
        // Merge with defaults (handles new fields added in updates)
        return {
          ...DEFAULT_PREFS,
          ...stored,
          prayerAlerts: { ...DEFAULT_PREFS.prayerAlerts, ...(stored?.prayerAlerts ?? {}) },
        };
      }
      return { ...DEFAULT_PREFS, prayerAlerts: { ...DEFAULT_PREFS.prayerAlerts } };
    } catch {
      return { ...DEFAULT_PREFS, prayerAlerts: { ...DEFAULT_PREFS.prayerAlerts } };
    }
  },

  async savePreferences(prefs: NotificationPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));

      // A daily reminder switched on with the master off still needs the OS
      // permission (a no-op if already granted) — the user just asked for it.
      if (!prefs.enabled && (prefs.salahTrackerReminder || prefs.quranReminder) && loadModules()) {
        await setupChannels();
        await requestPermissions().catch(() => false);
      }

      // Re-sync with the latest preferences. The diff touches only what changed
      // (e.g. a sound toggle swaps channels; a pre-alert change rewrites those
      // items), and turning everything off cancels our schedule.
      await this.syncSchedule().catch(() => {});
    } catch {}
  },

  // ── MASTER ENABLE/DISABLE ──
  async enableNotifications(): Promise<boolean> {
    if (!loadModules()) return false;
    const granted = await requestPermissions();
    if (!granted) return false;

    await setupChannels();
    const prefs = await this.getPreferences();
    prefs.enabled = true;
    await this.savePreferences(prefs);
    return true;
  },

  async disableNotifications(): Promise<void> {
    const prefs = await this.getPreferences();
    prefs.enabled = false;
    await this.savePreferences(prefs);
  },

  // ══════════════════════════════════════════
  // THE SCHEDULER
  // Single entry point. Safe to call as often as you like: from app start, every
  // foreground, after a location change, after a settings change, and from the
  // background task. Offline, idempotent, serialised.
  // ══════════════════════════════════════════
  async syncSchedule(coords?: LatLng): Promise<SyncResult> {
    if (!loadModules()) return { ok: false, reason: 'unavailable', changed: false, count: 0, through: null };

    return runExclusive(async (): Promise<SyncResult> => {
      try {
        // Remember the location regardless of whether alerts are on, so that
        // turning them on later always has coordinates ready.
        if (coords && isValidCoords(coords)) {
          await PrayerTimesService.saveLocation(coords.lat, coords.lng);
        }

        const prefs = await this.getPreferences();
        // Azans follow the master toggle; the Salah-tracker / Quran reminders
        // have their own switches and work even with the master off.
        const anyDaily = prefs.salahTrackerReminder || prefs.quranReminder;
        if (!prefs.enabled && !anyDaily) {
          const removed = await this._cancelOurs();
          return { ok: true, reason: 'disabled', changed: removed > 0, count: 0, through: null };
        }

        const perm = await Notifications.getPermissionsAsync();
        if (perm?.status !== 'granted') {
          return { ok: false, reason: 'permission', changed: false, count: 0, through: null };
        }

        const now = new Date();
        const budget = platformBudget(Platform.OS);
        let days: Awaited<ReturnType<typeof PrayerTimesService.getUpcomingDays>> = [];
        if (prefs.enabled) {
          const loc = await PrayerTimesService.getSchedulingCoords();
          if (!loc && !anyDaily) {
            return { ok: false, reason: 'no-location', changed: false, count: 0, through: null };
          }
          if (loc) {
            days = await PrayerTimesService.getUpcomingDays(loc.lat, loc.lng, budget.maxDays, now);
            if (!days.length && !anyDaily) {
              return { ok: false, reason: 'no-times', changed: false, count: 0, through: null };
            }
          }
        }

        const result = buildSchedule({
          days: days.map((d) => ({ dateKey: d.dateKey, date: d.date, times: d.instants })),
          prefs,
          now,
          budget,
        });

        const changed = await this._apply(result);

        const through = result.windowEnd ? result.windowEnd.getTime() : null;
        await AsyncStorage.setItem(
          KEYS.SCHEDULE_META,
          JSON.stringify({ at: now.getTime(), through, count: result.total, daysCovered: result.daysCovered }),
        ).catch(() => {});

        return { ok: true, changed, count: result.total, through };
      } catch (e) {
        if (__DEV__) console.warn('[Sukoon] syncSchedule failed:', e);
        return { ok: false, reason: 'error', changed: false, count: 0, through: null };
      }
    });
  },

  /** Back-compat: re-run the scheduler. Returns true if a schedule is in place. */
  async scheduleRollingWindow(coords?: LatLng): Promise<boolean> {
    const r = await this.syncSchedule(coords);
    return r.ok && r.reason !== 'disabled';
  },

  /** Back-compat alias used by background/boot paths. */
  async rescheduleFromCache(): Promise<void> {
    await this.syncSchedule();
  },

  /** Diff the desired plan against what is pending and apply only the delta. */
  async _apply(result: ScheduleResult): Promise<boolean> {
    const scheduled: any[] = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
    const existing = scheduled.map((n) => ({
      identifier: n.identifier as string,
      sig: n.content?.data?.sig as string | undefined,
    }));

    const desired = [
      ...result.dailies.map((d) => ({ id: d.id, sig: dailySig(d) })),
      ...result.specs.map((s) => ({ id: s.id, sig: s.data.sig as string })),
    ];
    const { cancel, add } = diffSchedule(desired, existing);

    for (const id of cancel) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }

    const toAdd = new Set(add);
    // Soonest first: if the OS gives us little time (background run), the
    // notifications that matter most are already in place.
    const ordered: (DailySpec | DateSpec)[] = [
      ...result.dailies.filter((d) => toAdd.has(d.id)),
      ...result.specs.filter((s) => toAdd.has(s.id)),
    ];

    let failures = 0;
    for (const spec of ordered) {
      try {
        await this._scheduleSpec(spec);
      } catch (e) {
        failures++;
        if (__DEV__) console.warn('[Sukoon] schedule failed:', spec.id, e);
        // Stop hammering the OS if it is refusing (e.g. alarm cap reached).
        if (failures >= 5) break;
      }
    }
    return cancel.length + add.length > 0;
  },

  async _scheduleSpec(spec: DailySpec | DateSpec): Promise<void> {
    const N = Notifications;
    const isAndroid = Platform.OS === 'android';
    // Channel goes on the TRIGGER (see file header). iOS ignores it.
    const channelId = CHANNEL_ID[spec.channel];
    const isDaily = 'hour' in spec;

    const data: Record<string, any> = { ...spec.data };
    if (isDaily) data.sig = dailySig(spec as DailySpec);

    const trigger = isDaily
      ? {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour: (spec as DailySpec).hour,
          minute: (spec as DailySpec).minute,
          ...(isAndroid && { channelId }),
        }
      : {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: (spec as DateSpec).fireAt,
          ...(isAndroid && { channelId }),
        };

    await N.scheduleNotificationAsync({
      identifier: spec.id,
      content: {
        title: spec.title,
        body: spec.body,
        // iOS plays this file; on Android the channel owns the sound.
        sound: spec.sound ?? false,
        data,
        // iOS: 'timeSensitive' needs the Time Sensitive entitlement — enable it
        // together with the capability, not before.
      },
      trigger,
    });
  },

  /** Cancel every notification owned by this scheduler. Returns how many. */
  async _cancelOurs(): Promise<number> {
    if (!Notifications) return 0;
    const all: any[] = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
    let n = 0;
    for (const notif of all) {
      const id: string = notif.identifier ?? '';
      if (isOurId(id)) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        n++;
      }
    }
    return n;
  },

  // ── Cancel helpers ──
  async cancelPrayerNotifications(): Promise<void> {
    if (!loadModules()) return;
    await this._cancelOurs();
  },

  async cancelAll(): Promise<void> {
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  // ── Debug: list all scheduled ──
  async getScheduledNotifications(): Promise<any[]> {
    if (!loadModules()) return [];
    return Notifications.getAllScheduledNotificationsAsync();
  },

  // ══════════════════════════════════════════
  // HEALTH CHECK
  // What the user (and support) needs to know: is permission granted, how far
  // ahead are alerts actually pending, is a channel muted in system settings.
  // ══════════════════════════════════════════
  async getScheduleHealth(): Promise<ScheduleHealth> {
    const base: ScheduleHealth = {
      available: false,
      permission: 'undetermined',
      scheduledCount: 0,
      azanCount: 0,
      nextAzanAt: null,
      lastAzanAt: null,
      blockedChannels: [],
    };
    if (!loadModules()) return base;

    try {
      const perm = await Notifications.getPermissionsAsync();
      const status: ScheduleHealth['permission'] =
        perm?.status === 'granted' ? 'granted' : perm?.status === 'denied' ? 'denied' : 'undetermined';

      const all: any[] = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
      const ours = all.filter((n) => isOurId(n.identifier ?? ''));
      const azanTimes = ours
        .filter((n) => n.content?.data?.action === 'azan')
        .map((n) => Number(n.content?.data?.fireAt))
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);

      const blocked: string[] = [];
      if (Platform.OS === 'android') {
        try {
          const chans: any[] = (await Notifications.getNotificationChannelsAsync()) ?? [];
          const ours2 = new Set<string>(Object.values(CHANNEL_ID));
          for (const c of chans) {
            if (ours2.has(c.id) && c.importance === Notifications.AndroidImportance.NONE) blocked.push(c.name ?? c.id);
          }
        } catch {}
      }

      return {
        available: true,
        permission: status,
        scheduledCount: ours.length,
        azanCount: azanTimes.length,
        nextAzanAt: azanTimes[0] ?? null,
        lastAzanAt: azanTimes.length ? azanTimes[azanTimes.length - 1] : null,
        blockedChannels: blocked,
      };
    } catch {
      return base;
    }
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
      // 2. Otherwise, play it only if the prayer time is still fresh
      //    (AzanPlayer ignores taps on stale notifications).
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
        case 'open-prayer':
          router.push('/tools/prayer');
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
  // BACKGROUND TOP-UP
  // The task itself is DEFINED at module scope in lib/prayerBackgroundTask.ts
  // (expo-task-manager requires that — a background launch mounts no React
  // tree, so a definition inside a component/effect is never seen and the OS
  // unregisters the task). Here we only REGISTER it. It is a bonus: the 30-day
  // (Android) / multi-day (iOS) window already covers an unopened app.
  // ══════════════════════════════════════════
  async registerBackgroundTask(): Promise<void> {
    if (!loadModules() || !TaskManager || !BackgroundFetch) return;
    try {
      const status = await BackgroundFetch.getStatusAsync?.();
      if (
        status === BackgroundFetch.BackgroundFetchStatus?.Restricted ||
        status === BackgroundFetch.BackgroundFetchStatus?.Denied
      ) {
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(PRAYER_TASK_NAME);
      if (isRegistered) return;

      await BackgroundFetch.registerTaskAsync(PRAYER_TASK_NAME, {
        minimumInterval: 60 * 60 * 6, // hint only; the OS decides
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (e) {
      if (__DEV__) console.warn('[Sukoon] Background task registration failed:', e);
    }
  },

  async unregisterBackgroundTask(): Promise<void> {
    if (!loadModules() || !TaskManager || !BackgroundFetch) return;
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(PRAYER_TASK_NAME);
      if (isRegistered) await BackgroundFetch.unregisterTaskAsync(PRAYER_TASK_NAME);
    } catch {}
  },

  // ══════════════════════════════════════════
  // TEST AZAN
  // Schedules a real azan notification `delaySec` seconds from now through the
  // same channel/sound the user's preferences select. Used by the Reliability
  // section in Salah settings so people can verify sound, DND and battery
  // behaviour on their own device.
  // ══════════════════════════════════════════
  async scheduleTestAzan(delaySec: number = 5): Promise<boolean> {
    if (!loadModules()) return false;

    const granted = await requestPermissions();
    if (!granted) return false;
    await setupChannels();

    const prefs = await this.getPreferences();
    const { channel, sound } = azanChannelAndSound('dhuhr', prefs);
    const triggerDate = new Date(Date.now() + delaySec * 1000);
    const title = 'Test Azan';
    const body = prayerBody('dhuhr');

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: sound ?? false,
          data: {
            type: 'prayer',
            prayer: 'dhuhr',
            action: 'azan',
            fireAt: triggerDate.getTime(),
            isTest: true,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          ...(Platform.OS === 'android' && { channelId: CHANNEL_ID[channel] }),
        },
        identifier: `test-azan-${Date.now()}`,
      });

      // Save to persistent notification storage immediately
      await NotificationStorage.addManual({
        title,
        message: body,
        type: 'azan',
        data: { prayer: 'dhuhr', action: 'azan', isTest: true },
      });

      return true;
    } catch (e) {
      console.error('[Sukoon] scheduleTestAzan error:', e);
      return false;
    }
  },

  // ══════════════════════════════════════════════════════════════
  // END-OF-DAY UNTRACKED PRAYER REMINDER
  // Send notification after Isha if any prayer is untracked today.
  // Only sends once per day.
  // ══════════════════════════════════════════════════════════════
  async sendEndOfDayReminder(untrackedCount: number): Promise<boolean> {
    if (!loadModules()) return false;
    if (untrackedCount === 0) return false; // All prayers tracked

    try {
      // Check if already sent today
      const today = new Date().toDateString();
      const lastSent = await AsyncStorage.getItem(KEYS.EOD_REMINDER_SENT);
      if (lastSent === today) return false;

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
        },
        // Immediate delivery. On Android the channel is carried by the trigger.
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID.daily } : null,
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
      return true;
    } catch (e) {
      console.error('[Sukoon] sendEndOfDayReminder error:', e);
      return false;
    }
  },

  // Reset daily notification flags (call at midnight or app start on new day)
  async resetDailyFlags(): Promise<void> {
    try {
      const today = new Date().toDateString();
      const lastReset = await AsyncStorage.getItem('sukoon_last_flag_reset');
      if (lastReset !== today) {
        await AsyncStorage.multiRemove([KEYS.EOD_REMINDER_SENT]);
        await AsyncStorage.setItem('sukoon_last_flag_reset', today);
      }
    } catch {}
  },
};
