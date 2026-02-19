/**
 * PrayerTimesService - Using Aladhan API (free, open source)
 * https://aladhan.com/prayer-times-api
 * 
 * Endpoints used:
 * - Prayer Times: /timings/{date}
 * - Prayer Times by City: /timingsByCity/{date}
 * - Gregorian to Hijri: /gToH/{date}
 * - Hijri Calendar: /hToG/{date}
 */

const ALADHAN_BASE = 'https://api.aladhan.com/v1';

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

  /**
   * Get prayer times by GPS coordinates
   * Also returns Islamic/Hijri date
   */
  async getByCoordinates(lat: number, lng: number, method: number = 2): Promise<PrayerTimesData | null> {
    try {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      
      const res = await fetch(
        `${ALADHAN_BASE}/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=${method}`,
        {
          headers: { 'Accept': 'application/json' }
        }
      );
      const json = await res.json();
      
      if (json.code === 200) {
        const t = json.data.timings;
        const hijriDate = json.data.date.hijri ? this.parseHijriDate(json.data.date.hijri) : undefined;
        
        return {
          Fajr: t.Fajr?.split(' ')[0] || t.Fajr,  // Remove timezone suffix if present
          Sunrise: t.Sunrise?.split(' ')[0] || t.Sunrise,
          Dhuhr: t.Dhuhr?.split(' ')[0] || t.Dhuhr,
          Asr: t.Asr?.split(' ')[0] || t.Asr,
          Maghrib: t.Maghrib?.split(' ')[0] || t.Maghrib,
          Isha: t.Isha?.split(' ')[0] || t.Isha,
          date: json.data.date.readable,
          hijriDate,
        };
      }
      return null;
    } catch (e) {
      console.error('Prayer times error:', e);
      return null;
    }
  },

  /**
   * Get prayer times by city name
   * Also returns Islamic/Hijri date
   */
  async getByCity(city: string, country: string, method: number = 2): Promise<PrayerTimesData | null> {
    try {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      
      const res = await fetch(
        `${ALADHAN_BASE}/timingsByCity/${dd}-${mm}-${yyyy}?city=${city}&country=${country}&method=${method}`,
        {
          headers: { 'Accept': 'application/json' }
        }
      );
      const json = await res.json();
      
      if (json.code === 200) {
        const t = json.data.timings;
        const hijriDate = json.data.date.hijri ? this.parseHijriDate(json.data.date.hijri) : undefined;
        
        return {
          Fajr: t.Fajr?.split(' ')[0] || t.Fajr,
          Sunrise: t.Sunrise?.split(' ')[0] || t.Sunrise,
          Dhuhr: t.Dhuhr?.split(' ')[0] || t.Dhuhr,
          Asr: t.Asr?.split(' ')[0] || t.Asr,
          Maghrib: t.Maghrib?.split(' ')[0] || t.Maghrib,
          Isha: t.Isha?.split(' ')[0] || t.Isha,
          date: json.data.date.readable,
          hijriDate,
        };
      }
      return null;
    } catch (e) {
      console.error('Prayer times error:', e);
      return null;
    }
  },

  /**
   * Get Islamic/Hijri calendar date for today
   * Uses Gregorian to Hijri conversion endpoint
   */
  async getIslamicDate(): Promise<IslamicCalendarData | null> {
    try {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      
      const res = await fetch(
        `${ALADHAN_BASE}/gToH/${dd}-${mm}-${yyyy}`,
        {
          headers: { 'Accept': 'application/json' }
        }
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
      console.error('Islamic calendar error:', e);
      return null;
    }
  },

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
