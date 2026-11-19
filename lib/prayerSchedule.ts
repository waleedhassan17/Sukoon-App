/**
 * prayerSchedule — pure builder for the local prayer-notification schedule.
 *
 * Takes already-computed prayer days (lib/prayerEngine.ts, fully offline) plus
 * the user's notification preferences and returns *what should be scheduled*.
 * It touches no native module, storage or network, so the rules that decide
 * whether an azan fires weeks from now can be unit-tested in plain Node.
 *
 * Design goals
 *  1. Reliability must not depend on the app being opened. We lay down a long
 *     window (up to 30 days) of date-triggered azans in one pass, computed
 *     offline. Even if no background task ever runs, alerts keep firing.
 *  2. Respect platform limits. iOS keeps only the 64 soonest pending local
 *     notifications; Android's AlarmManager allows ~500 per app. The builder
 *     fits the window to a budget and prioritises azans over pre-alerts.
 *  3. Daily nudges (Salah tracker / Quran) use repeating DAILY triggers: one
 *     slot each, forever, no refilling required.
 *  4. Safety net: a single "open Sukoon to refresh" notice is scheduled a couple
 *     of days before the window ends.
 */

import { DayTimes, PrayerKey, SALAH_KEYS } from './prayerEngine';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

/** The slice of NotificationPreferences the builder needs (structural). */
export interface SchedulePrefs {
  enabled: boolean;
  prayerAlerts: Record<PrayerKey, boolean>;
  preAlertMinutes: number;
  azanSound: boolean;
  fajrSpecialSound: boolean;
  salahTrackerReminder: boolean;
  salahTrackerTime: string; // "HH:MM"
  quranReminder: boolean;
  quranReminderTime: string; // "HH:MM"
}

export interface ScheduleDay {
  dateKey: string; // YYYY-MM-DD (local)
  date: Date; // local midnight
  times: DayTimes;
}

/**
 * Android notification channels. IDs are VERSIONED: Android freezes a channel's
 * sound/importance at creation, and recreating a deleted channel restores the
 * old settings, so a changed channel must get a new id.
 */
export const CHANNEL_ID = {
  azan: 'azan-v2',
  'azan-fajr': 'azan-fajr-v2',
  'azan-silent': 'azan-silent-v2',
  reminder: 'reminder-v2',
  daily: 'daily-v2',
} as const;
export type ChannelKey = keyof typeof CHANNEL_ID;

/** Pre-v2 channel ids that should be removed once. */
export const LEGACY_CHANNEL_IDS = ['prayer-azan', 'prayer-fajr', 'prayer-reminder', 'daily-reminder'];

export type SoundFile = 'azan.wav' | 'azan_fajr.wav' | 'reminder.wav';

export interface DateSpec {
  id: string;
  kind: 'azan' | 'pre-alert' | 'refill';
  fireAt: Date;
  title: string;
  body: string;
  channel: ChannelKey;
  sound: SoundFile | null;
  data: Record<string, string | number | boolean>;
}

export interface DailySpec {
  id: string;
  kind: 'tracker' | 'quran';
  hour: number;
  minute: number;
  title: string;
  body: string;
  channel: ChannelKey;
  sound: SoundFile | null;
  data: Record<string, string | number | boolean>;
}

export interface Budget {
  /** Max pending local notifications we allow ourselves (leaves headroom). */
  maxScheduled: number;
  /** Longest window we ever lay down. */
  maxDays: number;
}

export interface ScheduleResult {
  specs: DateSpec[]; // date-triggered, chronological
  dailies: DailySpec[]; // repeating
  /** Last instant covered by the date-triggered azans (null if none). */
  windowEnd: Date | null;
  daysCovered: number;
  /** Everything scheduled, for diffing/diagnostics. */
  total: number;
}

/**
 * iOS hard-caps pending local notifications at 64 (it silently keeps the
 * soonest). Android's AlarmManager throws past ~500 alarms per app. Keep a
 * margin on both for the reminders and the test/EOD notifications we also post.
 */
export function platformBudget(os: string): Budget {
  if (os === 'ios') return { maxScheduled: 60, maxDays: 30 };
  return { maxScheduled: 400, maxDays: 30 };
}

// ══════════════════════════════════════════════
// COPY
// ══════════════════════════════════════════════

const LABEL: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

const BODY: Record<PrayerKey, string> = {
  fajr: 'Rise for Fajr — the angels witness this prayer 🌅',
  sunrise: 'The sun has risen',
  dhuhr: "It's time for Dhuhr prayer 🕐",
  asr: 'Asr prayer time has arrived ☀️',
  maghrib: 'Maghrib prayer time has arrived 🌅',
  isha: 'Complete your day with Isha prayer 🌙',
};

export function prayerLabel(key: PrayerKey, date?: Date): string {
  // Friday's Dhuhr is Jumu'ah.
  if (key === 'dhuhr' && date && date.getDay() === 5) return "Jumu'ah";
  return LABEL[key];
}

export function prayerBody(key: PrayerKey, date?: Date): string {
  if (key === 'dhuhr' && date && date.getDay() === 5) return "It's time for Jumu'ah prayer 🕌";
  return BODY[key];
}

// ══════════════════════════════════════════════
// CHANNEL / SOUND CHOICE
// ══════════════════════════════════════════════

/**
 * Which channel + sound an azan uses. On Android the *channel* owns the sound,
 * so the user's toggles must select a different channel — they can't be applied
 * per-notification.
 */
export function azanChannelAndSound(
  key: PrayerKey,
  prefs: Pick<SchedulePrefs, 'azanSound' | 'fajrSpecialSound'>,
): { channel: ChannelKey; sound: SoundFile | null } {
  if (!prefs.azanSound) return { channel: 'azan-silent', sound: null };
  if (key === 'fajr' && prefs.fajrSpecialSound) return { channel: 'azan-fajr', sound: 'azan_fajr.wav' };
  return { channel: 'azan', sound: 'azan.wav' };
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

export function parseHHMM(s: string, fallback: [number, number]): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return [h, min];
}

/** Stable short hash (djb2) — used to detect whether a scheduled item changed. */
export function sigOf(parts: (string | number | boolean | null)[]): string {
  const s = parts.join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function withSig(spec: Omit<DateSpec, 'data'> & { data: DateSpec['data'] }): DateSpec {
  const sig = sigOf([spec.id, spec.fireAt.getTime(), spec.title, spec.body, spec.channel, spec.sound]);
  return { ...spec, data: { ...spec.data, sig } };
}

/** Build the daily-repeating reminders (1 notification slot each, no refill). */
export function buildDailies(prefs: SchedulePrefs): DailySpec[] {
  const out: DailySpec[] = [];
  if (prefs.salahTrackerReminder) {
    const [hour, minute] = parseHHMM(prefs.salahTrackerTime, [22, 0]);
    out.push({
      id: 'salah-tracker-reminder',
      kind: 'tracker',
      hour,
      minute,
      title: '🌙 Track Your Salah',
      body: 'Have you logged your prayers today? Open the tracker to keep your streak alive.',
      channel: 'daily',
      sound: 'reminder.wav',
      data: { type: 'tracker-reminder', action: 'open-tracker' },
    });
  }
  if (prefs.quranReminder) {
    const [hour, minute] = parseHHMM(prefs.quranReminderTime, [8, 0]);
    out.push({
      id: 'quran-reading-reminder',
      kind: 'quran',
      hour,
      minute,
      title: 'Daily Quran Reading 📖',
      body: 'Take a moment to connect with the Quran today',
      channel: 'daily',
      sound: 'reminder.wav',
      data: { type: 'quran-reminder', action: 'open-quran' },
    });
  }
  return out;
}

// ══════════════════════════════════════════════
// THE BUILDER
// ══════════════════════════════════════════════

/** Pre-alerts are kept for at least this many days when the budget is tight. */
const PRE_ALERT_PRIORITY_DAYS = 3;
/** Refill notice fires this many days before the last covered day. */
const REFILL_LEAD_DAYS = 2;

export function buildSchedule(input: {
  days: ScheduleDay[];
  prefs: SchedulePrefs;
  now: Date;
  budget: Budget;
}): ScheduleResult {
  const { days, prefs, now, budget } = input;
  // Daily reminders (Salah tracker / Quran) have their own switches and do NOT
  // depend on the "Prayer Time Alerts" master toggle, which governs azans only.
  const dailies = buildDailies(prefs);
  const empty: ScheduleResult = { specs: [], dailies, windowEnd: null, daysCovered: 0, total: dailies.length };
  if (!prefs.enabled) return empty;

  const usable = days.slice(0, budget.maxDays);
  const nowMs = now.getTime();
  const wantPre = prefs.preAlertMinutes > 0;

  // Per-day candidates (future only).
  type DayPlan = { day: ScheduleDay; azans: DateSpec[]; pres: DateSpec[] };
  const plans: DayPlan[] = usable.map((day) => {
    const azans: DateSpec[] = [];
    const pres: DateSpec[] = [];
    for (const key of SALAH_KEYS) {
      if (!prefs.prayerAlerts[key]) continue;
      const fireAt = day.times[key];
      if (!(fireAt instanceof Date) || !Number.isFinite(fireAt.getTime())) continue;
      if (fireAt.getTime() <= nowMs) continue;

      const { channel, sound } = azanChannelAndSound(key, prefs);
      azans.push(
        withSig({
          id: `prayer-${key}-${day.dateKey}`,
          kind: 'azan',
          fireAt,
          title: `${prayerLabel(key, day.date)} Prayer Time`,
          body: prayerBody(key, day.date),
          channel,
          sound,
          data: { type: 'prayer', prayer: key, action: 'azan', fireAt: fireAt.getTime() },
        }),
      );

      if (wantPre) {
        const preAt = new Date(fireAt.getTime() - prefs.preAlertMinutes * 60_000);
        if (preAt.getTime() > nowMs) {
          pres.push(
            withSig({
              id: `prayer-pre-${key}-${day.dateKey}`,
              kind: 'pre-alert',
              fireAt: preAt,
              title: `${prayerLabel(key, day.date)} in ${prefs.preAlertMinutes} minutes`,
              body: `Prepare for ${prayerLabel(key, day.date)} prayer`,
              channel: 'reminder',
              sound: 'reminder.wav',
              data: { type: 'prayer-reminder', prayer: key, action: 'pre-alert', fireAt: preAt.getTime() },
            }),
          );
        }
      }
    }
    return { day, azans, pres };
  });

  // Slots available for date triggers: leave room for dailies + the refill notice.
  const avail = Math.max(0, budget.maxScheduled - dailies.length - 1);
  const totalCandidates = plans.reduce((n, p) => n + p.azans.length + p.pres.length, 0);

  let chosen: DayPlan[];
  if (totalCandidates <= avail) {
    // Everything fits (typical on Android).
    chosen = plans;
  } else {
    // Tight budget (iOS): azans for as many WHOLE days as fit, but keep the
    // pre-alerts of the next few days. Whole days only — a half-covered last
    // day would silently drop its later prayers.
    const preReserve = plans
      .slice(0, PRE_ALERT_PRIORITY_DAYS)
      .reduce((n, p) => n + p.pres.length, 0);
    const azanSlots = Math.max(0, avail - preReserve);

    chosen = [];
    let used = 0;
    for (const p of plans) {
      if (used + p.azans.length > azanSlots) break;
      used += p.azans.length;
      chosen.push({ day: p.day, azans: p.azans, pres: [] });
    }
    // Hand the remaining slots to pre-alerts, nearest days first.
    let left = avail - used;
    for (const p of chosen) {
      const src = plans.find((q) => q.day.dateKey === p.day.dateKey)!;
      const keep: DateSpec[] = [];
      for (const pre of src.pres) {
        if (left <= 0) break;
        keep.push(pre);
        left--;
      }
      p.pres = keep;
    }
    // Never end up with zero days just because day 0 is huge: always include at
    // least today's remaining azans if they fit at all.
    if (chosen.length === 0 && plans.length > 0 && plans[0].azans.length <= avail) {
      chosen = [{ day: plans[0].day, azans: plans[0].azans, pres: [] }];
    }
  }

  const specs: DateSpec[] = [];
  for (const p of chosen) specs.push(...p.azans, ...p.pres);

  // Safety net: nudge the user to open the app shortly before the window runs out.
  let windowEnd: Date | null = null;
  const lastDay = chosen.length > 0 ? chosen[chosen.length - 1].day : null;
  if (lastDay) {
    windowEnd = new Date(lastDay.date);
    windowEnd.setHours(23, 59, 59, 999);

    const refillAt = new Date(lastDay.date);
    refillAt.setDate(refillAt.getDate() - REFILL_LEAD_DAYS);
    refillAt.setHours(9, 0, 0, 0);
    if (refillAt.getTime() > nowMs + 60 * 60_000) {
      specs.push(
        withSig({
          id: 'prayer-refill-warning',
          kind: 'refill',
          fireAt: refillAt,
          title: 'Keep your prayer reminders running',
          body: 'Open Sukoon once to refresh your upcoming prayer times and azan alerts.',
          channel: 'reminder',
          sound: 'reminder.wav',
          data: { type: 'refill', action: 'open-prayer', fireAt: refillAt.getTime() },
        }),
      );
    }
  }

  specs.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return {
    specs,
    dailies,
    windowEnd,
    daysCovered: chosen.length,
    total: specs.length + dailies.length,
  };
}

// ══════════════════════════════════════════════
// DIFFING
// ══════════════════════════════════════════════

/** True for identifiers owned by this scheduler (so we never touch others). */
export function isOurId(id: string): boolean {
  return (
    id.startsWith('prayer-') ||
    id === 'salah-tracker-reminder' ||
    id.startsWith('salah-tracker-reminder-') ||
    id === 'quran-reading-reminder' ||
    id.startsWith('quran-reading-reminder-')
  );
}

export interface ExistingScheduled {
  identifier: string;
  sig?: string;
}

/**
 * Compare desired vs already-scheduled. Returns what to cancel (stale, ours
 * only) and what to (re)schedule (new or changed). Items already scheduled with
 * an identical signature are left alone — so a no-op foreground costs zero
 * native writes and a longer window is never wiped to lay a shorter one.
 */
export function diffSchedule(
  desired: { id: string; sig: string }[],
  existing: ExistingScheduled[],
): { cancel: string[]; add: string[] } {
  const want = new Map(desired.map((d) => [d.id, d.sig]));
  const have = new Map(existing.filter((e) => isOurId(e.identifier)).map((e) => [e.identifier, e.sig]));

  const cancel: string[] = [];
  for (const id of have.keys()) if (!want.has(id)) cancel.push(id);

  const add: string[] = [];
  for (const [id, sig] of want) {
    if (!have.has(id) || have.get(id) !== sig) add.push(id);
  }
  return { cancel, add };
}

/** Signature for a DailySpec (they have no fire date). */
export function dailySig(d: DailySpec): string {
  return sigOf([d.id, d.hour, d.minute, d.title, d.body, d.channel, d.sound]);
}
