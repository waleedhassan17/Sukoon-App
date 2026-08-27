/**
 * Canonical prayer-key vocabulary.
 *
 * Three spellings of the second prayer coexist in this codebase for historical
 * reasons, and conflating them silently produces a day that looks incomplete:
 *
 *   'zuhr'   — the LOCAL tracker's key (AsyncStorage `sukoon_salah_YYYY-MM-DD`,
 *              app/tools/salah-tracker.tsx). Predates the Salah Buddy feature.
 *   'dhuhr'  — the CANONICAL key in Firestore (`prayers/{uid}/days/*`),
 *              firestore.rules and functions/src/types.ts.
 *   'Dhuhr'  — what the Aladhan prayer-times API returns (lib/prayerTimes.ts).
 *
 * This module is the single place the local→canonical mapping lives. It used to
 * exist only as an inline comment inside dataSyncService's mirror function, which
 * meant any new reader of the Firestore day documents had to rediscover it.
 */

/** Prayer keys as stored by the local tracker and AsyncStorage. */
export type LocalPrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha';

/** Prayer keys as stored in Firestore. Matches functions/src/types.ts PrayerKey. */
export type CanonicalPrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export const LOCAL_PRAYER_KEYS: readonly LocalPrayerKey[] = [
  'fajr', 'zuhr', 'asr', 'maghrib', 'isha',
] as const;

export const CANONICAL_PRAYER_KEYS: readonly CanonicalPrayerKey[] = [
  'fajr', 'dhuhr', 'asr', 'maghrib', 'isha',
] as const;

const LOCAL_TO_CANONICAL: Record<LocalPrayerKey, CanonicalPrayerKey> = {
  fajr: 'fajr',
  zuhr: 'dhuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

const CANONICAL_TO_LOCAL: Record<CanonicalPrayerKey, LocalPrayerKey> = {
  fajr: 'fajr',
  dhuhr: 'zuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

/** Local tracker key → the key used in Firestore. */
export function toCanonicalKey(key: LocalPrayerKey): CanonicalPrayerKey {
  return LOCAL_TO_CANONICAL[key];
}

/** Firestore key → the key used by the local tracker. */
export function toLocalKey(key: CanonicalPrayerKey): LocalPrayerKey {
  return CANONICAL_TO_LOCAL[key];
}

/**
 * Local tracker statuses that count as "prayed".
 * 'missed' and 'none' do not count; 'qasr' (shortened while travelling) and
 * 'jamaah' (in congregation) both do.
 */
const LOGGED_STATUSES = new Set(['prayed', 'jamaah', 'qasr']);

export function isLoggedStatus(status: unknown): boolean {
  return typeof status === 'string' && LOGGED_STATUSES.has(status);
}

/**
 * Count completed prayers in a LOCAL tracker day record.
 * Mirrors countDone() in app/tools/salah-tracker.tsx and, after the key mapping,
 * computePrayerCount() in ./streakMath.ts.
 */
export function countLocalPrayers(day: Record<string, unknown> | null | undefined): number {
  if (!day) return 0;
  let n = 0;
  for (const k of LOCAL_PRAYER_KEYS) {
    if (isLoggedStatus(day[k])) n++;
  }
  return n;
}
