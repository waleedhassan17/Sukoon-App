/**
 * ListenStats — listening-time accounting, streaks and badges.
 *
 * Storage (AsyncStorage, offline-first — same conventions as readingProgress.ts):
 *   sukoon_listen_daily            map dateKey → seconds listened that day
 *   sukoon_listen_stats            aggregate summary (total, completed, badges)
 *
 * Seconds are accumulated in memory by the player (1 tick ≈ 1s of playback)
 * and flushed in batches to avoid AsyncStorage churn.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataSyncService } from '../dataSyncService';
import {
  computeStreak,
  dateKey,
  evaluateBadges,
} from './streaks';
import { BadgeId, ListenStatsSummary } from './types';

const KEYS = {
  DAILY: 'sukoon_listen_daily',
  STATS: 'sukoon_listen_stats',
};

const FLUSH_THRESHOLD_SECONDS = 15;
/** Keep at most ~1 year of daily entries. */
const MAX_DAILY_ENTRIES = 370;

interface StoredStats {
  totalSeconds: number;
  booksCompleted: number;
  completedBookIds: string[];
  badges: BadgeId[];
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

let pendingSeconds = 0;
let flushing = false;

async function readDaily(): Promise<Record<string, number>> {
  return safeParse<Record<string, number>>(await AsyncStorage.getItem(KEYS.DAILY)) ?? {};
}

async function readStats(): Promise<StoredStats> {
  return (
    safeParse<StoredStats>(await AsyncStorage.getItem(KEYS.STATS)) ?? {
      totalSeconds: 0,
      booksCompleted: 0,
      completedBookIds: [],
      badges: [],
    }
  );
}

async function flush(): Promise<void> {
  if (flushing || pendingSeconds <= 0) return;
  flushing = true;
  const toAdd = pendingSeconds;
  pendingSeconds = 0;
  try {
    const today = dateKey(new Date());
    const daily = await readDaily();
    daily[today] = (daily[today] ?? 0) + toAdd;

    // Trim ancient entries so the map stays bounded.
    const keys = Object.keys(daily).sort();
    if (keys.length > MAX_DAILY_ENTRIES) {
      for (const k of keys.slice(0, keys.length - MAX_DAILY_ENTRIES)) delete daily[k];
    }

    const stats = await readStats();
    stats.totalSeconds += toAdd;
    // Badges are sticky — union previously earned with newly evaluated.
    const streak = computeStreak(daily, today);
    const earned = evaluateBadges({
      totalSeconds: stats.totalSeconds,
      booksCompleted: stats.booksCompleted,
      streak,
    });
    stats.badges = [...new Set([...stats.badges, ...earned])];

    await AsyncStorage.setItem(KEYS.DAILY, JSON.stringify(daily));
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(stats));

    // Fire-and-forget cloud backup through the app's sync layer.
    DataSyncService.pushToCloud('audiobooks', 'listenStats', { daily, stats }).catch(() => {});
  } catch {
    // Re-credit on failure so seconds aren't lost.
    pendingSeconds += toAdd;
  } finally {
    flushing = false;
  }
}

export const ListenStats = {
  /** Called by the player roughly once per second of real playback. */
  addListeningSecond(seconds = 1): void {
    pendingSeconds += seconds;
    if (pendingSeconds >= FLUSH_THRESHOLD_SECONDS) flush().catch(() => {});
  },

  /** Flush pending seconds immediately (on pause/stop/background). */
  async flushNow(): Promise<void> {
    await flush();
  },

  /** Record a finished book exactly once. */
  async markBookCompleted(bookId: string): Promise<void> {
    const stats = await readStats();
    if (stats.completedBookIds.includes(bookId)) return;
    stats.completedBookIds.push(bookId);
    stats.booksCompleted = stats.completedBookIds.length;
    const daily = await readDaily();
    const streak = computeStreak(daily, dateKey(new Date()));
    const earned = evaluateBadges({
      totalSeconds: stats.totalSeconds,
      booksCompleted: stats.booksCompleted,
      streak,
    });
    stats.badges = [...new Set([...stats.badges, ...earned])];
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(stats));
  },

  async getSummary(): Promise<ListenStatsSummary> {
    const [daily, stats] = await Promise.all([readDaily(), readStats()]);
    const streak = computeStreak(daily, dateKey(new Date()));
    return {
      totalSeconds: stats.totalSeconds + pendingSeconds,
      booksCompleted: stats.booksCompleted,
      streak,
      badges: stats.badges,
    };
  },
};
