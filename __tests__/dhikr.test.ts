/** Tasbeeh counter rules and session persistence. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyTap,
  DEFAULT_DHIKR_ID,
  DHIKR_PRESETS,
  dhikrNameKey,
  findDhikr,
  roundProgress,
  sanitizeSession,
} from '../lib/dhikr';
import { TasbeehStorage } from '../lib/tasbeehStorage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('presets', () => {
  it('ids are unique and targets are positive whole numbers', () => {
    expect(new Set(DHIKR_PRESETS.map((p) => p.id)).size).toBe(DHIKR_PRESETS.length);
    for (const p of DHIKR_PRESETS) {
      expect(Number.isInteger(p.target)).toBe(true);
      expect(p.target).toBeGreaterThan(0);
      expect(p.arabic.length).toBeGreaterThan(0);
    }
  });

  it('the first three form the traditional 33 + 33 + 34 = 100', () => {
    expect(DHIKR_PRESETS.slice(0, 3).map((p) => p.target)).toEqual([33, 33, 34]);
  });

  it('findDhikr falls back to the default for an unknown id', () => {
    expect(findDhikr('nope').id).toBe(DEFAULT_DHIKR_ID);
    expect(findDhikr('astaghfirullah').target).toBe(100);
  });

  it('name keys are namespaced', () => {
    expect(dhikrNameKey('subhanallah')).toBe('tasbeeh.dhikr.subhanallah');
  });
});

describe('applyTap', () => {
  it('counts up and completes exactly at the target, wrapping to 0', () => {
    let c = 0;
    let completions = 0;
    for (let i = 0; i < 33; i++) {
      const r = applyTap(c, 33);
      c = r.count;
      if (r.completed) completions++;
    }
    expect(completions).toBe(1);
    expect(c).toBe(0);
  });

  it('the 33rd tap completes, the 32nd does not', () => {
    expect(applyTap(31, 33)).toEqual({ count: 32, completed: false });
    expect(applyTap(32, 33)).toEqual({ count: 0, completed: true });
  });

  it('100 rapid taps never lose or invent a count (3 full rounds of 33 + 1)', () => {
    let c = 0;
    let rounds = 0;
    for (let i = 0; i < 100; i++) {
      const r = applyTap(c, 33);
      c = r.count;
      if (r.completed) rounds++;
    }
    expect(rounds).toBe(3);
    expect(c).toBe(1);
  });

  it('heals corrupt input instead of overflowing', () => {
    expect(applyTap(999, 33)).toEqual({ count: 0, completed: true });
    expect(applyTap(-5, 33)).toEqual({ count: 1, completed: false });
    expect(applyTap(NaN, 33)).toEqual({ count: 1, completed: false });
    expect(applyTap(3, 0)).toEqual({ count: 0, completed: true }); // degenerate target of 1
  });
});

describe('roundProgress', () => {
  it('is a clamped fraction', () => {
    expect(roundProgress(0, 33)).toBe(0);
    expect(roundProgress(33 / 2, 33)).toBeCloseTo(0.5, 5);
    expect(roundProgress(33, 33)).toBe(1);
    expect(roundProgress(99, 33)).toBe(1);
    expect(roundProgress(-3, 33)).toBe(0);
    expect(roundProgress(5, 0)).toBe(0);
    expect(roundProgress(NaN, 33)).toBe(0);
  });
});

describe('sanitizeSession', () => {
  it('keeps a valid session', () => {
    expect(sanitizeSession({ selected: 'alhamdulillah', counts: { alhamdulillah: 12, subhanallah: 5 } })).toEqual({
      selected: 'alhamdulillah',
      counts: { subhanallah: 5, alhamdulillah: 12, 'allahu-akbar': 0, 'la-ilaha-illallah': 0, astaghfirullah: 0 },
    });
  });

  it('rejects unknown dhikr and out-of-range counts', () => {
    const s = sanitizeSession({ selected: 'bogus', counts: { subhanallah: 33, alhamdulillah: -2, 'allahu-akbar': 'x', astaghfirullah: 99 } });
    expect(s.selected).toBe(DEFAULT_DHIKR_ID);
    expect(s.counts.subhanallah).toBe(0); // == target is not a resting state
    expect(s.counts.alhamdulillah).toBe(0);
    expect(s.counts['allahu-akbar']).toBe(0);
    expect(s.counts.astaghfirullah).toBe(99); // valid for a target of 100
  });

  it('survives garbage of any shape', () => {
    for (const bad of [null, undefined, 42, 'str', [], { counts: 7 }]) {
      const s = sanitizeSession(bad);
      expect(s.selected).toBe(DEFAULT_DHIKR_ID);
      expect(Object.keys(s.counts)).toHaveLength(DHIKR_PRESETS.length);
    }
  });
});

describe('TasbeehStorage session', () => {
  it('round-trips the selected dhikr and the in-progress round', async () => {
    await TasbeehStorage.saveSession({ selected: 'la-ilaha-illallah', counts: { 'la-ilaha-illallah': 61, subhanallah: 7 } });
    const s = await TasbeehStorage.loadSession();
    expect(s.selected).toBe('la-ilaha-illallah');
    expect(s.counts['la-ilaha-illallah']).toBe(61);
    expect(s.counts.subhanallah).toBe(7);
  });

  it('a fresh install loads a clean default session', async () => {
    const s = await TasbeehStorage.loadSession();
    expect(s.selected).toBe(DEFAULT_DHIKR_ID);
    expect(Object.values(s.counts).every((n) => n === 0)).toBe(true);
  });

  it('corrupt stored JSON loads the default instead of throwing', async () => {
    await AsyncStorage.setItem('@tasbeeh_session_v1', '{not json');
    const s = await TasbeehStorage.loadSession();
    expect(s.selected).toBe(DEFAULT_DHIKR_ID);
  });

  it('does not disturb the existing lifetime totals', async () => {
    await TasbeehStorage.saveTotals({ subhanallah: { taps: 500, rounds: 15, updatedAt: 1 } });
    await TasbeehStorage.saveSession({ selected: 'subhanallah', counts: { subhanallah: 3 } });
    const totals = await TasbeehStorage.loadTotals();
    expect(totals.subhanallah.taps).toBe(500);
    expect(totals.subhanallah.rounds).toBe(15);
  });
});
