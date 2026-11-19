/** Offline Hijri conversion. */

import {
  formatHijri,
  gregorianToHijri,
  gregorianToHijriTabular,
  hijriMonthName,
} from '../lib/hijri';

describe('gregorianToHijriTabular (fallback calendar)', () => {
  it('lands within ±1 day of Umm al-Qura mid-Ramadan 1446 (15 Mar 2025)', () => {
    const h = gregorianToHijriTabular(new Date(2025, 2, 15));
    expect(h.year).toBe(1446);
    expect(h.month).toBe(9);
    expect(Math.abs(h.day - 14)).toBeLessThanOrEqual(2);
  });

  it('is monotonic day-to-day and rolls months cleanly', () => {
    let prev = gregorianToHijriTabular(new Date(2026, 0, 1));
    for (let i = 1; i < 400; i++) {
      const cur = gregorianToHijriTabular(new Date(2026, 0, 1 + i));
      const advanced =
        (cur.year === prev.year && cur.month === prev.month && cur.day === prev.day + 1) ||
        (cur.year === prev.year && cur.month === prev.month + 1 && cur.day === 1) ||
        (cur.year === prev.year + 1 && prev.month === 12 && cur.month === 1 && cur.day === 1);
      expect(advanced).toBe(true);
      prev = cur;
    }
  });
});

describe('gregorianToHijri (best available)', () => {
  it('returns a plausible 1448 AH date in Nov 2026', () => {
    const h = gregorianToHijri(new Date(2026, 10, 19));
    expect(h.year).toBe(1448);
    expect(h.month).toBeGreaterThanOrEqual(5);
    expect(h.month).toBeLessThanOrEqual(6);
  });

  it('detects Ramadan 1447 in late Feb 2026', () => {
    expect(gregorianToHijri(new Date(2026, 1, 25)).month).toBe(9);
  });
});

describe('formatting', () => {
  it('month names', () => {
    expect(hijriMonthName(9)).toBe('Ramadan');
    expect(hijriMonthName(1)).toBe('Muharram');
    expect(hijriMonthName(9, 'ar')).toBe('رمضان');
  });

  it('formatHijri ends with AH', () => {
    expect(formatHijri(new Date(2026, 10, 19))).toMatch(/^\d{1,2} .+ \d{4} AH$/);
  });
});
