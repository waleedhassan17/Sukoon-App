/**
 * PrayerTimesService - Using Aladhan API (free, open source)
 * https://aladhan.com/prayer-times-api
 *
 * Features:
 * - Daily cache: prayer times fetched once per day, stored in AsyncStorage
 * - Location cache: GPS coords + city name cached for 30 minutes
 * - Cache-first: getByCoordinates returns cached data instantly if valid
 * - All consumers (prayer.tsx, index.tsx) share the same cache
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ALADHAN_BASE = 'https://api.aladhan.com/v1';

// ── Cache Keys ──
const CACHE_KEYS = {
  PRAYER_TIMES: 'sukoon_prayer_cache',       // { date, data, coords, locationName }
  LOCATION:     'sukoon_location_cache',      // { lat, lng, name, timestamp }
};

// ── Cache TTL ──
const LOCATION_TTL_MS = 30 * 60 * 1000; // 30 minutes — GPS doesn't change often

export interface PrayerTimesData {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  date: string;
  // Islamic calendar data
  hijriDate?: HijriDate;
}

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

export const PrayerTimesService = {

  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  /** Today as DD-MM-YYYY (Aladhan format) */
  _todayDDMMYYYY(): string {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  },

  /** Today as YYYY-MM-DD (cache key) */
  _todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** Safe JSON parse */
  _safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },

  /** Strip timezone suffix from time string "05:23 (PKT)" → "05:23" */
  _cleanTime(t: string | undefined): string {
    return t?.split(' ')[0] || t || '00:00';
  },

  /**
   * Parse Hijri date from API response
   */
  parseHijriDate(hijriData: any): HijriDate {
    return {
      day: hijriData.day,
      month: hijriData.month.en,
      monthArabic: hijriData.month.ar,
      monthNumber: hijriData.month.number,
      year: hijriData.year,
      weekday: hijriData.weekday.en,
      weekdayArabic: hijriData.weekday.ar,
      fullDate: `${hijriData.day} ${hijriData.month.en} ${hijriData.year} AH`,
      holidays: hijriData.holidays || [],
    };
  },

  // ════════════════════════════════════════
  // LOCATION CACHE
  // ════════════════════════════════════════

  /** Get cached location if still fresh (within TTL) */
  async getCachedLocation(): Promise<{ lat: number; lng: number; name: string } | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.LOCATION);
      const cached = this._safeParse<{ lat: number; lng: number; name: string; timestamp: number }>(raw);
      if (!cached) return null;
      if (Date.now() - cached.timestamp > LOCATION_TTL_MS) return null; // expired
      return { lat: cached.lat, lng: cached.lng, name: cached.name };
    } catch { return null; }
  },

  /** Save location to cache */
  async cacheLocation(lat: number, lng: number, name: string): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.LOCATION, JSON.stringify({ lat, lng, name, timestamp: Date.now() }));
    } catch {}
  },

  // ════════════════════════════════════════
  // PRAYER TIMES CACHE
  // ════════════════════════════════════════

  /** Get today's cached prayer times (instant, no network) */
  async getCachedPrayerTimes(): Promise<{ data: PrayerTimesData; locationName: string } | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.PRAYER_TIMES);
      const cached = this._safeParse<{ date: string; data: PrayerTimesData; locationName: string }>(raw);
      if (!cached) return null;
      if (cached.date !== this._todayKey()) return null; // stale — different day
      return { data: cached.data, locationName: cached.locationName };
    } catch { return null; }
  },

  /** Save prayer times to cache with today's date stamp */
  async cachePrayerTimes(data: PrayerTimesData, locationName: string): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PRAYER_TIMES, JSON.stringify({
        date: this._todayKey(),
        data,
        locationName,
      }));
    } catch {}
  },

  // ════════════════════════════════════════
  // API CALLS (network)
  // ════════════════════════════════════════

  /**
   * Fetch prayer times from Aladhan API by GPS coordinates.
   * Does NOT touch cache — caller decides caching.
   */
  async getByCoordinates(lat: number, lng: number, method: number = 2): Promise<PrayerTimesData | null> {
    try {
      const dateStr = this._todayDDMMYYYY();
      const res = await fetch(
        `${ALADHAN_BASE}/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${method}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const json = await res.json();

      if (json.code === 200) {
        const t = json.data.timings;
        const hijriDate = json.data.date.hijri ? this.parseHijriDate(json.data.date.hijri) : undefined;

        return {
          Fajr: this._cleanTime(t.Fajr),
          Sunrise: this._cleanTime(t.Sunrise),
          Dhuhr: this._cleanTime(t.Dhuhr),
          Asr: this._cleanTime(t.Asr),
          Maghrib: this._cleanTime(t.Maghrib),
          Isha: this._cleanTime(t.Isha),
          date: json.data.date.readable,
          hijriDate,
        };
      }
      return null;
    } catch (e) {
      if (__DEV__) console.error('Prayer times API error:', e);
      return null;
    }
  },

  /**
   * Fetch prayer times by city name (fallback when no GPS).
   */
  async getByCity(city: string, country: string, method: number = 2): Promise<PrayerTimesData | null> {
    try {
      const dateStr = this._todayDDMMYYYY();
      const res = await fetch(
        `${ALADHAN_BASE}/timingsByCity/${dateStr}?city=${city}&country=${country}&method=${method}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const json = await res.json();

      if (json.code === 200) {
        const t = json.data.timings;
        const hijriDate = json.data.date.hijri ? this.parseHijriDate(json.data.date.hijri) : undefined;

        return {
          Fajr: this._cleanTime(t.Fajr),
          Sunrise: this._cleanTime(t.Sunrise),
          Dhuhr: this._cleanTime(t.Dhuhr),
          Asr: this._cleanTime(t.Asr),
          Maghrib: this._cleanTime(t.Maghrib),
          Isha: this._cleanTime(t.Isha),
          date: json.data.date.readable,
          hijriDate,
        };
      }
      return null;
    } catch (e) {
      if (__DEV__) console.error('Prayer times API error:', e);
      return null;
    }
  },

  /**
   * Get Islamic/Hijri calendar date for today
   */
  async getIslamicDate(): Promise<IslamicCalendarData | null> {
    try {
      const dateStr = this._todayDDMMYYYY();
      const res = await fetch(
        `${ALADHAN_BASE}/gToH/${dateStr}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const json = await res.json();

      if (json.code === 200) {
        const hijri = json.data.hijri;
        const gregorian = json.data.gregorian;

        return {
          hijri: this.parseHijriDate(hijri),
          gregorian: {
            day: gregorian.day,
            month: gregorian.month.en,
            year: gregorian.year,
            weekday: gregorian.weekday.en,
            date: gregorian.date,
          },
        };
      }
      return null;
    } catch (e) {
      if (__DEV__) console.error('Islamic calendar error:', e);
      return null;
    }
  },

  // ════════════════════════════════════════
  // UTILITIES
  // ════════════════════════════════════════

  /**
   * Get next prayer based on current time
   */
  getNextPrayer(times: PrayerTimesData): { name: string; time: string; isActive: boolean } | null {
    if (!times) return null;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const prayers = [
      { name: 'Fajr', time: times.Fajr },
      { name: 'Dhuhr', time: times.Dhuhr },
      { name: 'Asr', time: times.Asr },
      { name: 'Maghrib', time: times.Maghrib },
      { name: 'Isha', time: times.Isha },
    ];

    for (const prayer of prayers) {
      const [h, m] = prayer.time.split(':').map(Number);
      const prayerMinutes = h * 60 + m;
      if (prayerMinutes > currentMinutes) {
        return { ...prayer, isActive: true };
      }
    }

    // If all prayers passed, next is Fajr (tomorrow)
    return { name: 'Fajr', time: times.Fajr, isActive: false };
  },

  formatTime(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  },
};
