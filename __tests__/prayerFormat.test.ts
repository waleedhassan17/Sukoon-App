import { formatCountdown, prayerNameKey, spokenCountdown } from '../lib/prayerFormat';

describe('formatCountdown', () => {
  it('formats HH:MM:SS', () => {
    expect(formatCountdown(9_045_000)).toBe('02:30:45');
    expect(formatCountdown(59_000)).toBe('00:00:59');
    expect(formatCountdown(3_600_000)).toBe('01:00:00');
  });
  it('never goes negative', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });
  it('floors partial seconds', () => {
    expect(formatCountdown(1999)).toBe('00:00:01');
  });
});

describe('spokenCountdown', () => {
  it('speaks hours and minutes', () => {
    expect(spokenCountdown(9_000_000)).toBe('2 hours 30 minutes');
    expect(spokenCountdown(3_600_000)).toBe('1 hour');
    expect(spokenCountdown(60_000)).toBe('1 minute');
    expect(spokenCountdown(0)).toBe('0 minutes');
  });
});

describe('prayerNameKey', () => {
  const friday = new Date(2026, 10, 20, 12, 30); // Fri 20 Nov 2026
  const thursday = new Date(2026, 10, 19, 12, 30);
  it("Friday's Dhuhr is Jumu'ah, nothing else is", () => {
    expect(prayerNameKey('dhuhr', friday)).toBe('prayer.name.jumuah');
    expect(prayerNameKey('asr', friday)).toBe('prayer.name.asr');
    expect(prayerNameKey('fajr', friday)).toBe('prayer.name.fajr');
  });
  it('other days use the normal name', () => {
    expect(prayerNameKey('dhuhr', thursday)).toBe('prayer.name.dhuhr');
  });
});
