/**
 * PrayerTimesService — fully OFFLINE prayer times for anywhere in the world.
 *
 * Times are computed on-device from coordinates by `prayerEngine` (the `adhan`
 * astronomical library). There is no network dependency for times, so:
 *   • the screen renders instantly and works in airplane mode,
 *   • the notification scheduler can lay down weeks of alerts without the app
 *     being opened (see lib/prayerSchedule.ts),
 *   • results are absolute instants, so device-vs-location timezone and DST can
 *     never shift a notification.
 *
 * There is no calculation setting to configure: the method and Asr school are
 * derived from the user's location (see lib/prayerEngine.ts), so everyone simply
 * sees the correct times for where they are.
 *
 * This module keeps the public shape the screens already use (`PrayerTimesData`
 * with "HH:MM" strings) and adds epoch `ts` values for accurate countdowns.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  computeDay,
  computeRange,
  DayTimes,
  isValidCoords,
  LatLng,
  nextPrayerAfter,
  NextPrayerInfo,
  PRAYER_ORDER,
  PrayerKey,
  resolveSettings,
} from './prayerEngine';
import { gregorianToHijri, HIJRI_MONTHS_AR, HIJRI_MONTHS_EN } from './hijri';

// ── Storage keys ──
const CACHE_KEYS = {
  /** Short-lived GPS result (decides when to re-ask the OS for a fix). */
  LOCATION: 'sukoon_location_cache', // { lat, lng, name, timestamp }
  /** Persistent last-known coords. The scheduler's only input. No TTL. */
  SCHED_COORDS: 'sukoon_sched_coords', // { lat, lng }
  /** Persistent last-known location incl. display name. No TTL. */
  SAVED_LOCATION: 'sukoon_saved_location', // { lat, lng, name }
};

const LOCATION_TTL_MS = 30 * 60 * 1000; // GPS rarely changes within 30 minutes

export interface HijriDate {
  day: string;
  month: string;
  monthArabic: string;
  monthNumber: number;
  year: string;
  weekday: string;
  weekdayArabic: string;
  fullDate: string;
  holidays: string[];
}

export interface IslamicCalendarData {
  hijri: HijriDate;
  gregorian: {
    day: string;
    month: string;
    year: string;
    weekday: string;
    date: string;
  };
}

export interface PrayerTimesData {
  /** "HH:MM" in the device's local time, 24-hour. */
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  /** Human-readable date, e.g. "19 Nov 2026". */
  date: string;
  hijriDate?: HijriDate;
  /** Absolute instants (epoch ms) — use these for countdowns & scheduling. */
  ts: Record<PrayerKey, number>;
}

export interface UpcomingDay {
  dateKey: string;
  date: Date;
  times: PrayerTimesData;
  instants: DayTimes;
}

const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function readableDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function buildHijri(date: Date): HijriDate {
  const h = gregorianToHijri(date);
  const month = HIJRI_MONTHS_EN[(h.month - 1 + 12) % 12];
  return {
    day: String(h.day),
    month,
    monthArabic: HIJRI_MONTHS_AR[(h.month - 1 + 12) % 12],
    monthNumber: h.month,
    year: String(h.year),
    weekday: WEEKDAYS_EN[date.getDay()],
    weekdayArabic: WEEKDAYS_AR[date.getDay()],
    fullDate: `${h.day} ${month} ${h.year} AH`,
    holidays: [],
  };
}

function toData(times: DayTimes, date: Date): PrayerTimesData {
  const ts = {} as Record<PrayerKey, number>;
  for (const k of PRAYER_ORDER) ts[k] = times[k].getTime();
  return {
    Fajr: hhmm(times.fajr),
    Sunrise: hhmm(times.sunrise),
    Dhuhr: hhmm(times.dhuhr),
    Asr: hhmm(times.asr),
    Maghrib: hhmm(times.maghrib),
    Isha: hhmm(times.isha),
    date: readableDate(date),
    hijriDate: buildHijri(date),
    ts,
  };
}

export const PrayerTimesService = {
  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  _safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },

  // ════════════════════════════════════════
  // LOCATION
  // ════════════════════════════════════════

  /** Fresh GPS fix still within TTL — used to avoid hammering the OS. */
  async getCachedLocation(): Promise<{ lat: number; lng: number; name: string } | null> {
    try {
      const cached = this._safeParse<{ lat: number; lng: number; name: string; timestamp: number }>(
        await AsyncStorage.getItem(CACHE_KEYS.LOCATION),
      );
      if (!cached || !isValidCoords(cached)) return null;
      if (Date.now() - cached.timestamp > LOCATION_TTL_MS) return null;
      return { lat: cached.lat, lng: cached.lng, name: cached.name };
    } catch { return null; }
  },

  /**
   * Remember a location. Writes the short-lived GPS cache AND the persistent
   * last-known location, so the scheduler can always compute future times even
   * if the user never opens the Prayer screen — and even with alerts off at the
   * time, so enabling them later has coordinates ready.
   */
  async cacheLocation(lat: number, lng: number, name: string): Promise<void> {
    if (!isValidCoords({ lat, lng })) return;
    try {
      await AsyncStorage.setItem(CACHE_KEYS.LOCATION, JSON.stringify({ lat, lng, name, timestamp: Date.now() }));
    } catch {}
    await this.saveLocation(lat, lng, name);
  },

  /** Persistent (no TTL) last-known location. Keeps the old name if the new one is blank. */
  async saveLocation(lat: number, lng: number, name?: string): Promise<void> {
    if (!isValidCoords({ lat, lng })) return;
    try {
      let finalName = name ?? '';
      if (!finalName) {
        const prev = await this.getSavedLocation();
        if (prev?.name) finalName = prev.name;
      }
      await AsyncStorage.setItem(CACHE_KEYS.SAVED_LOCATION, JSON.stringify({ lat, lng, name: finalName }));
      await AsyncStorage.setItem(CACHE_KEYS.SCHED_COORDS, JSON.stringify({ lat, lng }));
    } catch {}
  },

  async getSavedLocation(): Promise<{ lat: number; lng: number; name: string } | null> {
    try {
      const s = this._safeParse<{ lat: number; lng: number; name?: string }>(
        await AsyncStorage.getItem(CACHE_KEYS.SAVED_LOCATION),
      );
      if (s && isValidCoords(s)) return { lat: s.lat, lng: s.lng, name: s.name ?? '' };
      // Older installs only have the scheduling coords.
      const c = await this.getSchedulingCoords();
      return c ? { ...c, name: '' } : null;
    } catch { return null; }
  },

  /** Kept for existing callers; same persistent store as `saveLocation`. */
  async cacheSchedulingCoords(lat: number, lng: number): Promise<void> {
    await this.saveLocation(lat, lng);
  },

  async getSchedulingCoords(): Promise<LatLng | null> {
    try {
      const c = this._safeParse<LatLng>(await AsyncStorage.getItem(CACHE_KEYS.SCHED_COORDS));
      return c && isValidCoords(c) ? { lat: c.lat, lng: c.lng } : null;
    } catch { return null; }
  },

  // ════════════════════════════════════════
  // TIMES (offline)
  // ════════════════════════════════════════

  /** One day's times for a location (pure, synchronous, no I/O). */
  computeFor(coords: LatLng, date: Date): PrayerTimesData {
    return toData(computeDay(coords, date, resolveSettings(coords)), date);
  },

  /** One day's times for any coordinates. Never touches the network. */
  async getByCoordinates(lat: number, lng: number, date: Date = new Date()): Promise<PrayerTimesData | null> {
    const coords = { lat, lng };
    if (!isValidCoords(coords)) return null;
    try {
      return this.computeFor(coords, date);
    } catch (e) {
      if (__DEV__) console.warn('[PrayerTimes] compute failed:', e);
      return null;
    }
  },

  /**
   * Today's times for the last-known location, instantly and offline. Replaces
   * the old "cached prayer times" blob — it is always current, never stale.
   * (Name kept for the screens that already call it.)
   */
  async getCachedPrayerTimes(): Promise<{ data: PrayerTimesData; locationName: string } | null> {
    const loc = await this.getSavedLocation();
    if (!loc) return null;
    const data = await this.getByCoordinates(loc.lat, loc.lng);
    return data ? { data, locationName: loc.name } : null;
  },

  /** No-op kept for compatibility: times are derived, not cached. */
  async cachePrayerTimes(_data: PrayerTimesData, _locationName: string): Promise<void> {},

  /**
   * The next `numDays` days (starting today) — the notification scheduler's
   * input. Synchronous maths under the hood, so a 30-day window costs ~ms.
   */
  async getUpcomingDays(lat: number, lng: number, numDays: number, start: Date = new Date()): Promise<UpcomingDay[]> {
    const coords = { lat, lng };
    if (!isValidCoords(coords)) return [];
    return computeRange(coords, numDays, resolveSettings(coords), start).map((d) => ({
      dateKey: d.dateKey,
      date: d.date,
      instants: d.times,
      times: toData(d.times, d.date),
    }));
  },

  /** Next salah (rolls to tomorrow's Fajr after Isha). */
  async getNextPrayerInfo(lat: number, lng: number, now: Date = new Date()): Promise<NextPrayerInfo | null> {
    const coords = { lat, lng };
    if (!isValidCoords(coords)) return null;
    return nextPrayerAfter(coords, resolveSettings(coords), now);
  },

  /**
   * Back-compat helper for callers that only hold a `PrayerTimesData`.
   * Uses the absolute instants, and reports after-Isha correctly (`isActive:
   * false` means the returned Fajr is tomorrow's — the time string is today's
   * Fajr clock time, which is a close approximation for display).
   */
  getNextPrayer(times: PrayerTimesData, now: Date = new Date()): { name: string; time: string; isActive: boolean } | null {
    if (!times?.ts) return null;
    const list: { name: string; key: PrayerKey; time: string }[] = [
      { name: 'Fajr', key: 'fajr', time: times.Fajr },
      { name: 'Dhuhr', key: 'dhuhr', time: times.Dhuhr },
      { name: 'Asr', key: 'asr', time: times.Asr },
      { name: 'Maghrib', key: 'maghrib', time: times.Maghrib },
      { name: 'Isha', key: 'isha', time: times.Isha },
    ];
    for (const p of list) {
      if (times.ts[p.key] > now.getTime()) return { name: p.name, time: p.time, isActive: true };
    }
    return { name: 'Fajr', time: times.Fajr, isActive: false };
  },

  /** Hijri/Gregorian date for today — computed locally, no network. */
  async getIslamicDate(date: Date = new Date()): Promise<IslamicCalendarData | null> {
    try {
      const hijri = buildHijri(date);
      return {
        hijri,
        gregorian: {
          day: String(date.getDate()),
          month: MONTHS_EN[date.getMonth()],
          year: String(date.getFullYear()),
          weekday: WEEKDAYS_EN[date.getDay()],
          date: readableDate(date),
        },
      };
    } catch { return null; }
  },

  // ════════════════════════════════════════
  // FORMATTING
  // ════════════════════════════════════════

  /** "HH:MM" (24h) → "h:mm AM/PM". */
  formatTime(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  },

  /** Epoch ms → "h:mm AM/PM" in the device's local time. */
  formatInstant(ms: number): string {
    const d = new Date(ms);
    return this.formatTime(hhmm(d));
  },
};
