/**
 * The user's own "X/5 today", read from the LOCAL tracker.
 *
 * The friends header used to take this from the first friend entry, on the
 * reasoning that todayCountSelf is identical across entries. It is — but with zero
 * friends there are no entries, so the header showed 0/5 to exactly the people the
 * screen is trying to convert, no matter how many prayers they had logged.
 *
 * Reading AsyncStorage instead makes the count correct with no friends, correct
 * offline, and correct in Expo Go where Firestore is unavailable entirely. The
 * local tracker is the source of truth for the user's own prayers; Firestore is a
 * mirror of it (see dataSyncService._mirrorToFriendsSchema).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { countLocalPrayers } from './prayerKeys';

/** AsyncStorage key format used by app/tools/salah-tracker.tsx. */
function storageKey(dateKey: string): string {
  return `sukoon_salah_${dateKey}`;
}

/** Device-local YYYY-MM-DD, matching how the tracker keys its records. */
export function deviceTodayKey(now = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Prayers logged today, 0–5. Returns 0 rather than throwing on unreadable or
 * malformed storage — a header count is never worth an error state.
 */
export async function readTodaySelfCount(dateKey = deviceTodayKey()): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(dateKey));
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    // Records are usually flat ({fajr, zuhr, …}), but an older DataSyncService.saveLocal
    // wrapped them as {data, updatedAt}. Tolerate both, as the tracker does.
    const day = parsed && typeof parsed === 'object' && parsed.data ? parsed.data : parsed;
    return countLocalPrayers(day);
  } catch {
    return 0;
  }
}
