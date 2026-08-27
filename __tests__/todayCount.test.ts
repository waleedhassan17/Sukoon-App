/**
 * ACCEPTANCE 2 — the header "X/5 today".
 *
 * This existed as a bug: salah-friends.tsx took the count from entries[0] of the
 * friends list, so it read 0/5 for anyone with no friends — exactly the users the
 * screen is trying to convert. It now reads the local tracker instead, which also
 * makes it correct offline and in Expo Go where Firestore is unavailable.
 *
 * Reading AsyncStorage directly is what lets this be verified without a device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { readTodaySelfCount, deviceTodayKey } from '../lib/salah/todayCount';
import { countLocalPrayers, toCanonicalKey, toLocalKey } from '../lib/salah/prayerKeys';

const key = (d: string) => `sukoon_salah_${d}`;

beforeEach(async () => { await AsyncStorage.clear(); });

describe('readTodaySelfCount', () => {
  const today = deviceTodayKey();

  test('returns 0 when nothing has been logged', async () => {
    expect(await readTodaySelfCount()).toBe(0);
  });

  test('counts prayers logged today — the zero-friends case', async () => {
    // The exact shape app/tools/salah-tracker.tsx writes.
    await AsyncStorage.setItem(key(today), JSON.stringify({
      fajr: 'prayed', zuhr: 'jamaah', asr: 'qasr',
      maghrib: 'none', isha: 'none', updatedAt: Date.now(),
    }));
    // No friends exist, no Firestore involved — must still read 3.
    expect(await readTodaySelfCount()).toBe(3);
  });

  test('counts a fully completed day', async () => {
    await AsyncStorage.setItem(key(today), JSON.stringify({
      fajr: 'prayed', zuhr: 'prayed', asr: 'prayed',
      maghrib: 'prayed', isha: 'prayed',
    }));
    expect(await readTodaySelfCount()).toBe(5);
  });

  test('does not count missed or unlogged prayers', async () => {
    await AsyncStorage.setItem(key(today), JSON.stringify({
      fajr: 'missed', zuhr: 'none', asr: 'missed',
      maghrib: 'prayed', isha: 'none',
    }));
    expect(await readTodaySelfCount()).toBe(1);
  });

  test('reads the legacy {data, updatedAt} wrapper an older build wrote', async () => {
    await AsyncStorage.setItem(key(today), JSON.stringify({
      data: { fajr: 'prayed', zuhr: 'prayed', asr: 'none', maghrib: 'none', isha: 'none' },
      updatedAt: Date.now(),
    }));
    expect(await readTodaySelfCount()).toBe(2);
  });

  test('returns 0 rather than throwing on corrupt storage', async () => {
    // A header count is never worth an error state.
    await AsyncStorage.setItem(key(today), 'not json{{');
    expect(await readTodaySelfCount()).toBe(0);
  });

  test('does not leak yesterday\'s count into today', async () => {
    await AsyncStorage.setItem(key('2020-01-01'), JSON.stringify({
      fajr: 'prayed', zuhr: 'prayed', asr: 'prayed', maghrib: 'prayed', isha: 'prayed',
    }));
    expect(await readTodaySelfCount()).toBe(0);
    expect(await readTodaySelfCount('2020-01-01')).toBe(5);
  });
});

describe('deviceTodayKey', () => {
  test('formats as YYYY-MM-DD, matching the tracker\'s storage keys', () => {
    expect(deviceTodayKey(new Date(2025, 2, 5))).toBe('2025-03-05');
    expect(deviceTodayKey(new Date(2025, 11, 31))).toBe('2025-12-31');
  });
});

describe('prayer key vocabulary', () => {
  test('maps the local zuhr key to the canonical dhuhr used in Firestore', () => {
    // The mapping that used to live only as an inline comment in dataSyncService.
    expect(toCanonicalKey('zuhr')).toBe('dhuhr');
    expect(toLocalKey('dhuhr')).toBe('zuhr');
    expect(toCanonicalKey('fajr')).toBe('fajr');
  });

  test('countLocalPrayers agrees with readTodaySelfCount', () => {
    const day = { fajr: 'prayed', zuhr: 'jamaah', asr: 'qasr', maghrib: 'missed', isha: 'none' };
    expect(countLocalPrayers(day)).toBe(3);
    expect(countLocalPrayers(null)).toBe(0);
    expect(countLocalPrayers({})).toBe(0);
  });
});
