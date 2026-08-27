/**
 * Pure-function streak math tests.
 *
 * Coverage targets from the spec quality bar:
 *   - basic increment / start / no-op
 *   - timezone boundary scenarios (PKT vs EST)
 *   - missed days / gap detection
 *   - DST transitions
 *   - milestone unlocking
 *   - blocked friend equivalence (streak resets on partner change)
 *   - prayerCount edge cases
 *
 * These are PURE function tests — no admin SDK, no emulator. They are the
 * authoritative spec for what the streak engine is allowed to do.
 */

import {
  applySharedDayComplete,
  shouldBreakStreak,
  computePrayerCount,
  pairIdOf,
} from '../src/streakMath';
import { localDateKey, previousDateKey, dayDiff, isValidDateKey } from '../src/dates';

describe('applySharedDayComplete', () => {
  const base = {
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: null as string | null,
    milestonesAchieved: [] as number[],
    candidateDate: '2025-03-10',
  };

  test('starts a streak from zero', () => {
    const r = applySharedDayComplete(base);
    expect(r.advanced).toBe(true);
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.lastStreakDate).toBe('2025-03-10');
    expect(r.newMilestones).toEqual([]);
  });

  test('continues a streak across consecutive days', () => {
    const r = applySharedDayComplete({
      ...base,
      currentStreak: 5,
      longestStreak: 5,
      lastStreakDate: '2025-03-09',
    });
    expect(r.currentStreak).toBe(6);
    expect(r.longestStreak).toBe(6);
    expect(r.advanced).toBe(true);
  });

  test('resets to 1 when there is a gap day', () => {
    const r = applySharedDayComplete({
      ...base,
      currentStreak: 12,
      longestStreak: 30,
      lastStreakDate: '2025-03-07', // gap on 03-08, 03-09
    });
    expect(r.currentStreak).toBe(1);
    // longestStreak is preserved as a memorial
    expect(r.longestStreak).toBe(30);
  });

  test('is idempotent when called twice for the same date (double-fire safe)', () => {
    const r = applySharedDayComplete({
      ...base,
      currentStreak: 6,
      longestStreak: 6,
      lastStreakDate: '2025-03-10',
    });
    expect(r.advanced).toBe(false);
    expect(r.currentStreak).toBe(6);
    expect(r.lastStreakDate).toBe('2025-03-10');
    expect(r.newMilestones).toEqual([]);
  });

  test('unlocks the 7-day milestone exactly once', () => {
    const r1 = applySharedDayComplete({
      ...base,
      currentStreak: 6,
      longestStreak: 6,
      lastStreakDate: '2025-03-09',
    });
    expect(r1.currentStreak).toBe(7);
    expect(r1.newMilestones).toEqual([7]);
    expect(r1.milestonesAchieved).toEqual([7]);

    // Same scenario, milestonesAchieved already populated → no re-fire.
    const r2 = applySharedDayComplete({
      ...base,
      currentStreak: 6,
      longestStreak: 7,
      lastStreakDate: '2025-03-09',
      milestonesAchieved: [7],
    });
    expect(r2.newMilestones).toEqual([]);
    expect(r2.milestonesAchieved).toEqual([7]);
  });

  test('unlocks 30, 100, 365 at the right boundaries', () => {
    expect(applySharedDayComplete({
      ...base, currentStreak: 29, longestStreak: 29, lastStreakDate: '2025-03-09',
    }).newMilestones).toEqual([30]);
    expect(applySharedDayComplete({
      ...base, currentStreak: 99, longestStreak: 99, lastStreakDate: '2025-03-09',
    }).newMilestones).toEqual([100]);
    expect(applySharedDayComplete({
      ...base, currentStreak: 364, longestStreak: 364, lastStreakDate: '2025-03-09',
    }).newMilestones).toEqual([365]);
  });

  test('preserves longestStreak when current dips after a reset', () => {
    const r = applySharedDayComplete({
      ...base,
      currentStreak: 100,
      longestStreak: 100,
      lastStreakDate: '2025-01-01', // huge gap
    });
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(100);
  });

  test('milestone array stays sorted ascending', () => {
    const r = applySharedDayComplete({
      ...base,
      currentStreak: 364,
      longestStreak: 364,
      lastStreakDate: '2025-03-09',
      milestonesAchieved: [100, 7, 30],
    });
    expect(r.milestonesAchieved).toEqual([7, 30, 100, 365]);
  });
});

describe('shouldBreakStreak', () => {
  test('null lastStreakDate is never a break', () => {
    expect(shouldBreakStreak(null, '2025-03-10')).toBe(false);
  });

  test('same day is not a break (streak just advanced)', () => {
    expect(shouldBreakStreak('2025-03-10', '2025-03-10')).toBe(false);
  });

  test('one day later is not a break — partner may yet complete today', () => {
    expect(shouldBreakStreak('2025-03-09', '2025-03-10')).toBe(false);
  });

  test('two or more days later IS a break', () => {
    expect(shouldBreakStreak('2025-03-08', '2025-03-10')).toBe(true);
    expect(shouldBreakStreak('2025-01-01', '2025-03-10')).toBe(true);
  });

  test('handles month/year rollovers', () => {
    expect(shouldBreakStreak('2024-12-31', '2025-01-01')).toBe(false); // 1-day gap, fine
    expect(shouldBreakStreak('2024-12-30', '2025-01-01')).toBe(true);  // 2-day gap
  });

  test('handles DST spring-forward (US): 2025-03-09 is the lost-hour day, but date math is unaffected', () => {
    // PKT and EST both use date-string semantics — no UTC offset arithmetic.
    expect(shouldBreakStreak('2025-03-08', '2025-03-09')).toBe(false);
    expect(shouldBreakStreak('2025-03-08', '2025-03-10')).toBe(true);
  });
});

describe('localDateKey — timezone semantics', () => {
  // 2025-03-10T03:30:00Z is:
  //   Asia/Karachi (PKT, UTC+5)      → 2025-03-10 08:30  → '2025-03-10'
  //   America/New_York (EST, UTC-5)  → 2025-03-09 23:30  → '2025-03-09'  (PRE spring-forward)
  // After spring-forward (which happened on 2025-03-09), NY is on EDT (UTC-4), but at this UTC
  // moment NY's wall clock reads 2025-03-09 23:30 — still the previous day from PKT's view.
  const sameInstant = new Date('2025-03-10T03:30:00Z');

  test('PKT and EST disagree on calendar date for the same instant', () => {
    expect(localDateKey(sameInstant, 'Asia/Karachi')).toBe('2025-03-10');
    expect(localDateKey(sameInstant, 'America/New_York')).toBe('2025-03-09');
  });

  test('UTC formatting is consistent across DST', () => {
    const beforeDST = new Date('2025-03-09T06:00:00Z');
    const afterDST = new Date('2025-03-10T06:00:00Z');
    expect(localDateKey(beforeDST, 'America/New_York')).toBe('2025-03-09');
    expect(localDateKey(afterDST, 'America/New_York')).toBe('2025-03-10');
  });

  test('rejects invalid timezone via guard', () => {
    expect(() => localDateKey(sameInstant, 'Not/Real')).toThrow();
  });
});

describe('cross-timezone pair scenario (integration of math primitives)', () => {
  // Simulate a PKT user (A) and an EST user (B) on 2025-03-10.
  // When B's local date 2025-03-10 begins, A is already 10 hours into their 2025-03-10.
  // The pair streak must only advance when BOTH have the same date string completed.

  const baseFriendship = {
    currentStreak: 4,
    longestStreak: 4,
    lastStreakDate: '2025-03-09',
    milestonesAchieved: [] as number[],
  };

  test('A completes 03-10 first; without B, streak does NOT advance (gate happens elsewhere — but math is correct when called)', () => {
    // The `applySharedDayComplete` function is only called once we've already verified
    // BOTH partners completed `candidateDate`. Here we simulate that both DID complete
    // 2025-03-10 in their own local tz — even though those are different real-world
    // moments, the date string matches.
    const r = applySharedDayComplete({ ...baseFriendship, candidateDate: '2025-03-10' });
    expect(r.currentStreak).toBe(5);
    expect(r.advanced).toBe(true);
  });

  test('mid-streak block scenario: friendship status is checked outside the streak math, but a fresh start after a removed→re-active still begins at 1', () => {
    // After re-activation, currentStreak=0, lastStreakDate=null (acceptInvite reset).
    const r = applySharedDayComplete({
      currentStreak: 0,
      longestStreak: 50, // history preserved
      lastStreakDate: null,
      milestonesAchieved: [7, 30],
      candidateDate: '2025-03-10',
    });
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(50);
    // Existing milestones are NOT re-fired because they were already in milestonesAchieved.
    expect(r.newMilestones).toEqual([]);
  });
});

describe('computePrayerCount', () => {
  test('counts only logged=true', () => {
    expect(computePrayerCount({})).toBe(0);
    expect(computePrayerCount({ fajr: { logged: true } })).toBe(1);
    expect(computePrayerCount({
      fajr: { logged: true }, dhuhr: { logged: true }, asr: { logged: true },
      maghrib: { logged: true }, isha: { logged: true },
    })).toBe(5);
  });

  test('treats logged=false / missing as 0', () => {
    expect(computePrayerCount({
      fajr: { logged: false }, dhuhr: undefined as unknown as { logged: boolean },
    })).toBe(0);
  });

  test('ignores unknown keys', () => {
    expect(computePrayerCount({
      fajr: { logged: true },
      // @ts-expect-error — testing tolerance to unexpected fields
      sunrise: { logged: true },
    })).toBe(1);
  });
});

describe('pairIdOf', () => {
  test('produces the same id regardless of arg order', () => {
    expect(pairIdOf('alpha', 'beta')).toBe('alpha_beta');
    expect(pairIdOf('beta', 'alpha')).toBe('alpha_beta');
  });
  test('throws on self-pair', () => {
    expect(() => pairIdOf('x', 'x')).toThrow();
  });
});

describe('date helpers', () => {
  test('previousDateKey rolls month/year correctly', () => {
    expect(previousDateKey('2025-03-10')).toBe('2025-03-09');
    expect(previousDateKey('2025-03-01')).toBe('2025-02-28');
    expect(previousDateKey('2024-03-01')).toBe('2024-02-29'); // leap year
    expect(previousDateKey('2025-01-01')).toBe('2024-12-31');
  });

  test('dayDiff is signed and exact', () => {
    expect(dayDiff('2025-03-10', '2025-03-10')).toBe(0);
    expect(dayDiff('2025-03-10', '2025-03-11')).toBe(1);
    expect(dayDiff('2025-03-10', '2025-03-09')).toBe(-1);
    expect(dayDiff('2025-01-01', '2025-12-31')).toBe(364);
  });

  test('isValidDateKey rejects malformed input', () => {
    expect(isValidDateKey('2025-03-10')).toBe(true);
    expect(isValidDateKey('2025-13-01')).toBe(false);
    expect(isValidDateKey('2025-02-30')).toBe(false);
    expect(isValidDateKey('not-a-date')).toBe(false);
    expect(isValidDateKey(undefined)).toBe(false);
    expect(isValidDateKey(20250310)).toBe(false);
  });
});
