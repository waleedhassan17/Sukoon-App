import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage Keys ──
const KEYS = {
  LAST_SEEN:    'sukoon_last_seen',
  LAST_AUDIO:   'sukoon_last_audio',
  STREAK:       'sukoon_streak',
  DAILY_PREFIX: 'sukoon_daily_read_',   // + "YYYY-MM-DD"
  TOTAL_READ:   'sukoon_total_ayahs_read',
  DAYS_ACTIVE:  'sukoon_days_active',
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface LastPosition {
  surah: number;
  surahName: string;
  ayah: number;
  timestamp: number;
}

export const ReadingProgress = {

  // ════════════════════════════════════════
  // LAST SEEN — user's reading position
  // ════════════════════════════════════════
  async setLastSeen(surah: number, surahName: string, ayah: number): Promise<void> {
    try {
      const data: LastPosition = { surah, surahName, ayah, timestamp: Date.now() };
      await AsyncStorage.setItem(KEYS.LAST_SEEN, JSON.stringify(data));
    } catch {}
  },

  async getLastSeen(): Promise<LastPosition | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LAST_SEEN);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // ════════════════════════════════════════
  // LAST AUDIO — user's playback position
  // ════════════════════════════════════════
  async setLastAudio(surah: number, surahName: string, ayah: number): Promise<void> {
    try {
      const data: LastPosition = { surah, surahName, ayah, timestamp: Date.now() };
      await AsyncStorage.setItem(KEYS.LAST_AUDIO, JSON.stringify(data));
    } catch {}
  },

  async getLastAudio(): Promise<LastPosition | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LAST_AUDIO);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // ════════════════════════════════════════
  // MARK AYAH AS READ — call when ayah scrolls into view
  // Deduplicates: same ayah read twice today = counted once
  // ════════════════════════════════════════
  async markAyahRead(surah: number, ayah: number): Promise<void> {
    try {
      const today = todayStr();
      const dayKey = KEYS.DAILY_PREFIX + today;
      const tag = `${surah}:${ayah}`;

      // 1. Load today's read set
      const raw = await AsyncStorage.getItem(dayKey);
      const readSet: string[] = raw ? JSON.parse(raw) : [];

      // 2. Deduplicate
      if (readSet.includes(tag)) return; // already counted today

      // 3. Add to today's set
      readSet.push(tag);
      await AsyncStorage.setItem(dayKey, JSON.stringify(readSet));

      // 4. Increment lifetime total
      const totalRaw = await AsyncStorage.getItem(KEYS.TOTAL_READ);
      const total = totalRaw ? parseInt(totalRaw, 10) : 0;
      await AsyncStorage.setItem(KEYS.TOTAL_READ, String(total + 1));

      // 5. Add today to days-active set
      const daysRaw = await AsyncStorage.getItem(KEYS.DAYS_ACTIVE);
      const daysSet: string[] = daysRaw ? JSON.parse(daysRaw) : [];
      if (!daysSet.includes(today)) {
        daysSet.push(today);
        await AsyncStorage.setItem(KEYS.DAYS_ACTIVE, JSON.stringify(daysSet));
      }

      // 6. Update streak
      await this.incrementStreak();
    } catch {}
  },

  // ════════════════════════════════════════
  // COUNTS
  // ════════════════════════════════════════
  async getTodayReadCount(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.DAILY_PREFIX + todayStr());
      return raw ? JSON.parse(raw).length : 0;
    } catch { return 0; }
  },

  async getTotalReadCount(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.TOTAL_READ);
      return raw ? parseInt(raw, 10) : 0;
    } catch { return 0; }
  },

  async getDaysActive(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.DAYS_ACTIVE);
      return raw ? JSON.parse(raw).length : 0;
    } catch { return 0; }
  },

  // ════════════════════════════════════════
  // STREAK — consecutive days with at least 1 ayah read
  // ════════════════════════════════════════
  async incrementStreak(): Promise<void> {
    try {
      const today = todayStr();
      const raw = await AsyncStorage.getItem(KEYS.STREAK);
      const streak = raw ? JSON.parse(raw) : { count: 0, lastDate: '' };

      if (streak.lastDate === today) return; // already counted today

      if (streak.lastDate === yesterdayStr()) {
        // Consecutive day — increment
        streak.count += 1;
        streak.lastDate = today;
      } else {
        // Streak broken or first time — start fresh
        streak.count = 1;
        streak.lastDate = today;
      }

      await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(streak));
    } catch {}
  },

  async getStreak(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.STREAK);
      if (!raw) return 0;
      const streak = JSON.parse(raw);
      const today = todayStr();
      const yesterday = yesterdayStr();
      // Streak is only valid if last activity was today or yesterday
      if (streak.lastDate === today || streak.lastDate === yesterday) {
        return streak.count;
      }
      return 0; // streak broken
    } catch { return 0; }
  },

  // ════════════════════════════════════════
  // DAILY BREAKDOWN — for charts/history
  // ════════════════════════════════════════
  async getDailyReadCounts(numDays: number = 7): Promise<{ date: string; count: number }[]> {
    try {
      const results: { date: string; count: number }[] = [];
      const d = new Date();
      for (let i = 0; i < numDays; i++) {
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const raw = await AsyncStorage.getItem(KEYS.DAILY_PREFIX + ds);
        results.unshift({ date: ds, count: raw ? JSON.parse(raw).length : 0 });
        d.setDate(d.getDate() - 1);
      }
      return results;
    } catch { return []; }
  },

  // ════════════════════════════════════════
  // RESET — clear all tracking data
  // ════════════════════════════════════════
  async resetAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const sukoonKeys = allKeys.filter((k) => k.startsWith('sukoon_'));
      if (sukoonKeys.length > 0) await AsyncStorage.multiRemove(sukoonKeys);
    } catch {}
  },
};
