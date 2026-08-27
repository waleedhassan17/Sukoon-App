/**
 * recomputePairStreak — the heart of the friend-streak engine.
 *
 * Called when one user (`triggeringUid`) has just completed all 5 prayers on
 * `triggeringDate` (their local date). We check whether the partner has the same
 * SDC on the same date string — and if so, advance / start the pair streak.
 *
 * Wrapped in a Firestore transaction so two simultaneous 5th-prayer writes (one
 * from each friend) cannot double-increment.
 *
 * NB on cross-timezone pairs: the spec says "the shared streak only advances after
 * the LATER of the two has completed their local day." Using the date-string
 * convention captures this: each user writes their own local date as the doc id,
 * and only when both have the same date-string with prayerCount=5 does the streak
 * advance.
 *
 * Edge case: if user A is in PKT and user B in EST, A's "Tuesday" and B's "Tuesday"
 * overlap only partially in real time — but as date strings they're identical.
 * The pair streak counts whichever Tuesday they both completed. This matches the
 * intent: a shared *day*, not a shared *moment*.
 */

import { db, FieldValue } from './admin';
import { applySharedDayComplete } from './streakMath';
import { dispatchNotification } from './notifications';
import { FriendshipDoc } from './types';

export async function recomputePairStreak(
  pairId: string,
  triggeringUid: string,
  triggeringDate: string,
): Promise<void> {
  const friendshipRef = db.collection('friendships').doc(pairId);

  // Read the partner's day doc OUTSIDE the transaction. Doing it inside would
  // cross collection boundaries needlessly; partner data only matters as a gate,
  // not as a source of contention.
  const friendshipSnap = await friendshipRef.get();
  if (!friendshipSnap.exists) return;
  const friendship = friendshipSnap.data() as FriendshipDoc;
  if (friendship.status !== 'active') return;

  const partnerUid = friendship.users.find(u => u !== triggeringUid);
  if (!partnerUid) {
    console.warn(`[recomputePairStreak] pair ${pairId} has no partner for ${triggeringUid}`);
    return;
  }

  const partnerDay = await db
    .collection('prayers').doc(partnerUid)
    .collection('days').doc(triggeringDate)
    .get();

  if (!partnerDay.exists) return;
  if ((partnerDay.get('prayerCount') as number | undefined) !== 5) return;

  // Now apply the streak transition transactionally so concurrent writers serialize.
  const result = await db.runTransaction(async tx => {
    const fresh = await tx.get(friendshipRef);
    if (!fresh.exists) return null;
    const cur = fresh.data() as FriendshipDoc;
    if (cur.status !== 'active') return null;

    const next = applySharedDayComplete({
      currentStreak: cur.currentStreak ?? 0,
      longestStreak: cur.longestStreak ?? 0,
      lastStreakDate: cur.lastStreakDate ?? null,
      milestonesAchieved: cur.milestonesAchieved ?? [],
      candidateDate: triggeringDate,
    });

    if (!next.advanced) return null;

    tx.update(friendshipRef, {
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastStreakDate: next.lastStreakDate,
      milestonesAchieved: next.milestonesAchieved,
      lastUpdatedAt: FieldValue.serverTimestamp(),
    });

    return { next, users: cur.users };
  });

  if (!result) return;

  // Notification dispatch lives outside the transaction — pushes are best-effort
  // and we never want to roll back a successful streak write because FCM hiccupped.
  for (const milestone of result.next.newMilestones) {
    await Promise.all(result.users.map(uid =>
      dispatchNotification({
        uid,
        type: 'streak_milestone',
        title: '✨ Streak milestone!',
        body: `${milestone}-day shared streak with your Salah buddy. Alhamdulillah.`,
        payload: {
          pairId,
          milestone,
          currentStreak: result.next.currentStreak,
        },
      }).catch(err => console.warn('[recomputePairStreak] notify failed:', err))
    ));
  }
}
