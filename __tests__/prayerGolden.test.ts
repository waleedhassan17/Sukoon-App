/**
 * Golden regression test — the engine's times vs an INDEPENDENT reference.
 *
 * Reference: Aladhan prayer-times API v1 (https://api.aladhan.com), queried on
 * 2026-11-19 for each city below with the authority people in that region follow
 * (the `authority` column). The reference runs on a different implementation, so
 * a match within a few minutes means the method, Asr school, latitude handling
 * and day/timezone logic are all right — and any later change that shifts a time
 * (a swapped method, a wrong Asr default, a date bug) fails here.
 *
 * Tolerance is 3 minutes: the two implementations legitimately differ by
 * 1–2 minutes (rounding, solar-declination sampling) and by up to 3 for Asr at
 * higher latitudes. Everything runs offline — the numbers are fixtures.
 */

import { computeDay, PRAYER_ORDER, PrayerKey, resolveSettings } from '../lib/prayerEngine';

const TOL = 3; // minutes

interface Golden {
  name: string;
  lat: number;
  lng: number;
  date: [number, number, number];
  tz: string; // the location's own timezone (what the reference reports in)
  authority: string;
  ref: Record<PrayerKey, string>; // 'HH:MM' local to `tz`
}

const GOLDEN: Golden[] = [
  { name: "Lahore", lat: 31.5204, lng: 74.3587, date: [2026, 11, 19], tz: "Asia/Karachi",
    authority: 'Aladhan method 1, Hanafi Asr',
    ref: { fajr: '05:09', sunrise: '06:34', dhuhr: '11:48', asr: '15:25', maghrib: '17:02', isha: '18:26' } },
  { name: "Karachi", lat: 24.8607, lng: 67.0011, date: [2026, 11, 19], tz: "Asia/Karachi",
    authority: 'Aladhan method 1, Hanafi Asr',
    ref: { fajr: '05:32', sunrise: '06:51', dhuhr: '12:17', asr: '16:08', maghrib: '17:43', isha: '19:03' } },
  { name: "Islamabad", lat: 33.6844, lng: 73.0479, date: [2026, 11, 19], tz: "Asia/Karachi",
    authority: 'Aladhan method 1, Hanafi Asr',
    ref: { fajr: '05:16', sunrise: '06:43', dhuhr: '11:53', asr: '15:26', maghrib: '17:03', isha: '18:29' } },
  { name: "Dhaka", lat: 23.8103, lng: 90.4125, date: [2026, 11, 19], tz: "Asia/Dhaka",
    authority: 'Aladhan method 1, Hanafi Asr',
    ref: { fajr: '04:57', sunrise: '06:15', dhuhr: '11:44', asr: '15:36', maghrib: '17:12', isha: '18:30' } },
  { name: "Delhi", lat: 28.6139, lng: 77.209, date: [2026, 11, 19], tz: "Asia/Kolkata",
    authority: 'Aladhan method 1, Hanafi Asr',
    ref: { fajr: '05:25', sunrise: '06:47', dhuhr: '12:06', asr: '15:50', maghrib: '17:26', isha: '18:48' } },
  { name: "Makkah", lat: 21.4225, lng: 39.8262, date: [2026, 11, 19], tz: "Asia/Riyadh",
    authority: 'Aladhan method 4, standard Asr',
    ref: { fajr: '05:14', sunrise: '06:34', dhuhr: '12:06', asr: '15:16', maghrib: '17:38', isha: '19:08' } },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753, date: [2026, 11, 19], tz: "Asia/Riyadh",
    authority: 'Aladhan method 4, standard Asr',
    ref: { fajr: '04:51', sunrise: '06:12', dhuhr: '11:39', asr: '14:44', maghrib: '17:05', isha: '18:35' } },
  { name: "Makkah (Ramadan 1447)", lat: 21.4225, lng: 39.8262, date: [2026, 2, 25], tz: "Asia/Riyadh",
    authority: 'Aladhan method 4, standard Asr',
    ref: { fajr: '05:28', sunrise: '06:45', dhuhr: '12:34', asr: '15:53', maghrib: '18:23', isha: '20:23' } },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, date: [2026, 11, 19], tz: "Asia/Dubai",
    authority: 'Aladhan method 16, standard Asr',
    ref: { fajr: '05:18', sunrise: '06:38', dhuhr: '12:07', asr: '15:09', maghrib: '17:33', isha: '18:50' } },
  { name: "Doha", lat: 25.2854, lng: 51.531, date: [2026, 11, 19], tz: "Asia/Qatar",
    authority: 'Aladhan method 10, standard Asr',
    ref: { fajr: '04:34', sunrise: '05:54', dhuhr: '11:19', asr: '14:24', maghrib: '16:45', isha: '18:15' } },
  { name: "Kuwait City", lat: 29.3759, lng: 47.9774, date: [2026, 11, 19], tz: "Asia/Kuwait",
    authority: 'Aladhan method 9, standard Asr',
    ref: { fajr: '04:52', sunrise: '06:15', dhuhr: '11:33', asr: '14:32', maghrib: '16:52', isha: '18:12' } },
  { name: "Cairo", lat: 30.0444, lng: 31.2357, date: [2026, 11, 19], tz: "Africa/Cairo",
    authority: 'Aladhan method 5, standard Asr',
    ref: { fajr: '04:53', sunrise: '06:23', dhuhr: '11:40', asr: '14:38', maghrib: '16:57', isha: '18:18' } },
  { name: "Amman", lat: 31.9454, lng: 35.9284, date: [2026, 11, 19], tz: "Asia/Amman",
    authority: 'Aladhan method 5, standard Asr',
    ref: { fajr: '05:36', sunrise: '07:08', dhuhr: '12:22', asr: '15:16', maghrib: '17:35', isha: '18:57' } },
  { name: "Istanbul", lat: 41.0082, lng: 28.9784, date: [2026, 11, 19], tz: "Europe/Istanbul",
    authority: 'Aladhan method 13, standard Asr',
    ref: { fajr: '06:20', sunrise: '07:49', dhuhr: '12:54', asr: '15:27', maghrib: '17:49', isha: '19:13' } },
  { name: "Tehran", lat: 35.6892, lng: 51.389, date: [2026, 11, 19], tz: "Asia/Tehran",
    authority: 'Aladhan method 7, standard Asr',
    ref: { fajr: '05:17', sunrise: '06:44', dhuhr: '11:50', asr: '14:36', maghrib: '17:15', isha: '18:04' } },
  { name: "London", lat: 51.5072, lng: -0.1276, date: [2026, 11, 19], tz: "Europe/London",
    authority: 'Aladhan method 3, standard Asr',
    ref: { fajr: '05:27', sunrise: '07:25', dhuhr: '11:46', asr: '13:47', maghrib: '16:06', isha: '17:58' } },
  { name: "New York", lat: 40.7128, lng: -74.006, date: [2026, 11, 19], tz: "America/New_York",
    authority: 'Aladhan method 2, standard Asr',
    ref: { fajr: '05:28', sunrise: '06:48', dhuhr: '11:41', asr: '14:16', maghrib: '16:35', isha: '17:54' } },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, date: [2026, 11, 19], tz: "America/Toronto",
    authority: 'Aladhan method 2, standard Asr',
    ref: { fajr: '05:53', sunrise: '07:17', dhuhr: '12:03', asr: '14:29', maghrib: '16:49', isha: '18:12' } },
  { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869, date: [2026, 11, 19], tz: "Asia/Kuala_Lumpur",
    authority: 'Aladhan method 17, standard Asr',
    ref: { fajr: '05:38', sunrise: '06:59', dhuhr: '12:59', asr: '16:22', maghrib: '18:58', isha: '20:11' } },
  { name: "Jakarta", lat: -6.2088, lng: 106.8456, date: [2026, 11, 19], tz: "Asia/Jakarta",
    authority: 'Aladhan method 20, standard Asr',
    ref: { fajr: '04:03', sunrise: '05:26', dhuhr: '11:38', asr: '15:02', maghrib: '17:50', isha: '19:04' } },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, date: [2026, 11, 19], tz: "Asia/Singapore",
    authority: 'Aladhan method 11, standard Asr',
    ref: { fajr: '05:27', sunrise: '06:48', dhuhr: '12:50', asr: '16:14', maghrib: '18:52', isha: '20:05' } },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, date: [2026, 11, 19], tz: "Australia/Sydney",
    authority: 'Aladhan method 3, standard Asr',
    ref: { fajr: '04:04', sunrise: '05:41', dhuhr: '12:40', asr: '16:24', maghrib: '19:40', isha: '21:11' } },
  { name: "Johannesburg", lat: -26.2041, lng: 28.0473, date: [2026, 11, 19], tz: "Africa/Johannesburg",
    authority: 'Aladhan method 3, standard Asr',
    ref: { fajr: '03:43', sunrise: '05:09', dhuhr: '11:53', asr: '15:21', maghrib: '18:38', isha: '19:59' } },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219, date: [2026, 11, 19], tz: "Africa/Nairobi",
    authority: 'Aladhan method 5, standard Asr',
    ref: { fajr: '04:53', sunrise: '06:13', dhuhr: '12:18', asr: '15:42', maghrib: '18:23', isha: '19:35' } },
  { name: "Lagos", lat: 6.5244, lng: 3.3792, date: [2026, 11, 19], tz: "Africa/Lagos",
    authority: 'Aladhan method 5, standard Asr',
    ref: { fajr: '05:18', sunrise: '06:38', dhuhr: '12:32', asr: '15:54', maghrib: '18:26', isha: '19:37' } },
  { name: "Tashkent", lat: 41.2995, lng: 69.2401, date: [2026, 11, 19], tz: "Asia/Tashkent",
    authority: 'Aladhan method 3, Hanafi Asr',
    ref: { fajr: '05:39', sunrise: '07:16', dhuhr: '12:08', asr: '15:20', maghrib: '17:01', isha: '18:32' } },
];

function minutesInTz(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === 'hour')!.value) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')!.value);
  return h * 60 + m;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Signed difference on a 24h clock (handles midnight wrap). */
function delta(a: number, b: number): number {
  let d = a - b;
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return d;
}

describe('engine vs independent reference (offline fixtures)', () => {
  it.each(GOLDEN.map((g) => [g.name, g] as const))('%s', (_name, g) => {
    const coords = { lat: g.lat, lng: g.lng };
    const [y, m, d] = g.date;
    const t = computeDay(coords, new Date(y, m - 1, d), resolveSettings(coords));

    for (const key of PRAYER_ORDER) {
      const diff = delta(minutesInTz(t[key].getTime(), g.tz), toMin(g.ref[key]));
      // Include the key in the failure message so a regression names what moved.
      expect({ city: g.name, authority: g.authority, prayer: key, minutesOff: Math.abs(diff) <= TOL ? 0 : diff }).toEqual({
        city: g.name,
        authority: g.authority,
        prayer: key,
        minutesOff: 0,
      });
    }
  });

  it('covers every region the automatic choice distinguishes', () => {
    const methods = new Set(GOLDEN.map((g) => resolveSettings({ lat: g.lat, lng: g.lng }).method));
    for (const m of ['Karachi', 'UmmAlQura', 'Dubai', 'Qatar', 'Kuwait', 'Egyptian', 'Tehran', 'Turkey', 'NorthAmerica', 'MuslimWorldLeague', 'Singapore']) {
      expect(methods.has(m as any)).toBe(true);
    }
  });

  it('covers both Asr schools', () => {
    const asrs = new Set(GOLDEN.map((g) => resolveSettings({ lat: g.lat, lng: g.lng }).asr));
    expect(asrs).toEqual(new Set(['standard', 'hanafi']));
  });
});
