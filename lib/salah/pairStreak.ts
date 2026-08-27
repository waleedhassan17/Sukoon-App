/**
 * The shared-streak engine.
 *
 * On the Blaze plan this work would be the `onPrayerWrite` Firestore trigger plus
 * the hourly `streakSweep` job (both still in functions/, dormant). The project is
 * on Spark, so it runs here instead — and firestore.rules independently re-derives
 * every transition before accepting it, which is what keeps a client from simply
 * writing whatever streak it likes.
 *
 * THE RULE, stated once (mirrored in firestore.rules and SALAH_BUDDY.md):
 *
 *   A day D counts for a pair when BOTH members have prayers/{uid}/days/D with
 *   prayerCount == 5, where each member writes D as their OWN local date.
 *
 * Two friends in different timezones therefore compare date STRINGS, never
 * instants — a shared *day*, not a shared *moment*. Karachi's Tuesday and New
 * York's Tuesday overlap only partially in real time, but they are the same key,
 * so both devices converge on the same streak value.
 *
 * Concurrency: both members' devices race to record the same completed day. Each
 * transition runs in a Firestore transaction, and applySharedDayComplete() is a
 * no-op when lastStreakDate already equals the candidate date, so the loser of the
 * race changes nothing. Replays are safe for the same reason.
 */

import { getFirestore, authReady } from '../firebaseConfig';
import { UserProfileService } from '../userProfileService';
import { localDateKey } from './dates';
import { applySharedDayComplete, shouldBreakStreak } from './streakMath';

/** Shape we need from a friendship document to evaluate its streak. */
interface PairState {
  pairId: string;
  users: [string, string];
  /** The signed-in user; the other element of `users` is the partner. */
  selfUid: string;
  status: string;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  milestonesAchieved: number[];
}

export interface SyncOutcome {
  /** Pairs whose streak advanced during this run. */
  advanced: string[];
  /** Pairs recorded as broken during this run. */
  broken: string[];
  /** Milestones unlocked, keyed by pairId. Drives the celebration UI. */
  milestones: Record<string, number[]>;
}

const EMPTY_OUTCOME: SyncOutcome = { advanced: [], broken: [], milestones: {} };

/** Read a user's prayerCount for a date. Missing document or denied read → 0. */
async function readPrayerCount(db: any, uid: string, dateKey: string): Promise<number> {
  const snap = await db.collection('prayers').doc(uid).collection('days').doc(dateKey).get();
  if (!snap.exists) return 0;
  return Number(snap.get('prayerCount') ?? 0);
}

/** Resolve a user's local date key from their stored IANA timezone. */
async function localTodayFor(db: any, uid: string, now: Date): Promise<string> {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const tz = snap.exists ? (snap.get('timezone') as string | undefined) : undefined;
    return localDateKey(now, tz && tz.length > 0 ? tz : 'UTC');
  } catch {
    // A partner profile we cannot read shouldn't stall the whole sync.
    return localDateKey(now, 'UTC');
  }
}

/**
 * Advance the streak for one pair if the candidate date is now complete for both.
 * Returns the milestones unlocked, or null if nothing changed.
 */
async function tryAdvance(
  db: any,
  pair: PairState,
  candidateDate: string,
): Promise<number[] | null> {
  // Cheap gate before opening a transaction: already counted today.
  if (pair.lastStreakDate === candidateDate) return null;

  const partnerUid = pair.users.find(u => u !== pair.selfUid) ?? pair.users[1];
  const partnerCount = await readPrayerCount(db, partnerUid, candidateDate);
  if (partnerCount !== 5) return null;

  const ref = db.collection('friendships').doc(pair.pairId);

  return db.runTransaction(async (tx: any) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return null;
    const d = fresh.data() ?? {};
    if (d.status !== 'active') return null;

    const next = applySharedDayComplete({
      currentStreak: d.currentStreak ?? 0,
      longestStreak: d.longestStreak ?? 0,
      lastStreakDate: d.lastStreakDate ?? null,
      milestonesAchieved: Array.isArray(d.milestonesAchieved) ? d.milestonesAchieved : [],
      candidateDate,
    });

    // The other device won the race between our gate and this transaction.
    if (!next.advanced) return null;

    tx.update(ref, {
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastStreakDate: next.lastStreakDate,
      milestonesAchieved: next.milestonesAchieved,
      lastUpdatedAt: Date.now(),
    });

    return next.newMilestones;
  });
}

/**
 * Record a break when a whole day has passed with no shared completion.
 * Returns true if this call was the one that recorded it.
 */
async function tryBreak(db: any, pair: PairState, slowerToday: string): Promise<boolean> {
  if (pair.currentStreak <= 0) return false;
  if (!shouldBreakStreak(pair.lastStreakDate, slowerToday)) return false;

  const ref = db.collection('friendships').doc(pair.pairId);

  return db.runTransaction(async (tx: any) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return false;
    const d = fresh.data() ?? {};
    if (d.status !== 'active') return false;

    // Re-check inside the transaction — the partner may have completed the day, or
    // the other device may have already recorded this break.
    const streak = d.currentStreak ?? 0;
    if (streak <= 0) return false;
    if (!shouldBreakStreak(d.lastStreakDate ?? null, slowerToday)) return false;

    tx.update(ref, {
      currentStreak: 0,
      lastBrokenAt: Date.now(),
      lastBrokenStreak: streak,
      lastUpdatedAt: Date.now(),
    });
    return true;
  });
}

export const PairStreakEngine = {
  /**
   * Evaluate every active friendship for the signed-in user and commit any streak
   * advances or breaks that are now due.
   *
   * Call after logging a prayer and when the Friends screen gains focus. Safe to
   * call repeatedly — every transition is idempotent.
   *
   * Never throws: a failure to sync a streak must not break the tracker, which is
   * the part of the app that works offline and matters most.
   */
  async sync(): Promise<SyncOutcome> {
    try {
      const uid = await authReady();
      const db = await getFirestore();
      if (!uid || !db) return EMPTY_OUTCOME;

      const snap = await db.collection('friendships')
        .where('users', 'array-contains', uid)
        .where('status', '==', 'active')
        .get();

      if (snap.empty) return EMPTY_OUTCOME;

      const now = new Date();
      const profile = await UserProfileService.ensureProfile();
      const selfToday = localDateKey(now, profile?.timezone ?? 'UTC');
      const selfCount = await readPrayerCount(db, uid, selfToday);

      const outcome: SyncOutcome = { advanced: [], broken: [], milestones: {} };

      // Partner timezones are read once per run rather than per pair-per-day.
      const partnerToday = new Map<string, string>();

      for (const doc of snap.docs) {
        const d = doc.data() ?? {};
        const users = d.users as [string, string];
        if (!Array.isArray(users) || users.length !== 2) continue;
        const partnerUid = users.find(u => u !== uid);
        if (!partnerUid) continue;

        const pair: PairState = {
          pairId: doc.id,
          users,
          status: d.status,
          currentStreak: d.currentStreak ?? 0,
          longestStreak: d.longestStreak ?? 0,
          lastStreakDate: d.lastStreakDate ?? null,
          milestonesAchieved: Array.isArray(d.milestonesAchieved) ? d.milestonesAchieved : [],
          selfUid: uid,
        };

        try {
          // Advance: only worth attempting once our own day is complete.
          if (selfCount === 5) {
            const unlocked = await tryAdvance(db, pair, selfToday);
            if (unlocked) {
              outcome.advanced.push(pair.pairId);
              if (unlocked.length > 0) outcome.milestones[pair.pairId] = unlocked;
              continue; // advanced today — nothing to break
            }
          }

          // Break: judged against whichever member is further behind, so a partner
          // who still has hours left in their local day keeps the streak alive.
          if (!partnerToday.has(partnerUid)) {
            partnerToday.set(partnerUid, await localTodayFor(db, partnerUid, now));
          }
          const theirToday = partnerToday.get(partnerUid)!;
          const slowerToday = selfToday < theirToday ? selfToday : theirToday;

          if (await tryBreak(db, pair, slowerToday)) {
            outcome.broken.push(pair.pairId);
          }
        } catch (err) {
          // One bad pair (denied read, contention, partner mid-write) must not
          // abort the others.
          if (__DEV__) console.warn(`[PairStreak] pair ${pair.pairId} failed:`, err);
        }
      }

      return outcome;
    } catch (err) {
      if (__DEV__) console.warn('[PairStreak] sync failed:', err);
      return EMPTY_OUTCOME;
    }
  },
};

export default PairStreakEngine;
