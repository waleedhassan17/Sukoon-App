/** Pure notification-schedule builder: budgets, priority, toggles, diffing. */

import { computeRange, resolveSettings, PrayerKey } from '../lib/prayerEngine';
import {
  azanChannelAndSound,
  buildDailies,
  buildSchedule,
  CHANNEL_ID,
  dailySig,
  diffSchedule,
  isOurId,
  parseHHMM,
  platformBudget,
  prayerLabel,
  SchedulePrefs,
} from '../lib/prayerSchedule';

const LAHORE = { lat: 31.5204, lng: 74.3587 };

function prefs(over: Partial<SchedulePrefs> = {}): SchedulePrefs {
  return {
    enabled: true,
    prayerAlerts: { fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true },
    preAlertMinutes: 10,
    azanSound: true,
    fajrSpecialSound: true,
    salahTrackerReminder: true,
    salahTrackerTime: '22:00',
    quranReminder: false,
    quranReminderTime: '08:00',
    ...over,
  };
}

// 19 Nov 2026, 06:00 local — early morning so today's later prayers are still ahead.
const NOW = new Date(2026, 10, 19, 6, 0, 0);
const days = (n = 30) => computeRange(LAHORE, n, resolveSettings(LAHORE), NOW);

describe('platformBudget', () => {
  it('keeps iOS under its 64-pending cap and Android under ~500 alarms', () => {
    expect(platformBudget('ios').maxScheduled).toBeLessThanOrEqual(64);
    expect(platformBudget('android').maxScheduled).toBeLessThan(500);
  });
});

describe('buildSchedule — Android (everything fits)', () => {
  const r = buildSchedule({ days: days(), prefs: prefs(), now: NOW, budget: platformBudget('android') });

  it('covers a full 30-day window without any app launch', () => {
    expect(r.daysCovered).toBe(30);
    expect(r.windowEnd!.getTime()).toBeGreaterThan(NOW.getTime() + 29 * 86400_000);
  });

  it('stays within the budget and is chronological', () => {
    expect(r.total).toBeLessThanOrEqual(platformBudget('android').maxScheduled);
    for (let i = 1; i < r.specs.length; i++) {
      expect(r.specs[i].fireAt.getTime()).toBeGreaterThanOrEqual(r.specs[i - 1].fireAt.getTime());
    }
  });

  it('has 5 azans + 5 pre-alerts per full day, minus today’s prayers already gone', () => {
    const azans = r.specs.filter((s) => s.kind === 'azan');
    const pres = r.specs.filter((s) => s.kind === 'pre-alert');
    const goneToday = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter(
      (k) => (days()[0].times as any)[k].getTime() <= NOW.getTime(),
    ).length;
    expect(azans.length).toBe(30 * 5 - goneToday);
    expect(pres.length).toBe(azans.length);
    r.specs.forEach((s) => expect(s.fireAt.getTime()).toBeGreaterThan(NOW.getTime()));
  });
});

describe('buildSchedule — never schedules the past', () => {
  it('skips prayers already gone today', () => {
    const late = new Date(2026, 10, 19, 15, 0, 0);
    const r = buildSchedule({
      days: computeRange(LAHORE, 3, resolveSettings(LAHORE), late),
      prefs: prefs({ preAlertMinutes: 0 }),
      now: late,
      budget: platformBudget('android'),
    });
    r.specs.forEach((s) => expect(s.fireAt.getTime()).toBeGreaterThan(late.getTime()));
    const today = r.specs.filter((s) => s.id.endsWith('2026-11-19') && s.kind === 'azan');
    // Fajr/Dhuhr/Asr(Lahore ≈ 15:xx may be ahead) — at minimum fajr+dhuhr are gone.
    expect(today.find((s) => s.data.prayer === 'fajr')).toBeUndefined();
    expect(today.find((s) => s.data.prayer === 'dhuhr')).toBeUndefined();
    expect(today.find((s) => s.data.prayer === 'isha')).toBeDefined();
  });
});

describe('buildSchedule — iOS (64-notification cap)', () => {
  const budget = platformBudget('ios');

  it('with pre-alerts: fits the cap, whole days only, keeps near pre-alerts, adds a refill notice', () => {
    const r = buildSchedule({ days: days(), prefs: prefs(), now: NOW, budget });
    expect(r.total).toBeLessThanOrEqual(budget.maxScheduled);
    expect(r.daysCovered).toBeGreaterThanOrEqual(7);

    // Whole days: every covered day has the same set of azans (except today, which is partial).
    const byDay = new Map<string, number>();
    r.specs.filter((s) => s.kind === 'azan').forEach((s) => {
      const k = s.id.slice(-10);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    });
    const counts = [...byDay.entries()].filter(([k]) => k !== '2026-11-19').map(([, n]) => n);
    expect(new Set(counts)).toEqual(new Set([5]));

    // Nearest days keep their pre-alerts.
    const pre = r.specs.filter((s) => s.kind === 'pre-alert');
    expect(pre.length).toBeGreaterThan(0);
    expect(pre.some((s) => s.id.endsWith('2026-11-20'))).toBe(true);

    expect(r.specs.some((s) => s.kind === 'refill')).toBe(true);
  });

  it('azan-only reaches much further than with pre-alerts', () => {
    const withPre = buildSchedule({ days: days(), prefs: prefs(), now: NOW, budget });
    const azanOnly = buildSchedule({ days: days(), prefs: prefs({ preAlertMinutes: 0 }), now: NOW, budget });
    expect(azanOnly.daysCovered).toBeGreaterThanOrEqual(withPre.daysCovered);
    expect(azanOnly.daysCovered).toBeGreaterThanOrEqual(10);
    expect(azanOnly.total).toBeLessThanOrEqual(budget.maxScheduled);
  });

  it('dailies take one slot each regardless of window length', () => {
    const r = buildSchedule({ days: days(), prefs: prefs({ quranReminder: true }), now: NOW, budget });
    expect(r.dailies).toHaveLength(2);
    expect(r.total).toBe(r.specs.length + 2);
  });
});

describe('buildSchedule — preferences', () => {
  const run = (p: SchedulePrefs, n = 2) =>
    buildSchedule({ days: days(n), prefs: p, now: NOW, budget: platformBudget('android') });

  it('master off → no azans, but daily reminders keep their own switches', () => {
    const r = run(prefs({ enabled: false, quranReminder: true }));
    expect(r.specs).toHaveLength(0);
    expect(r.windowEnd).toBeNull();
    expect(r.dailies.map((d) => d.id)).toEqual(['salah-tracker-reminder', 'quran-reading-reminder']);
    expect(r.total).toBe(2);
  });

  it('master off and both reminders off → nothing at all', () => {
    const r = run(prefs({ enabled: false, salahTrackerReminder: false, quranReminder: false }));
    expect(r.total).toBe(0);
  });

  it('per-prayer toggles are honoured', () => {
    const r = run(
      prefs({
        prayerAlerts: { fajr: false, sunrise: false, dhuhr: true, asr: false, maghrib: false, isha: false },
        preAlertMinutes: 0,
      }),
    );
    const azans = r.specs.filter((s) => s.kind === 'azan');
    expect(azans.length).toBeGreaterThan(0);
    azans.forEach((s) => expect(s.data.prayer).toBe('dhuhr'));
  });

  it('sunrise is never scheduled even if toggled on', () => {
    const r = run(
      prefs({
        prayerAlerts: { fajr: true, sunrise: true, dhuhr: true, asr: true, maghrib: true, isha: true },
      }),
    );
    expect(r.specs.find((s) => s.data.prayer === 'sunrise')).toBeUndefined();
  });

  it('pre-alert fires exactly N minutes before the azan', () => {
    const r = run(prefs({ preAlertMinutes: 15 }));
    const azan = r.specs.find((s) => s.id === 'prayer-asr-2026-11-20')!;
    const pre = r.specs.find((s) => s.id === 'prayer-pre-asr-2026-11-20')!;
    expect(azan.fireAt.getTime() - pre.fireAt.getTime()).toBe(15 * 60_000);
  });

  it('azan sound off → silent channel for every prayer, including Fajr', () => {
    const r = run(prefs({ azanSound: false }));
    r.specs.filter((s) => s.kind === 'azan').forEach((s) => {
      expect(s.channel).toBe('azan-silent');
      expect(s.sound).toBeNull();
    });
  });

  it('Fajr special sound on/off picks the Fajr vs standard azan channel', () => {
    const fajrAzan = (p: SchedulePrefs) =>
      run(p).specs.find((s) => s.kind === 'azan' && s.data.prayer === 'fajr')!;
    const on = fajrAzan(prefs({ fajrSpecialSound: true }));
    const off = fajrAzan(prefs({ fajrSpecialSound: false }));
    expect(on.channel).toBe('azan-fajr');
    expect(on.sound).toBe('azan_fajr.wav');
    expect(off.channel).toBe('azan');
    expect(off.sound).toBe('azan.wav');
  });

  it('Friday Dhuhr is titled Jumu’ah', () => {
    // 20 Nov 2026 is a Friday.
    const r = run(prefs());
    const fri = r.specs.find((s) => s.id === 'prayer-dhuhr-2026-11-20')!;
    const thu = r.specs.find((s) => s.id === 'prayer-dhuhr-2026-11-19')!;
    expect(new Date(2026, 10, 20).getDay()).toBe(5);
    expect(fri.title).toBe("Jumu'ah Prayer Time");
    expect(thu.title).toBe('Dhuhr Prayer Time');
  });

  it('azan carries its fire time in data (used to ignore stale taps)', () => {
    const r = run(prefs());
    const a = r.specs.find((s) => s.kind === 'azan')!;
    expect(a.data.fireAt).toBe(a.fireAt.getTime());
    expect(typeof a.data.sig).toBe('string');
  });

  it('changing any visible attribute changes the signature', () => {
    const base = run(prefs()).specs.find((s) => s.id === 'prayer-asr-2026-11-20')!;
    const silent = run(prefs({ azanSound: false })).specs.find((s) => s.id === 'prayer-asr-2026-11-20')!;
    expect(silent.data.sig).not.toBe(base.data.sig);
  });
});

describe('daily reminders', () => {
  it('use the configured times and are repeating specs, not dated', () => {
    const d = buildDailies(prefs({ quranReminder: true, quranReminderTime: '07:30', salahTrackerTime: '21:15' }));
    expect(d.map((x) => [x.id, x.hour, x.minute])).toEqual([
      ['salah-tracker-reminder', 21, 15],
      ['quran-reading-reminder', 7, 30],
    ]);
  });

  it('bad time strings fall back to defaults', () => {
    expect(parseHHMM('25:99', [22, 0])).toEqual([22, 0]);
    expect(parseHHMM('nonsense', [8, 0])).toEqual([8, 0]);
    expect(parseHHMM('06:05', [0, 0])).toEqual([6, 5]);
  });

  it('signature changes with the time', () => {
    const a = buildDailies(prefs({ salahTrackerTime: '22:00' }))[0];
    const b = buildDailies(prefs({ salahTrackerTime: '22:30' }))[0];
    expect(dailySig(a)).not.toBe(dailySig(b));
  });
});

describe('diffSchedule', () => {
  it('leaves identical items alone, adds new, cancels stale — ours only', () => {
    const d = diffSchedule(
      [
        { id: 'prayer-fajr-2026-11-20', sig: 'a' },
        { id: 'prayer-dhuhr-2026-11-20', sig: 'b2' }, // changed
        { id: 'prayer-asr-2026-11-20', sig: 'c' }, // new
      ],
      [
        { identifier: 'prayer-fajr-2026-11-20', sig: 'a' },
        { identifier: 'prayer-dhuhr-2026-11-20', sig: 'b' },
        { identifier: 'prayer-isha-2026-11-19', sig: 'z' }, // stale
        { identifier: 'friend-nudge-123', sig: 'x' }, // not ours → untouched
      ],
    );
    expect(d.cancel).toEqual(['prayer-isha-2026-11-19']);
    expect(d.add.sort()).toEqual(['prayer-asr-2026-11-20', 'prayer-dhuhr-2026-11-20']);
  });

  it('a second identical run is a no-op (no wipe-and-relay)', () => {
    const r = buildSchedule({ days: days(), prefs: prefs(), now: NOW, budget: platformBudget('android') });
    const desired = r.specs.map((s) => ({ id: s.id, sig: s.data.sig as string }));
    const existing = r.specs.map((s) => ({ identifier: s.id, sig: s.data.sig as string }));
    expect(diffSchedule(desired, existing)).toEqual({ cancel: [], add: [] });
  });

  it('a shorter new window cancels only the tail, never more', () => {
    const long = buildSchedule({ days: days(30), prefs: prefs(), now: NOW, budget: platformBudget('android') });
    const short = buildSchedule({ days: days(5), prefs: prefs(), now: NOW, budget: platformBudget('android') });
    const d = diffSchedule(
      short.specs.map((s) => ({ id: s.id, sig: s.data.sig as string })),
      long.specs.map((s) => ({ identifier: s.id, sig: s.data.sig as string })),
    );
    expect(d.cancel.length).toBeGreaterThan(0);
    expect(d.add.length).toBeLessThanOrEqual(1); // at most the differing refill notice
  });

  it('isOurId', () => {
    expect(isOurId('prayer-fajr-2026-11-20')).toBe(true);
    expect(isOurId('prayer-pre-fajr-2026-11-20')).toBe(true);
    expect(isOurId('salah-tracker-reminder')).toBe(true);
    expect(isOurId('quran-reading-reminder')).toBe(true);
    expect(isOurId('eod-prayer-reminder')).toBe(false);
    expect(isOurId('test-azan-1')).toBe(false);
  });
});

describe('azanChannelAndSound / labels / channels', () => {
  it('maps toggles to channels', () => {
    expect(azanChannelAndSound('dhuhr', { azanSound: true, fajrSpecialSound: true })).toEqual({
      channel: 'azan',
      sound: 'azan.wav',
    });
    expect(azanChannelAndSound('fajr', { azanSound: true, fajrSpecialSound: true }).channel).toBe('azan-fajr');
    expect(azanChannelAndSound('fajr', { azanSound: false, fajrSpecialSound: true }).channel).toBe('azan-silent');
  });

  it('Jumu’ah label only on Friday Dhuhr', () => {
    const fri = new Date(2026, 10, 20);
    const thu = new Date(2026, 10, 19);
    expect(prayerLabel('dhuhr', fri)).toBe("Jumu'ah");
    expect(prayerLabel('dhuhr', thu)).toBe('Dhuhr');
    expect(prayerLabel('asr', fri)).toBe('Asr');
  });

  it('channel ids are versioned', () => {
    Object.values(CHANNEL_ID).forEach((id) => expect(id).toMatch(/-v2$/));
  });
});

// Keep the type import used.
const _k: PrayerKey = 'fajr';
void _k;
