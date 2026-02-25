import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataSyncService } from './dataSyncService';

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
  /** Audio playback position in milliseconds (only for lastAudio) */
  positionMs?: number;
}

// ── Write-coalescing for setLastSeen ──
// If the caller fires rapidly (e.g. scroll handler), we coalesce into one write.
let _lastSeenPending: LastPosition | null = null;
let _lastSeenTimer: ReturnType<typeof setTimeout> | null = null;
const LAST_SEEN_DEBOUNCE_MS = 2000;

// ── Write-coalescing for setLastAudio ──
let _lastAudioPending: LastPosition | null = null;
let _lastAudioTimer: ReturnType<typeof setTimeout> | null = null;
const LAST_AUDIO_DEBOUNCE_MS = 3000;

/**
 * Safe JSON parse — returns null on any error instead of crashing.
 */
function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const ReadingProgress = {

  // ════════════════════════════════════════
  // LAST SEEN — user's reading position
  // Debounced: rapid calls are coalesced into one AsyncStorage write.
  // ════════════════════════════════════════
  async setLastSeen(surah: number, surahName: string, ayah: number): Promise<void> {
    const data: LastPosition = { surah, surahName, ayah, timestamp: Date.now() };
    _lastSeenPending = data;

    // Clear previous timer — only the latest call wins
    if (_lastSeenTimer) clearTimeout(_lastSeenTimer);

    _lastSeenTimer = setTimeout(async () => {
      const toWrite = _lastSeenPending;
      _lastSeenPending = null;
      _lastSeenTimer = null;
      if (!toWrite) return;
      try {
        await AsyncStorage.setItem(KEYS.LAST_SEEN, JSON.stringify(toWrite));
        // Background cloud sync (fire-and-forget)
        DataSyncService.saveReadingProgress({ lastSeen: toWrite }).catch(() => {});
      } catch (e) {
        if (__DEV__) console.warn('[ReadingProgress] setLastSeen write error:', e);
      }
    }, LAST_SEEN_DEBOUNCE_MS);
  },

  /**
   * Force-flush any pending debounced lastSeen write.
   * Call this on screen unmount to ensure data is not lost.
   */
  async flushLastSeen(): Promise<void> {
    if (_lastSeenTimer) {
      clearTimeout(_lastSeenTimer);
      _lastSeenTimer = null;
    }
    const toWrite = _lastSeenPending;
    _lastSeenPending = null;
    if (!toWrite) return;
    try {
      await AsyncStorage.setItem(KEYS.LAST_SEEN, JSON.stringify(toWrite));
      DataSyncService.saveReadingProgress({ lastSeen: toWrite }).catch(() => {});
    } catch (e) {
      if (__DEV__) console.warn('[ReadingProgress] flushLastSeen error:', e);
    }
  },

  async getLastSeen(): Promise<LastPosition | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LAST_SEEN);
      return safeJsonParse<LastPosition>(raw);
    } catch (e) {
      if (__DEV__) console.warn('[ReadingProgress] getLastSeen error:', e);
      return null;
    }
  },

  // ════════════════════════════════════════
  // LAST AUDIO — user's playback position
  // Debounced: status callbacks fire every 250ms — we coalesce writes.
  // Now includes playback positionMs for accurate resume.
  // ════════════════════════════════════════
  async setLastAudio(surah: number, surahName: string, ayah: number, positionMs?: number): Promise<void> {
    const data: LastPosition = { surah, surahName, ayah, timestamp: Date.now(), positionMs };
    _lastAudioPending = data;

    if (_lastAudioTimer) clearTimeout(_lastAudioTimer);

    _lastAudioTimer = setTimeout(async () => {
      const toWrite = _lastAudioPending;
      _lastAudioPending = null;
      _lastAudioTimer = null;
      if (!toWrite) return;
      try {
        await AsyncStorage.setItem(KEYS.LAST_AUDIO, JSON.stringify(toWrite));
        DataSyncService.saveReadingProgress({ lastAudio: toWrite }).catch(() => {});
      } catch (e) {
        if (__DEV__) console.warn('[ReadingProgress] setLastAudio write error:', e);
      }
    }, LAST_AUDIO_DEBOUNCE_MS);
  },

  /**
   * Force-flush any pending debounced lastAudio write.
   * Call on screen unmount / audio stop.
   */
  async flushLastAudio(): Promise<void> {
    if (_lastAudioTimer) {
      clearTimeout(_lastAudioTimer);
      _lastAudioTimer = null;
    }
    const toWrite = _lastAudioPending;
    _lastAudioPending = null;
    if (!toWrite) return;
    try {
      await AsyncStorage.setItem(KEYS.LAST_AUDIO, JSON.stringify(toWrite));
      DataSyncService.saveReadingProgress({ lastAudio: toWrite }).catch(() => {});
    } catch (e) {
      if (__DEV__) console.warn('[ReadingProgress] flushLastAudio error:', e);
    }
  },

  async getLastAudio(): Promise<LastPosition | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LAST_AUDIO);
      return safeJsonParse<LastPosition>(raw);
    } catch (e) {
      if (__DEV__) console.warn('[ReadingProgress] getLastAudio error:', e);
      return null;
    }
  },

  // ════════════════════════════════════════
  // MARK AYAH AS READ — call when ayah scrolls into view
  // Deduplicates: same ayah read twice today = counted once
  // Uses multiSet to batch 4 writes into 1 transaction.
  // ════════════════════════════════════════
  async markAyahRead(surah: number, ayah: number): Promise<void> {
    try {
      const today = todayStr();
      const dayKey = KEYS.DAILY_PREFIX + today;
      const tag = `${surah}:${ayah}`;

      // 1. Load today's read set
      const raw = await AsyncStorage.getItem(dayKey);
      const readSet: string[] = safeJsonParse<string[]>(raw) || [];

      // 2. Deduplicate
      if (readSet.includes(tag)) return; // already counted today

      // 3. Add to today's set
      readSet.push(tag);

      // 4. Increment lifetime total
      const totalRaw = await AsyncStorage.getItem(KEYS.TOTAL_READ);
      const total = totalRaw ? parseInt(totalRaw, 10) : 0;

      // 5. Add today to days-active set
      const daysRaw = await AsyncStorage.getItem(KEYS.DAYS_ACTIVE);
      const daysSet: string[] = safeJsonParse<string[]>(daysRaw) || [];
      const dayIsNew = !daysSet.includes(today);
      if (dayIsNew) daysSet.push(today);

      // 6. Batch all writes into one multiSet call (atomic, fewer I/O ops)
      const pairs: [string, string][] = [
        [dayKey, JSON.stringify(readSet)],
        [KEYS.TOTAL_READ, String(total + 1)],
      ];
      if (dayIsNew) {
        pairs.push([KEYS.DAYS_ACTIVE, JSON.stringify(daysSet)]);
      }
      await AsyncStorage.multiSet(pairs);

      // 7. Update streak (inlined to avoid extra reads)
      await this._updateStreak(today);
    } catch (e) {
      if (__DEV__) console.warn('[ReadingProgress] markAyahRead error:', e);
    }
  },

  // ════════════════════════════════════════
  // COUNTS
  // ════════════════════════════════════════
  async getTodayReadCount(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.DAILY_PREFIX + todayStr());
      const arr = safeJsonParse<string[]>(raw);
      return arr ? arr.length : 0;
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
      const arr = safeJsonParse<string[]>(raw);
      return arr ? arr.length : 0;
    } catch { return 0; }
  },

  // ════════════════════════════════════════
  // STREAK — consecutive days with at least 1 ayah read
  // Private helper — called by markAyahRead after batch write.
  // ════════════════════════════════════════
  async _updateStreak(today: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.STREAK);
      const streak = safeJsonParse<{ count: number; lastDate: string }>(raw) || { count: 0, lastDate: '' };

      if (streak.lastDate === today) return; // already counted today

      if (streak.lastDate === yesterdayStr()) {
        streak.count += 1;
        streak.lastDate = today;
      } else {
        streak.count = 1;
        streak.lastDate = today;
      }

      await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(streak));
    } catch (e) {
      if (__DEV__) console.warn('[ReadingProgress] _updateStreak error:', e);
    }
  },

  async getStreak(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.STREAK);
      if (!raw) return 0;
      const streak = safeJsonParse<{ count: number; lastDate: string }>(raw);
      if (!streak) return 0;
      const today = todayStr();
      const yesterday = yesterdayStr();
      if (streak.lastDate === today || streak.lastDate === yesterday) {
        return streak.count;
      }
      return 0;
    } catch { return 0; }
  },

  // ════════════════════════════════════════
  // DAILY BREAKDOWN — for charts/history
  // ════════════════════════════════════════
  async getDailyReadCounts(numDays: number = 7): Promise<{ date: string; count: number }[]> {
    try {
      const results: { date: string; count: number }[] = [];
      const keys: string[] = [];
      const dates: string[] = [];
      const d = new Date();

      // Build all keys first, then fetch in one multiGet
      for (let i = 0; i < numDays; i++) {
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.unshift(ds);
        keys.unshift(KEYS.DAILY_PREFIX + ds);
        d.setDate(d.getDate() - 1);
      }

      const pairs = await AsyncStorage.multiGet(keys);
      for (let i = 0; i < pairs.length; i++) {
        const arr = safeJsonParse<string[]>(pairs[i][1]);
        results.push({ date: dates[i], count: arr ? arr.length : 0 });
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
    } catch (e) {
      if (__DEV__) console.warn('[ReadingProgress] resetAll error:', e);
    }
  },
};
