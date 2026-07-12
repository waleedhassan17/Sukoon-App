/** Streak & badge math — the logic behind listening streaks and Noor badges. */

import {
  computeStreak,
  evaluateBadges,
  formatRemaining,
  MIN_DAY_SECONDS,
  TEN_HOURS_SECONDS,
} from '../lib/audiobooks/streaks';

const TODAY = '2026-07-12';

describe('computeStreak', () => {
  it('returns zeros for no activity', () => {
    expect(computeStreak({}, TODAY)).toEqual({
      current: 0,
      longest: 0,
      lastActiveDate: null,
    });
  });

  it('counts a single active day today', () => {
    const s = computeStreak({ [TODAY]: 300 }, TODAY);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
    expect(s.lastActiveDate).toBe(TODAY);
  });

  it('ignores days below the minimum threshold', () => {
    const s = computeStreak({ [TODAY]: MIN_DAY_SECONDS - 1 }, TODAY);
    expect(s.current).toBe(0);
  });

  it('keeps the streak alive when last activity was yesterday', () => {
    const s = computeStreak({ '2026-07-10': 300, '2026-07-11': 300 }, TODAY);
    expect(s.current).toBe(2);
  });

  it('breaks the streak after a missed day', () => {
    const s = computeStreak({ '2026-07-09': 300, '2026-07-10': 300 }, TODAY);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(2);
  });

  it('counts consecutive runs across month boundaries', () => {
    const s = computeStreak(
      { '2026-06-29': 100, '2026-06-30': 100, '2026-07-01': 100 },
      '2026-07-01'
    );
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
  });

  it('longest streak survives even when current is broken', () => {
    const daily: Record<string, number> = {};
    for (let d = 1; d <= 8; d++) daily[`2026-06-0${d}`] = 200;
    daily[TODAY] = 200;
    const s = computeStreak(daily, TODAY);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(8);
  });
});

describe('evaluateBadges', () => {
  const noStreak = { current: 0, longest: 0, lastActiveDate: null };

  it('grants nothing to a new listener', () => {
    expect(
      evaluateBadges({ totalSeconds: 0, booksCompleted: 0, streak: noStreak })
    ).toEqual([]);
  });

  it('grants first_book_finished', () => {
    expect(
      evaluateBadges({ totalSeconds: 60, booksCompleted: 1, streak: noStreak })
    ).toContain('first_book_finished');
  });

  it('grants ten_hours exactly at the threshold', () => {
    expect(
      evaluateBadges({ totalSeconds: TEN_HOURS_SECONDS, booksCompleted: 0, streak: noStreak })
    ).toContain('ten_hours');
  });

  it('grants streak badges from longest, not only current', () => {
    const badges = evaluateBadges({
      totalSeconds: 0,
      booksCompleted: 0,
      streak: { current: 0, longest: 30, lastActiveDate: '2026-01-01' },
    });
    expect(badges).toContain('streak_7');
    expect(badges).toContain('streak_30');
  });
});

describe('formatRemaining', () => {
  it('is empty when total duration is unknown', () => {
    expect(formatRemaining(0, 100)).toBe('');
  });

  it('formats hours and minutes', () => {
    expect(formatRemaining(2 * 3600 + 15 * 60, 0)).toBe('2h 15m left');
  });

  it('formats minutes only and never shows 0m', () => {
    expect(formatRemaining(600, 590)).toBe('1m left');
  });

  it('clamps when listened exceeds total', () => {
    expect(formatRemaining(600, 700)).toBe('');
  });
});
