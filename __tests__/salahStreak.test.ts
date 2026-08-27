/**
 * Salah Buddy shared-streak math.
 *
 * On the Spark plan this math runs on the CLIENT (there is no deployable Cloud
 * Function), and firestore.rules independently re-derives the same transition
 * before accepting the write. So a bug here does not corrupt data — it produces
 * writes the rules reject, i.e. a streak that silently stops advancing. These
 * tests are what keep the two derivations agreeing.
 *
 * The final describe block guards against drift between this copy and its twin in
 * functions/src/, which must stay equivalent for a future Blaze cutover.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  applySharedDayComplete,
  shouldBreakStreak,
  computePrayerCount,
  pairIdOf,
  STREAK_MILESTONES,
} from '../lib/salah/streakMath';
import {
  localDateKey,
  previousDateKey,
  dayDiff,
  isValidDateKey,
  isValidTimezone,
} from '../lib/salah/dates';

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

  test('continues across consecutive days', () => {
    const r = applySharedDayComplete({
      ...base, currentStreak: 5, longestStreak: 5, lastStreakDate: '2025-03-09',
    });
    expect(r.currentStreak).toBe(6);
    expect(r.longestStreak).toBe(6);
    expect(r.advanced).toBe(true);
  });

  test('resets to 1 after a gap, preserving longestStreak', () => {
    const r = applySharedDayComplete({
      ...base, currentStreak: 12, longestStreak: 30, lastStreakDate: '2025-03-07',
    });
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(30);
  });

  test('is idempotent for the same date — both devices may race to record it', () => {
    const r = applySharedDayComplete({
      ...base, currentStreak: 6, longestStreak: 6, lastStreakDate: '2025-03-10',
    });
    expect(r.advanced).toBe(false);
    expect(r.currentStreak).toBe(6);
    expect(r.newMilestones).toEqual([]);
  });

  test('repeated application never double-counts', () => {
    let state = { ...base, candidateDate: '2025-03-10' };
    const first = applySharedDayComplete(state);
    const second = applySharedDayComplete({ ...state, ...first, candidateDate: '2025-03-10' });
    const third = applySharedDayComplete({ ...state, ...second, candidateDate: '2025-03-10' });
    expect(first.currentStreak).toBe(1);
    expect(second.currentStreak).toBe(1);
    expect(third.currentStreak).toBe(1);
  });

  test('longestStreak never decreases across a long history', () => {
    let cur = 0, longest = 0, last: string | null = null, ms: number[] = [];
    const days = ['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-09', '2025-03-10'];
    for (const d of days) {
      const r = applySharedDayComplete({
        currentStreak: cur, longestStreak: longest, lastStreakDate: last,
        milestonesAchieved: ms, candidateDate: d,
      });
      expect(r.longestStreak).toBeGreaterThanOrEqual(longest);
      ({ currentStreak: cur, longestStreak: longest, milestonesAchieved: ms } = r);
      last = r.lastStreakDate;
    }
    expect(longest).toBe(3); // the 03-01..03-03 run
    expect(cur).toBe(2);     // 03-09..03-10 after the gap
  });

  test('unlocks each milestone exactly once', () => {
    const at = (streak: number, achieved: number[]) => applySharedDayComplete({
      currentStreak: streak - 1,
      longestStreak: streak - 1,
      lastStreakDate: '2025-03-09',
      milestonesAchieved: achieved,
      candidateDate: '2025-03-10',
    });

    const first = at(7, []);
    expect(first.newMilestones).toEqual([7]);
    expect(first.milestonesAchieved).toEqual([7]);

    // Reaching 7 again after a reset must NOT re-award it.
    const again = at(7, [7]);
    expect(again.newMilestones).toEqual([]);
    expect(again.milestonesAchieved).toEqual([7]);
  });

  test('awards nothing on a non-milestone day', () => {
    const r = applySharedDayComplete({
      ...base, currentStreak: 7, longestStreak: 7, lastStreakDate: '2025-03-09',
      milestonesAchieved: [7],
    });
    expect(r.currentStreak).toBe(8);
    expect(r.newMilestones).toEqual([]);
  });

  test('milestone thresholds match the set the rules enforce', () => {
    // firestore.rules rejects any value outside this list, so a mismatch here
    // would make the award write fail rather than merely look wrong.
    expect(STREAK_MILESTONES).toEqual([7, 30, 100, 365]);
  });

  test('spans a month boundary', () => {
    const r = applySharedDayComplete({
      ...base, currentStreak: 3, longestStreak: 3,
      lastStreakDate: '2025-02-28', candidateDate: '2025-03-01',
    });
    expect(r.currentStreak).toBe(4);
  });

  test('DST spring-forward does not disturb date arithmetic', () => {
    // 2025-03-09 is the US lost-hour day; date KEYS are unaffected because we
    // never compare instants.
    const r = applySharedDayComplete({
      ...base, currentStreak: 2, longestStreak: 2,
      lastStreakDate: '2025-03-09', candidateDate: '2025-03-10',
    });
    expect(r.currentStreak).toBe(3);
  });
});

describe('shouldBreakStreak', () => {
  test('a null lastStreakDate is never a break', () => {
    expect(shouldBreakStreak(null, '2025-03-10')).toBe(false);
  });

  test('same day is not a break', () => {
    expect(shouldBreakStreak('2025-03-10', '2025-03-10')).toBe(false);
  });

  test('one day later is not a break — the partner may still complete today', () => {
    expect(shouldBreakStreak('2025-03-09', '2025-03-10')).toBe(false);
  });

  test('two or more days later is a break', () => {
    expect(shouldBreakStreak('2025-03-08', '2025-03-10')).toBe(true);
    expect(shouldBreakStreak('2025-01-01', '2025-03-10')).toBe(true);
  });

  test('handles month and year rollovers', () => {
    expect(shouldBreakStreak('2024-12-31', '2025-01-01')).toBe(false);
    expect(shouldBreakStreak('2024-12-30', '2025-01-01')).toBe(true);
  });
});

describe('cross-timezone semantics', () => {
  test('two zones disagree on the calendar date for the same instant', () => {
    // 2025-03-10T19:00Z is already the 11th in Karachi but still the 10th in NY.
    const instant = new Date('2025-03-10T19:00:00Z');
    expect(localDateKey(instant, 'Asia/Karachi')).toBe('2025-03-11');
    expect(localDateKey(instant, 'America/New_York')).toBe('2025-03-10');
  });

  test('the pair advances on the date STRING both users completed, not a shared instant', () => {
    // Karachi user completes their 2025-03-10; New York user completes their
    // 2025-03-10 some hours later in real time. Same key, so the streak advances
    // once — this is the documented tie-break for cross-timezone pairs.
    const r = applySharedDayComplete({
      currentStreak: 4, longestStreak: 4, lastStreakDate: '2025-03-09',
      milestonesAchieved: [], candidateDate: '2025-03-10',
    });
    expect(r.currentStreak).toBe(5);
    expect(r.advanced).toBe(true);
  });

  test('the further-behind user governs when a streak breaks', () => {
    // Karachi is already on the 12th while New York is still on the 11th. Using
    // the further-behind date (the 11th) keeps the streak alive for the partner
    // who still has hours left in their day.
    expect(shouldBreakStreak('2025-03-10', '2025-03-11')).toBe(false);
    expect(shouldBreakStreak('2025-03-10', '2025-03-12')).toBe(true);
  });

  test('rejects a bogus timezone rather than silently using UTC', () => {
    expect(isValidTimezone('Asia/Karachi')).toBe(true);
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});

describe('computePrayerCount', () => {
  const entry = (logged: boolean) => ({ logged, loggedAt: logged ? 1 : null });

  test('counts only logged=true', () => {
    expect(computePrayerCount({
      fajr: entry(true), dhuhr: entry(true), asr: entry(true),
      maghrib: entry(true), isha: entry(true),
    })).toBe(5);
    expect(computePrayerCount({
      fajr: entry(true), dhuhr: entry(false), asr: entry(true),
      maghrib: entry(false), isha: entry(false),
    })).toBe(2);
  });

  test('treats missing entries as unlogged', () => {
    expect(computePrayerCount({})).toBe(0);
    expect(computePrayerCount({ fajr: entry(true) })).toBe(1);
  });
});

describe('pairIdOf', () => {
  test('is order-independent', () => {
    expect(pairIdOf('bbb', 'aaa')).toBe('aaa_bbb');
    expect(pairIdOf('aaa', 'bbb')).toBe('aaa_bbb');
  });

  test('refuses to pair a user with themselves', () => {
    expect(() => pairIdOf('aaa', 'aaa')).toThrow();
  });
});

describe('date helpers', () => {
  test('previousDateKey rolls month and year boundaries', () => {
    expect(previousDateKey('2025-03-01')).toBe('2025-02-28');
    expect(previousDateKey('2024-03-01')).toBe('2024-02-29'); // leap year
    expect(previousDateKey('2025-01-01')).toBe('2024-12-31');
  });

  test('dayDiff is signed and exact', () => {
    expect(dayDiff('2025-03-01', '2025-03-10')).toBe(9);
    expect(dayDiff('2025-03-10', '2025-03-01')).toBe(-9);
  });

  test('isValidDateKey rejects malformed and impossible dates', () => {
    expect(isValidDateKey('2025-03-10')).toBe(true);
    expect(isValidDateKey('2025-13-01')).toBe(false);
    expect(isValidDateKey('2025-02-30')).toBe(false);
    expect(isValidDateKey('not-a-date')).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });
});

describe('parity with the dormant Cloud Functions copy', () => {
  /**
   * The app and functions/ each carry their own copy of this math because neither
   * package can import from the other. If they drift, a Blaze cutover would
   * silently change how streaks are computed for existing users. Comparing
   * normalised source of the shared functions catches that at build time.
   */
  const FUNCTIONS_SRC = path.resolve(__dirname, '../functions/src');
  const APP_SRC = path.resolve(__dirname, '../lib/salah');

  /** Strip comments and collapse whitespace so formatting differences don't fail. */
  const normalize = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

  /** Pull one top-level `export function name(...) { ... }` out of a source file. */
  function extractFunction(src: string, name: string): string {
    const start = src.indexOf(`export function ${name}(`);
    if (start === -1) throw new Error(`${name} not found`);
    let depth = 0;
    let i = src.indexOf('{', start);
    const bodyStart = i;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return normalize(src.slice(bodyStart, i + 1));
      }
    }
    throw new Error(`unbalanced braces in ${name}`);
  }

  const appMath = fs.readFileSync(path.join(APP_SRC, 'streakMath.ts'), 'utf8');
  const fnMath = fs.readFileSync(path.join(FUNCTIONS_SRC, 'streakMath.ts'), 'utf8');
  const appDates = fs.readFileSync(path.join(APP_SRC, 'dates.ts'), 'utf8');
  const fnDates = fs.readFileSync(path.join(FUNCTIONS_SRC, 'dates.ts'), 'utf8');

  test.each([
    'applySharedDayComplete',
    'shouldBreakStreak',
    'computePrayerCount',
    'pairIdOf',
  ])('streakMath.%s has an identical body in both copies', name => {
    expect(extractFunction(appMath, name)).toBe(extractFunction(fnMath, name));
  });

  test.each([
    'localDateKey',
    'isValidDateKey',
    'previousDateKey',
    'dayDiff',
    'isValidTimezone',
  ])('dates.%s has an identical body in both copies', name => {
    expect(extractFunction(appDates, name)).toBe(extractFunction(fnDates, name));
  });

  test('both copies declare the same milestone thresholds', () => {
    const fnTypes = fs.readFileSync(path.join(FUNCTIONS_SRC, 'types.ts'), 'utf8');
    const fnList = /STREAK_MILESTONES[^=]*=\s*(\[[^\]]*\])/.exec(fnTypes)?.[1];
    const appList = /STREAK_MILESTONES[^=]*=\s*(\[[^\]]*\])/.exec(appMath)?.[1];
    expect(fnList).toBeDefined();
    expect(appList).toBe(fnList);
  });
});
