/**
 * Offline prayer engine.
 *
 * There is no user-facing calculation setting, so the automatic, location-based
 * choice of method and Asr school IS the product. The city matrix below pins it
 * for every region; __tests__/prayerGolden.test.ts pins the resulting times
 * against an independent reference.
 */

import { CalculationMethod } from 'adhan';
import {
  computeDay,
  computeRange,
  dateKeyOf,
  distanceKm,
  isValidCoords,
  MethodKey,
  nextPrayerAfter,
  PRAYER_ORDER,
  regionFor,
  resolveSettings,
} from '../lib/prayerEngine';

type Authority = [method: MethodKey, asr: 'standard' | 'hanafi'];

// name: [lat, lng, expected method, expected Asr school]
const CITY_MATRIX: Record<string, [number, number, ...Authority]> = {
  // ── Pakistan: University of Islamic Sciences, Karachi + Hanafi Asr ──
  Lahore: [31.5204, 74.3587, 'Karachi', 'hanafi'],
  Karachi: [24.8607, 67.0011, 'Karachi', 'hanafi'],
  Islamabad: [33.6844, 73.0479, 'Karachi', 'hanafi'],
  Peshawar: [34.0151, 71.5249, 'Karachi', 'hanafi'],
  Quetta: [30.1798, 66.975, 'Karachi', 'hanafi'],
  Multan: [30.1575, 71.5249, 'Karachi', 'hanafi'],
  Faisalabad: [31.4504, 73.135, 'Karachi', 'hanafi'],
  Gwadar: [25.1216, 62.3254, 'Karachi', 'hanafi'],
  Gilgit: [35.9208, 74.308, 'Karachi', 'hanafi'],
  // ── India, Bangladesh, Afghanistan, Nepal ──
  Delhi: [28.6139, 77.209, 'Karachi', 'hanafi'],
  Mumbai: [19.076, 72.8777, 'Karachi', 'hanafi'],
  Kolkata: [22.5726, 88.3639, 'Karachi', 'hanafi'],
  HyderabadIN: [17.385, 78.4867, 'Karachi', 'hanafi'],
  Bengaluru: [12.9716, 77.5946, 'Karachi', 'hanafi'],
  Srinagar: [34.0837, 74.7973, 'Karachi', 'hanafi'],
  Dhaka: [23.8103, 90.4125, 'Karachi', 'hanafi'],
  Chittagong: [22.3569, 91.7832, 'Karachi', 'hanafi'],
  Kabul: [34.5553, 69.2075, 'Karachi', 'hanafi'],
  Kandahar: [31.6289, 65.7372, 'Karachi', 'hanafi'],
  Herat: [34.3529, 62.204, 'Karachi', 'hanafi'],
  MazarISharif: [36.709, 67.11, 'Karachi', 'hanafi'],
  Kathmandu: [27.7172, 85.324, 'Karachi', 'hanafi'],
  // ── Shafi'i pockets of South Asia keep the standard Asr ──
  Colombo: [6.9271, 79.8612, 'Karachi', 'standard'],
  Kochi: [9.9312, 76.2673, 'Karachi', 'standard'],
  Kozhikode: [11.2588, 75.7804, 'Karachi', 'standard'],
  Thiruvananthapuram: [8.5241, 76.9366, 'Karachi', 'standard'],
  // ── Saudi Arabia, Yemen, Oman, Bahrain: Umm al-Qura ──
  Makkah: [21.4225, 39.8262, 'UmmAlQura', 'standard'],
  Madinah: [24.4672, 39.6111, 'UmmAlQura', 'standard'],
  Jeddah: [21.4858, 39.1925, 'UmmAlQura', 'standard'],
  Riyadh: [24.7136, 46.6753, 'UmmAlQura', 'standard'],
  Dammam: [26.4207, 50.0888, 'UmmAlQura', 'standard'],
  Muscat: [23.588, 58.3829, 'UmmAlQura', 'standard'],
  Sanaa: [15.3694, 44.191, 'UmmAlQura', 'standard'],
  // ── Gulf states with their own authority ──
  Dubai: [25.2048, 55.2708, 'Dubai', 'standard'],
  AbuDhabi: [24.4539, 54.3773, 'Dubai', 'standard'],
  Doha: [25.2854, 51.531, 'Qatar', 'standard'],
  KuwaitCity: [29.3759, 47.9774, 'Kuwait', 'standard'],
  // ── Iran ──
  Tehran: [35.6892, 51.389, 'Tehran', 'standard'],
  Mashhad: [36.2605, 59.6168, 'Tehran', 'standard'],
  Shiraz: [29.5918, 52.5836, 'Tehran', 'standard'],
  Isfahan: [32.6546, 51.668, 'Tehran', 'standard'],
  Zahedan: [29.4963, 60.8629, 'Tehran', 'standard'],
  // ── Turkey: Diyanet, single-shadow Asr ──
  Istanbul: [41.0082, 28.9784, 'Turkey', 'standard'],
  Ankara: [39.9334, 32.8597, 'Turkey', 'standard'],
  Izmir: [38.4237, 27.1428, 'Turkey', 'standard'],
  // ── Egypt, the Levant, Libya, Sudan, East & West Africa: Egyptian ──
  Cairo: [30.0444, 31.2357, 'Egyptian', 'standard'],
  Alexandria: [31.2001, 29.9187, 'Egyptian', 'standard'],
  Gaza: [31.5, 34.47, 'Egyptian', 'standard'],
  Jerusalem: [31.7683, 35.2137, 'Egyptian', 'standard'],
  Amman: [31.9454, 35.9284, 'Egyptian', 'standard'],
  Damascus: [33.5138, 36.2765, 'Egyptian', 'standard'],
  Beirut: [33.8938, 35.5018, 'Egyptian', 'standard'],
  Tripoli: [32.8872, 13.1913, 'Egyptian', 'standard'],
  Khartoum: [15.5007, 32.5599, 'Egyptian', 'standard'],
  Nairobi: [-1.2921, 36.8219, 'Egyptian', 'standard'],
  Mogadishu: [2.0469, 45.3182, 'Egyptian', 'standard'],
  DarEsSalaam: [-6.7924, 39.2083, 'Egyptian', 'standard'],
  AddisAbaba: [9.03, 38.74, 'Egyptian', 'standard'],
  Lagos: [6.5244, 3.3792, 'Egyptian', 'standard'],
  Kano: [12.0022, 8.5919, 'Egyptian', 'standard'],
  Dakar: [14.7167, -17.4677, 'Egyptian', 'standard'],
  // ── Maghreb (and southern Iberia) — Muslim World League ──
  Casablanca: [33.5731, -7.5898, 'MuslimWorldLeague', 'standard'],
  Rabat: [34.0209, -6.8416, 'MuslimWorldLeague', 'standard'],
  Algiers: [36.7538, 3.0588, 'MuslimWorldLeague', 'standard'],
  Tunis: [36.8065, 10.1815, 'MuslimWorldLeague', 'standard'],
  Seville: [37.3891, -5.9845, 'MuslimWorldLeague', 'standard'],
  // ── Central Asia: Hanafi ──
  Tashkent: [41.2995, 69.2401, 'MuslimWorldLeague', 'hanafi'],
  Almaty: [43.222, 76.8512, 'MuslimWorldLeague', 'hanafi'],
  Dushanbe: [38.5598, 68.787, 'MuslimWorldLeague', 'hanafi'],
  Bishkek: [42.8746, 74.5698, 'MuslimWorldLeague', 'hanafi'],
  Ashgabat: [37.9601, 58.3261, 'MuslimWorldLeague', 'hanafi'],
  Urumqi: [43.8256, 87.6168, 'MuslimWorldLeague', 'hanafi'],
  // ── Malaysia, Indonesia, Singapore, Brunei, southern Philippines ──
  KualaLumpur: [3.139, 101.6869, 'Singapore', 'standard'],
  Jakarta: [-6.2088, 106.8456, 'Singapore', 'standard'],
  Surabaya: [-7.2575, 112.7521, 'Singapore', 'standard'],
  Medan: [3.5952, 98.6722, 'Singapore', 'standard'],
  SingaporeCity: [1.3521, 103.8198, 'Singapore', 'standard'],
  BandarSeriBegawan: [4.9031, 114.9398, 'Singapore', 'standard'],
  Davao: [7.0731, 125.6128, 'Singapore', 'standard'],
  // ── North America: ISNA ──
  NewYork: [40.7128, -74.006, 'NorthAmerica', 'standard'],
  Chicago: [41.8781, -87.6298, 'NorthAmerica', 'standard'],
  LosAngeles: [34.0522, -118.2437, 'NorthAmerica', 'standard'],
  Houston: [29.7604, -95.3698, 'NorthAmerica', 'standard'],
  Toronto: [43.6532, -79.3832, 'NorthAmerica', 'standard'],
  MexicoCity: [19.4326, -99.1332, 'NorthAmerica', 'standard'],
  // ── Everywhere else: Muslim World League, standard Asr ──
  London: [51.5072, -0.1276, 'MuslimWorldLeague', 'standard'],
  Paris: [48.8566, 2.3522, 'MuslimWorldLeague', 'standard'],
  Berlin: [52.52, 13.405, 'MuslimWorldLeague', 'standard'],
  Madrid: [40.4168, -3.7038, 'MuslimWorldLeague', 'standard'],
  Sarajevo: [43.8563, 18.4131, 'MuslimWorldLeague', 'standard'],
  Moscow: [55.7558, 37.6173, 'MuslimWorldLeague', 'standard'],
  Oslo: [59.9139, 10.7522, 'MuslimWorldLeague', 'standard'],
  Valletta: [35.8989, 14.5146, 'MuslimWorldLeague', 'standard'],
  Palermo: [38.1157, 13.3615, 'MuslimWorldLeague', 'standard'],
  Athens: [37.9838, 23.7275, 'MuslimWorldLeague', 'standard'],
  Nicosia: [35.1856, 33.3823, 'MuslimWorldLeague', 'standard'],
  Sydney: [-33.8688, 151.2093, 'MuslimWorldLeague', 'standard'],
  Auckland: [-36.8485, 174.7633, 'MuslimWorldLeague', 'standard'],
  SaoPaulo: [-23.5505, -46.6333, 'MuslimWorldLeague', 'standard'],
  Johannesburg: [-26.2041, 28.0473, 'MuslimWorldLeague', 'standard'],
  CapeTown: [-33.9249, 18.4241, 'MuslimWorldLeague', 'standard'],
  Tokyo: [35.6762, 139.6503, 'MuslimWorldLeague', 'standard'],
  Beijing: [39.9042, 116.4074, 'MuslimWorldLeague', 'standard'],
};

const coordsOf = (name: string) => ({ lat: CITY_MATRIX[name][0], lng: CITY_MATRIX[name][1] });

describe('automatic method + Asr school by location', () => {
  it.each(Object.entries(CITY_MATRIX))('%s', (_name, [lat, lng, method, asr]) => {
    expect(resolveSettings({ lat, lng })).toEqual({ method, asr });
  });

  it('regionFor exposes the region and agrees with resolveSettings', () => {
    const r = regionFor(coordsOf('Lahore'));
    expect(r).toMatchObject({ name: 'South Asia', method: 'Karachi', asr: 'hanafi' });
    expect(resolveSettings(coordsOf('Lahore'))).toEqual({ method: r.method, asr: r.asr });
  });

  it('falls back to the worldwide default for junk coordinates instead of throwing', () => {
    expect(regionFor({ lat: NaN, lng: 10 })).toMatchObject({ name: 'Worldwide', method: 'MuslimWorldLeague', asr: 'standard' });
    expect(regionFor({ lat: 10, lng: Infinity })).toMatchObject({ name: 'Worldwide' });
  });

  it('the one place the user is almost certainly in — Pakistan — is Karachi + Hanafi everywhere in the country', () => {
    const pakistan = ['Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Quetta', 'Multan', 'Faisalabad', 'Gwadar', 'Gilgit'];
    for (const c of pakistan) expect(resolveSettings(coordsOf(c))).toEqual({ method: 'Karachi', asr: 'hanafi' });
  });
});

describe('every supported method calculates without error', () => {
  const methods = (Object.keys(CalculationMethod) as string[]).filter((m) => m !== 'Other') as MethodKey[];
  const day = new Date(2026, 10, 19);

  it.each(methods)('%s', (method) => {
    for (const c of ['lahore', 'makkah', 'london', 'jakarta']) {
      const city = CITY_MATRIX[c.charAt(0).toUpperCase() + c.slice(1)];
      const t = computeDay({ lat: city[0], lng: city[1] }, day, { method, asr: 'standard' });
      PRAYER_ORDER.forEach((k) => expect(Number.isFinite(t[k].getTime())).toBe(true));
    }
  });
});

describe('computeDay invariants', () => {
  const day = new Date(2026, 10, 19); // 19 Nov 2026 (local)

  it.each(Object.keys(CITY_MATRIX).filter((c) => c !== 'Oslo'))('times are valid and strictly ordered: %s', (name) => {
    const c = coordsOf(name);
    const t = computeDay(c, day, resolveSettings(c));
    const ms = PRAYER_ORDER.map((k) => t[k].getTime());
    ms.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    for (let i = 1; i < ms.length; i++) expect(ms[i]).toBeGreaterThan(ms[i - 1]);
  });

  it('Dhuhr is near local solar noon (Lahore ≈ 07:00 UTC)', () => {
    const c = coordsOf('Lahore');
    const t = computeDay(c, day, resolveSettings(c));
    const h = t.dhuhr.getUTCHours() + t.dhuhr.getUTCMinutes() / 60;
    expect(h).toBeGreaterThan(6.7);
    expect(h).toBeLessThan(7.4);
  });

  it('London Maghrib on 19 Nov is at sunset (~16:10 UTC)', () => {
    const c = coordsOf('London');
    const t = computeDay(c, day, resolveSettings(c));
    const h = t.maghrib.getUTCHours() + t.maghrib.getUTCMinutes() / 60;
    expect(h).toBeGreaterThan(15.95);
    expect(h).toBeLessThan(16.4);
  });

  it('Hanafi Asr is later than standard Asr, and nothing else changes', () => {
    const c = coordsOf('Lahore');
    const std = computeDay(c, day, { method: 'Karachi', asr: 'standard' });
    const han = computeDay(c, day, { method: 'Karachi', asr: 'hanafi' });
    expect(han.asr.getTime()).toBeGreaterThan(std.asr.getTime());
    expect(han.fajr.getTime()).toBe(std.fajr.getTime());
    expect(han.maghrib.getTime()).toBe(std.maghrib.getTime());
  });

  it('Lahore uses the later (Hanafi) Asr automatically — ~35–55 min after standard Asr in November', () => {
    const c = coordsOf('Lahore');
    const auto = computeDay(c, day, resolveSettings(c));
    const std = computeDay(c, day, { method: 'Karachi', asr: 'standard' });
    const gapMin = (auto.asr.getTime() - std.asr.getTime()) / 60_000;
    expect(gapMin).toBeGreaterThan(35);
    expect(gapMin).toBeLessThan(55);
  });

  it('Istanbul uses the single-shadow Asr (Diyanet), not a Hanafi one', () => {
    const c = coordsOf('Istanbul');
    const auto = computeDay(c, day, resolveSettings(c));
    const hanafi = computeDay(c, day, { method: 'Turkey', asr: 'hanafi' });
    expect(hanafi.asr.getTime() - auto.asr.getTime()).toBeGreaterThan(30 * 60_000);
  });

  it('Umm al-Qura Isha is 90 min after Maghrib, 120 in Ramadan', () => {
    const c = coordsOf('Makkah');
    const s = resolveSettings(c);
    const normal = computeDay(c, new Date(2026, 10, 19), s);
    const ramadan = computeDay(c, new Date(2026, 1, 25), s); // Ramadan 1447
    const gap = (t: typeof normal) => (t.isha.getTime() - t.maghrib.getTime()) / 60000;
    expect(Math.abs(gap(normal) - 90)).toBeLessThanOrEqual(1);
    expect(Math.abs(gap(ramadan) - 120)).toBeLessThanOrEqual(1);
  });

  it('high latitude (Oslo, midsummer) still yields finite times', () => {
    const c = coordsOf('Oslo');
    const t = computeDay(c, new Date(2026, 5, 21), resolveSettings(c));
    PRAYER_ORDER.forEach((k) => expect(Number.isFinite(t[k].getTime())).toBe(true));
  });

  it.each([
    ['Tromsø (midnight sun)', { lat: 69.6492, lng: 18.9553 }],
    ['Longyearbyen (polar day/night)', { lat: 78.2232, lng: 15.6267 }],
  ])('polar circle: %s never yields invalid times, in any season', (_name, coords) => {
    const settings = resolveSettings(coords);
    for (const month of [0, 2, 5, 8, 11]) {
      for (const day of [1, 21]) {
        const t = computeDay(coords, new Date(2026, month, day), settings);
        PRAYER_ORDER.forEach((k) => expect(Number.isFinite(t[k].getTime())).toBe(true));
      }
    }
  });
});

describe('computeRange', () => {
  it('returns consecutive local days with unique keys, across a month boundary', () => {
    const c = coordsOf('Lahore');
    const r = computeRange(c, 40, resolveSettings(c), new Date(2026, 10, 19, 15, 30));
    expect(r).toHaveLength(40);
    expect(r[0].dateKey).toBe('2026-11-19');
    expect(r[12].dateKey).toBe('2026-12-01');
    expect(new Set(r.map((d) => d.dateKey)).size).toBe(40);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].times.fajr.getTime()).toBeGreaterThan(r[i - 1].times.isha.getTime());
    }
  });

  it('works for any horizon with no network (weeks ahead)', () => {
    const c = coordsOf('London');
    const r = computeRange(c, 60, resolveSettings(c), new Date(2026, 10, 19));
    expect(r).toHaveLength(60);
    r.forEach((d) => PRAYER_ORDER.forEach((k) => expect(Number.isFinite(d.times[k].getTime())).toBe(true)));
  });
});

describe('nextPrayerAfter', () => {
  const coords = coordsOf('Lahore');
  const s = resolveSettings(coords);

  it('before Fajr → today’s Fajr', () => {
    const today = computeDay(coords, new Date(2026, 10, 19), s);
    const now = new Date(today.fajr.getTime() - 60_000);
    const n = nextPrayerAfter(coords, s, now);
    expect(n.key).toBe('fajr');
    expect(n.isTomorrow).toBe(false);
    expect(n.time.getTime()).toBe(today.fajr.getTime());
  });

  it('between Dhuhr and Asr → Asr', () => {
    const today = computeDay(coords, new Date(2026, 10, 19), s);
    const now = new Date(today.dhuhr.getTime() + 60_000);
    const n = nextPrayerAfter(coords, s, now);
    expect(n.key).toBe('asr');
    expect(n.time.getTime()).toBe(today.asr.getTime());
  });

  it('sunrise is never reported as the next prayer', () => {
    const today = computeDay(coords, new Date(2026, 10, 19), s);
    const now = new Date(today.fajr.getTime() + 60_000); // between fajr and sunrise
    expect(nextPrayerAfter(coords, s, now).key).toBe('dhuhr');
  });

  it('after Isha → tomorrow’s Fajr (a real future instant)', () => {
    const today = computeDay(coords, new Date(2026, 10, 19), s);
    const now = new Date(today.isha.getTime() + 60_000);
    const n = nextPrayerAfter(coords, s, now);
    expect(n.key).toBe('fajr');
    expect(n.isTomorrow).toBe(true);
    expect(n.time.getTime()).toBeGreaterThan(now.getTime());
    // And it really is tomorrow's, not today's past Fajr.
    expect(n.time.getTime()).toBeGreaterThan(today.fajr.getTime() + 20 * 3600_000);
  });
});

describe('helpers', () => {
  it('distanceKm', () => {
    const lahore = coordsOf('Lahore');
    expect(distanceKm(lahore, lahore)).toBeCloseTo(0, 5);
    expect(distanceKm(coordsOf('London'), coordsOf('Paris'))).toBeGreaterThan(330);
    expect(distanceKm(coordsOf('London'), coordsOf('Paris'))).toBeLessThan(360);
  });

  it('isValidCoords rejects junk', () => {
    expect(isValidCoords({ lat: 10, lng: 20 })).toBe(true);
    expect(isValidCoords({ lat: NaN, lng: 20 })).toBe(false);
    expect(isValidCoords({ lat: 91, lng: 20 })).toBe(false);
    expect(isValidCoords(null)).toBe(false);
  });

  it('dateKeyOf pads', () => {
    expect(dateKeyOf(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
