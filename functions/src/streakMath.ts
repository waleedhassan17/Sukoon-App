/**
 * Pure streak math — no Firestore, no I/O. Lives here so the unit tests in
 * test/streak.test.ts can hammer it with timezone, missed-day, DST and
 * milestone scenarios without booting the admin SDK.
 *
 * Why: clock-tampering and concurrency safety demand the streak result be
 * derived from explicit inputs — not from "now()". Callers (the Firestore
 * trigger, the scheduled sweep) shape inputs from authoritative day docs and
 * pass them in; this module never reads the wall clock.
 */

import { dayDiff, previousDateKey } from './dates';
import { STREAK_MILESTONES } from './types';

export interface StreakInputs {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  milestonesAchieved: number[];
  /** The date for which BOTH friends have just been confirmed Salah-Day-Complete. */
  candidateDate: string;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string;
  milestonesAchieved: number[];
  /** Newly unlocked milestones (subset of STREAK_MILESTONES). Used to fan out push notifications. */
  newMilestones: number[];
  /** True iff this call advanced (or initialised) the streak; false iff it was a no-op (already counted). */
  advanced: boolean;
}

/**
 * Apply a successful shared-SDC for `candidateDate`.
 *
 * Rules (spec):
 *   - if lastStreakDate == candidateDate → no-op (already counted; protects against double-fire).
 *   - if lastStreakDate == candidateDate - 1 day → currentStreak += 1.
 *   - else → currentStreak = 1 (gap implied; previous streak already broken by sweep).
 *   - longestStreak = max(longestStreak, currentStreak).
 *   - milestone fires the FIRST time currentStreak hits a milestone value.
 */
export function applySharedDayComplete(input: StreakInputs): StreakResult {
  const { lastStreakDate, candidateDate } = input;

  if (lastStreakDate === candidateDate) {
    return {
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
      lastStreakDate: candidateDate,
      milestonesAchieved: input.milestonesAchieved.slice(),
      newMilestones: [],
      advanced: false,
    };
  }

  const isContinuation =
    lastStreakDate !== null && previousDateKey(candidateDate) === lastStreakDate;
  const nextStreak = isContinuation ? input.currentStreak + 1 : 1;
  const nextLongest = Math.max(input.longestStreak, nextStreak);

  const achieved = new Set(input.milestonesAchieved);
  const newMilestones: number[] = [];
  for (const m of STREAK_MILESTONES) {
    if (nextStreak === m && !achieved.has(m)) {
      achieved.add(m);
      newMilestones.push(m);
    }
  }

  return {
    currentStreak: nextStreak,
    longestStreak: nextLongest,
    lastStreakDate: candidateDate,
    milestonesAchieved: Array.from(achieved).sort((a, b) => a - b),
    newMilestones,
    advanced: true,
  };
}

/**
 * Decide whether a streak should be considered broken given the latest known
 * shared-SDC date and the current "today" of the slower-timezone user.
 *
 * Used by the scheduled hourly sweep:
 *   - If lastStreakDate is null, nothing to break.
 *   - If today's date == lastStreakDate, fine.
 *   - If today's date == lastStreakDate + 1, fine — partner may still complete today.
 *   - Else the gap is ≥ 2 calendar days → at least one whole day was missed → break.
 */
export function shouldBreakStreak(
  lastStreakDate: string | null,
  slowerTodayDate: string,
): boolean {
  if (lastStreakDate === null) return false;
  return dayDiff(lastStreakDate, slowerTodayDate) >= 2;
}

/**
 * Recompute prayerCount from the boolean `logged` flags on a day document.
 * Tolerant of partial / missing fields — anything not explicitly logged=true
 * counts as 0. Server overwrites whatever the client wrote.
 */
export function computePrayerCount(day: {
  fajr?: { logged?: boolean };
  dhuhr?: { logged?: boolean };
  asr?: { logged?: boolean };
  maghrib?: { logged?: boolean };
  isha?: { logged?: boolean };
}): number {
  let n = 0;
  if (day.fajr?.logged === true) n++;
  if (day.dhuhr?.logged === true) n++;
  if (day.asr?.logged === true) n++;
  if (day.maghrib?.logged === true) n++;
  if (day.isha?.logged === true) n++;
  return n;
}

/** Build the canonical pair id from two uids. Sorted lexicographically + joined with `_`. */
export function pairIdOf(uidA: string, uidB: string): string {
  if (uidA === uidB) throw new Error('pairIdOf: cannot pair a user with themselves');
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}
