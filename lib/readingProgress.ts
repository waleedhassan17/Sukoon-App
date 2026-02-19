import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SEEN_KEY = '@sukoon_last_seen';
const STREAK_KEY = '@sukoon_reading_streak';
const HISTORY_KEY = '@sukoon_reading_history';

interface LastSeen {
  surah: number;
  ayah: number;
  timestamp: string;
}

interface ReadingDay {
  date: string;
  ayahsRead: number;
  minutesRead: number;
}

export const ReadingProgress = {
  async getLastSeen(): Promise<LastSeen | null> {
    try {
      const data = await AsyncStorage.getItem(LAST_SEEN_KEY);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },

  async setLastSeen(surah: number, ayah: number): Promise<void> {
    const entry: LastSeen = { surah, ayah, timestamp: new Date().toISOString() };
    await AsyncStorage.setItem(LAST_SEEN_KEY, JSON.stringify(entry));
  },

  async getStreak(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STREAK_KEY);
      if (!data) return 0;
      const { streak, lastDate } = JSON.parse(data);
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastDate === today || lastDate === yesterday) return streak;
      return 0;
    } catch { return 0; }
  },

  async incrementStreak(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await AsyncStorage.getItem(STREAK_KEY);
      let streak = 1;
      if (data) {
        const prev = JSON.parse(data);
        if (prev.lastDate === today) return prev.streak;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (prev.lastDate === yesterday) streak = prev.streak + 1;
      }
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ streak, lastDate: today }));
      return streak;
    } catch { return 1; }
  },

  async addReadingHistory(ayahsRead: number, minutesRead: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      const history: ReadingDay[] = data ? JSON.parse(data) : [];
      const existing = history.find(h => h.date === today);
      if (existing) {
        existing.ayahsRead += ayahsRead;
        existing.minutesRead += minutesRead;
      } else {
        history.push({ date: today, ayahsRead, minutesRead });
      }
      // Keep last 30 days
      const trimmed = history.slice(-30);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {}
  },

  async getReadingHistory(): Promise<ReadingDay[]> {
    try {
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },
};
