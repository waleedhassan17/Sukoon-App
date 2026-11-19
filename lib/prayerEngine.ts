/**
 * prayerEngine — fully offline, worldwide prayer-time calculation.
 *
 * Pure functions only (no storage, no network, no React Native imports) so the
 * notification scheduler, the Prayer Times screen and the Home screen all share
 * one deterministic source of truth, and it can be unit-tested in plain Node.
 *
 * Times are computed from the device's coordinates with the `adhan` astronomical
 * library and returned as absolute `Date` instants. That means
 *   • notifications can be laid down weeks ahead with no network,
 *   • there is no timezone/DST ambiguity (an instant is an instant),
 *   • it works identically for every country.
 *
 * There is deliberately NO user-facing calculation setting. The calculation
 * method and Asr school are derived from WHERE the user is, using the authority
 * that people in that region actually follow (see REGIONS). The user just sees
 * the correct times for their location.
 */

import {
  Coordinates,
  CalculationMethod,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
} from 'adhan';
import { gregorianToHijri } from './hijri';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

/** Display/notification order of the day's times. */
export const PRAYER_ORDER: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** The five obligatory prayers (sunrise is a marker, not a salah). */
export const SALAH_KEYS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type MethodKey = Exclude<keyof typeof CalculationMethod, 'Other'>;
export type AsrSchool = 'standard' | 'hanafi';

export interface LatLng {
  lat: number;
  lng: number;
}

/** What the calculation uses for a location. Always derived — never user-configured. */
export interface ResolvedSettings {
  method: MethodKey;
  asr: AsrSchool;
}

export type DayTimes = Record<PrayerKey, Date>;

// ══════════════════════════════════════════════
// REGION → AUTHORITY (offline, deterministic)
// ══════════════════════════════════════════════

type Region = {
  name: string;
  method: MethodKey;
  /** Asr school the region's published timetables use. */
  asr: AsrSchool;
  /** Either a lat/lng box or a polygon of [lat, lng] vertices. */
  box?: { latMin: number; latMax: number; lngMin: number; lngMax: number };
  poly?: [number, number][];
};

/** Ray-casting point-in-polygon. Vertices are [lat, lng]. */
function inPolygon(lat: number, lng: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Ordered most-specific → least-specific; the FIRST match wins, so a carve-out
 * must sit above the broader region it is cut from. Anything not matched
 * (Europe, Russia, East Asia, the Americas south of Mexico, southern Africa,
 * Oceania…) gets the Muslim World League with the standard Asr — the widely
 * accepted global default.
 *
 * This is a deliberately coarse table of regional authorities, not a country-
 * border database; its accuracy is pinned by the city matrix in
 * __tests__/prayerEngine.test.ts and the reference times in
 * __tests__/prayerGolden.test.ts.
 */
const REGIONS: Region[] = [
  // ── Gulf states that publish their own timetable ──
  { name: 'Kuwait', method: 'Kuwait', asr: 'standard', box: { latMin: 28.5, latMax: 30.2, lngMin: 46.5, lngMax: 48.6 } },
  { name: 'Qatar', method: 'Qatar', asr: 'standard', box: { latMin: 24.4, latMax: 26.3, lngMin: 50.6, lngMax: 51.8 } },
  { name: 'UAE', method: 'Dubai', asr: 'standard', box: { latMin: 22.6, latMax: 26.3, lngMin: 51.8, lngMax: 56.5 } },
  {
    name: 'Iran',
    method: 'Tehran',
    asr: 'standard',
    poly: [
      [39.4, 44.0], [38.4, 48.9], [37.3, 50.3], [36.9, 54.0], [37.4, 57.0], [37.4, 60.4],
      [35.0, 61.2], [31.0, 61.7], [25.3, 61.6], [25.2, 57.0], [27.0, 56.3], [26.5, 54.0],
      [27.0, 51.5], [28.9, 50.8], [30.0, 48.9], [30.4, 48.2], [32.0, 47.7], [34.0, 45.8],
      [35.8, 45.2], [37.0, 44.8], [38.3, 44.3],
    ],
  },
  // Diyanet's official timetables use the single-shadow Asr even though most Turks are
  // Hanafi — a Hanafi default here would put Asr ~40 min later than every Turkish timetable.
  { name: 'Turkey', method: 'Turkey', asr: 'standard', box: { latMin: 36.3, latMax: 42.2, lngMin: 26.0, lngMax: 44.8 } },

  // ── Egypt, the Levant and the Arabian Peninsula ──
  { name: 'Egypt', method: 'Egyptian', asr: 'standard', box: { latMin: 22.0, latMax: 31.7, lngMin: 24.7, lngMax: 34.9 } },
  { name: 'Levant', method: 'Egyptian', asr: 'standard', box: { latMin: 31.7, latMax: 36.3, lngMin: 34.2, lngMax: 42.4 } },
  { name: 'Arabian Peninsula', method: 'UmmAlQura', asr: 'standard', box: { latMin: 12.5, latMax: 29.5, lngMin: 38.5, lngMax: 59.9 } },
  { name: 'North-west Arabia', method: 'UmmAlQura', asr: 'standard', box: { latMin: 27.5, latMax: 32.0, lngMin: 34.8, lngMax: 48.6 } },

  // ── Maghreb: Fajr 18–19° / Isha 17–18°, closest to the Muslim World League. It also
  //    keeps southern Spain, Portugal and Sardinia out of the Egyptian rule below. ──
  { name: 'Maghreb', method: 'MuslimWorldLeague', asr: 'standard', box: { latMin: 27.0, latMax: 38.0, lngMin: -17.5, lngMax: 11.5 } },

  // ── South Asia. The Shafi'i-majority pockets are carved out FIRST so they keep the
  //    standard Asr; everywhere else in the region Hanafi is the norm. ──
  { name: 'Sri Lanka', method: 'Karachi', asr: 'standard', box: { latMin: 5.8, latMax: 9.9, lngMin: 79.5, lngMax: 82.0 } },
  { name: 'Kerala & Malabar coast', method: 'Karachi', asr: 'standard', box: { latMin: 8.1, latMax: 12.8, lngMin: 74.8, lngMax: 77.4 } },
  // Northern edge stops at 37.3° so Dushanbe/Termez-side Central Asia is not pulled in.
  { name: 'South Asia', method: 'Karachi', asr: 'hanafi', box: { latMin: 5.5, latMax: 37.3, lngMin: 60.8, lngMax: 97.5 } },

  { name: 'Central Asia', method: 'MuslimWorldLeague', asr: 'hanafi', box: { latMin: 35.0, latMax: 55.5, lngMin: 50.0, lngMax: 88.0 } },
  { name: 'South-East Asia', method: 'Singapore', asr: 'standard', box: { latMin: -11.0, latMax: 7.5, lngMin: 95.0, lngMax: 141.0 } },
  // Libya, Sudan, the Horn, East & West Africa. Stops at 34°N so Sicily, Crete, Malta and
  // Cyprus are not swallowed.
  { name: 'North & East Africa', method: 'Egyptian', asr: 'standard', box: { latMin: -12.0, latMax: 34.0, lngMin: -18.0, lngMax: 52.0 } },
  { name: 'North America', method: 'NorthAmerica', asr: 'standard', box: { latMin: 14.0, latMax: 72.0, lngMin: -170.0, lngMax: -52.0 } },
];

export interface RegionInfo {
  name: string;
  method: MethodKey;
  asr: AsrSchool;
}

const WORLDWIDE: RegionInfo = { name: 'Worldwide', method: 'MuslimWorldLeague', asr: 'standard' };

/** The regional authority + Asr school for a coordinate. Offline and deterministic. */
export function regionFor(coords: LatLng): RegionInfo {
  const { lat, lng } = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return WORLDWIDE;
  for (const r of REGIONS) {
    const hit = r.box
      ? lat >= r.box.latMin && lat <= r.box.latMax && lng >= r.box.lngMin && lng <= r.box.lngMax
      : r.poly
        ? inPolygon(lat, lng, r.poly)
        : false;
    if (hit) return { name: r.name, method: r.method, asr: r.asr };
  }
  return WORLDWIDE;
}

/** What to calculate with at this location. */
export function resolveSettings(coords: LatLng): ResolvedSettings {
  const { method, asr } = regionFor(coords);
  return { method, asr };
}

// ══════════════════════════════════════════════
// CALCULATION
// ══════════════════════════════════════════════

/** Valid, finite coordinate pair? */
export function isValidCoords(c: any): c is LatLng {
  return (
    !!c &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

/** Local-midnight copy of a date (adhan reads y/m/d from the local components). */
function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Compute one calendar day's six times as absolute instants.
 * `date` selects the day; only its local year/month/day matter.
 */
export function computeDay(coords: LatLng, date: Date, settings: ResolvedSettings): DayTimes {
  const c = new Coordinates(coords.lat, coords.lng);
  const params = CalculationMethod[settings.method]();
  params.madhab = settings.asr === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(c);
  // Inside the polar circles the sun may not rise/set for weeks, which would
  // otherwise yield Invalid Dates (and "NaN:NaN" on screen). Borrow the nearest
  // day that has valid times instead — the standard fallback.
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;

  // Umm al-Qura: Isha is a fixed 90 min after Maghrib, and the authority adds
  // 30 min during Ramadan (adhan docs). Hijri month 9 = Ramadan.
  if (settings.method === 'UmmAlQura') {
    const h = gregorianToHijri(date);
    if (h.month === 9) params.adjustments.isha += 30;
  }

  const t = new PrayerTimes(c, dayStart(date), params);
  return {
    fajr: t.fajr,
    sunrise: t.sunrise,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
  };
}

/** `YYYY-MM-DD` for a local date. */
export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DayEntry {
  dateKey: string;
  date: Date; // local midnight of that day
  times: DayTimes;
}

/** `numDays` consecutive days starting at `start` (default: today). */
export function computeRange(
  coords: LatLng,
  numDays: number,
  settings: ResolvedSettings,
  start: Date = new Date(),
): DayEntry[] {
  const out: DayEntry[] = [];
  const first = dayStart(start);
  for (let i = 0; i < numDays; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    out.push({ dateKey: dateKeyOf(d), date: d, times: computeDay(coords, d, settings) });
  }
  return out;
}

// ══════════════════════════════════════════════
// NEXT PRAYER
// ══════════════════════════════════════════════

export interface NextPrayerInfo {
  key: PrayerKey;
  time: Date;
  /** True when the next prayer is tomorrow's Fajr (all of today's have passed). */
  isTomorrow: boolean;
}

/**
 * Next *salah* after `now` (sunrise is skipped — it is not a prayer).
 * After Isha it rolls over to tomorrow's Fajr, computed properly rather than
 * re-using today's already-past time.
 */
export function nextPrayerAfter(
  coords: LatLng,
  settings: ResolvedSettings,
  now: Date = new Date(),
): NextPrayerInfo {
  const today = computeDay(coords, now, settings);
  for (const key of SALAH_KEYS) {
    if (today[key].getTime() > now.getTime()) return { key, time: today[key], isTomorrow: false };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { key: 'fajr', time: computeDay(coords, tomorrow, settings).fajr, isTomorrow: true };
}

/** Distance between two points in km (haversine). Used to decide re-scheduling. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
