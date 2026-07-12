/**
 * Pure streak & badge math for listening stats.
 * Mirrors the Salah-streak conventions in readingProgress.ts:
 *  - a day counts when it has any listening activity (>= MIN_DAY_SECONDS)
 *  - the streak survives if the last active day is today or yesterday
 * No React/RN imports — unit-testable in plain Node.
 */

import { BadgeId, ListenStreak } from './types';

/** Minimum listening on a day for it to count toward the streak. */
export const MIN_DAY_SECONDS = 60;

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return dateKey(date);
}

/**
 * Compute the current/longest streak from a map of dateKey → secondsListened.
 * `today` is injected for testability.
 */
export function computeStreak(
  dailySeconds: Record<string, number>,
  today: string
): ListenStreak {
  const activeDays = Object.keys(dailySeconds)
    .filter((k) => (dailySeconds[k] ?? 0) >= MIN_DAY_SECONDS)
    .sort();

  if (activeDays.length === 0) {
    return { current: 0, longest: 0, lastActiveDate: null };
  }

  // Longest run of consecutive days anywhere in history.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < activeDays.length; i++) {
    run = activeDays[i] === addDays(activeDays[i - 1], 1) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current streak: walk backwards from the last active day, but only if that
  // day is today or yesterday — otherwise the streak is broken.
  const lastActive = activeDays[activeDays.length - 1];
  const yesterday = addDays(today, -1);
  let current = 0;
  if (lastActive === today || lastActive === yesterday) {
    current = 1;
    const set = new Set(activeDays);
    let cursor = lastActive;
    while (set.has(addDays(cursor, -1))) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest: Math.max(longest, current), lastActiveDate: lastActive };
}

/** Badge thresholds. */
export const TEN_HOURS_SECONDS = 10 * 3600;

/**
 * Evaluate earned badges from aggregates. Pure — returns the full earned set;
 * callers keep previously-earned badges sticky by unioning with stored ones.
 */
export function evaluateBadges(params: {
  totalSeconds: number;
  booksCompleted: number;
  streak: ListenStreak;
}): BadgeId[] {
  const earned: BadgeId[] = [];
  if (params.booksCompleted >= 1) earned.push('first_book_finished');
  if (params.totalSeconds >= TEN_HOURS_SECONDS) earned.push('ten_hours');
  if (params.streak.current >= 7 || params.streak.longest >= 7) earned.push('streak_7');
  if (params.streak.current >= 30 || params.streak.longest >= 30) earned.push('streak_30');
  return earned;
}

/** Human label for remaining time on "Jump back in" cards, e.g. "2h 15m left". */
export function formatRemaining(totalDurationSec: number, listenedSec: number): string {
  const remaining = Math.max(0, totalDurationSec - listenedSec);
  if (remaining === 0 || totalDurationSec === 0) return '';
  const h = Math.floor(remaining / 3600);
  const m = Math.round((remaining % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}
