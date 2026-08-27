/**
 * Pure streak math — no Firestore, no I/O, no wall clock.
 *
 * ⚠ MIRROR of functions/src/streakMath.ts. The function bodies must stay identical;
 * `__tests__/salahStreak.test.ts` compares them and fails the build on drift. See
 * the note in ./dates.ts for why the duplication exists.
 *
 * Why the wall clock is excluded: the streak result must be derived from explicit
 * inputs so that two devices — and, under a future Blaze cutover, the server —
 * always reach the same answer for the same facts. Callers shape those inputs from
 * authoritative day documents and pass them in.
 *
 * On the Spark plan this module runs on the client, and firestore.rules re-derives
 * the same transition independently before accepting the write. A client that
 * computes a different answer than the rules simply gets denied.
 */

import { dayDiff, previousDateKey } from './dates';

/**
 * Shared-streak milestones. MIRRORED in functions/src/types.ts (STREAK_MILESTONES)
 * and inlined in firestore.rules (`milestones()`). Change all three together — the
 * rules reject any milestone value outside this set, so adding one here alone would
 * make every award past that threshold fail to write.
 */
export const STREAK_MILESTONES: readonly number[] = [7, 30, 100, 365] as const;

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
  /** Newly unlocked milestones (subset of STREAK_MILESTONES). Drives the badge UI. */
  newMilestones: number[];
  /** True iff this call advanced (or initialised) the streak; false iff already counted. */
  advanced: boolean;
}

/**
 * Apply a successful shared-SDC for `candidateDate`.
 *
 * Rules:
 *   - if lastStreakDate == candidateDate → no-op (already counted; double-fire safe).
 *   - if lastStreakDate == candidateDate - 1 day → currentStreak += 1.
 *   - else → currentStreak = 1 (a gap implies the previous streak already ended).
 *   - longestStreak = max(longestStreak, currentStreak).
 *   - a milestone fires the FIRST time currentStreak equals that threshold.
 *
 * The no-op branch is what makes the whole engine idempotent: both friends' devices
 * race to record the same completed day, and the loser changes nothing.
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
 * Decide whether a streak should be considered broken, given the last shared
 * complete day and the current local date of the user who is FURTHEST BEHIND.
 *
 *   - lastStreakDate null → nothing to break.
 *   - today == lastStreakDate → fine, it advanced today.
 *   - today == lastStreakDate + 1 → fine, the partner may still complete today.
 *   - otherwise the gap is ≥ 2 calendar days, so a whole day was missed → break.
 *
 * Using the further-behind user's date is the fair reading: if even the user with
 * the most time remaining is two days past, then both of them missed a day.
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
 * Tolerant of partial/missing fields — anything not explicitly logged counts as 0.
 *
 * firestore.rules enforces this same equality on every write, so a document whose
 * prayerCount disagrees with its flags cannot exist in the database.
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

/**
 * Build the canonical pair id from two uids: sorted lexicographically, joined by `_`.
 *
 * MIRRORED in firestore.rules (`pairIdOf`) and functions/src/streakMath.ts. The rules
 * verify that a friendship's document id equals this function's output, so a client
 * that computes it differently cannot create a friendship at all.
 */
export function pairIdOf(uidA: string, uidB: string): string {
  if (uidA === uidB) throw new Error('pairIdOf: cannot pair a user with themselves');
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}
