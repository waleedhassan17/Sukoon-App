/**
 * Firestore trigger: prayers/{uid}/days/{date} onWrite.
 *
 * Two responsibilities:
 *   1. Recompute prayerCount + completedAt server-side. The client may write whatever
 *      it wants — we authoritatively overwrite. This blocks clock-tampering and ensures
 *      the streak engine downstream always sees a clean source of truth.
 *   2. When prayerCount transitions to 5 for the first time on this date, fan out to
 *      every active friendship of `uid` and call recomputePairStreak.
 *
 * Idempotency: the recompute helper itself is idempotent (no-op if lastStreakDate ==
 * candidateDate), so retries from the runtime are safe.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db, FieldValue, Timestamp } from './admin';
import { computePrayerCount } from './streakMath';
import { recomputePairStreak } from './recomputePairStreak';
import { isValidDateKey } from './dates';

export const onPrayerWrite = onDocumentWritten(
  {
    document: 'prayers/{uid}/days/{date}',
    // Light memory footprint — this trigger does at most one write + N friendship lookups.
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    const { uid, date } = event.params as { uid: string; date: string };
    if (!isValidDateKey(date)) {
      console.warn(`[onPrayerWrite] invalid date key ${date}, skipping`);
      return;
    }

    const after = event.data?.after;
    if (!after?.exists) return; // deletion — no fanout

    const data = after.data() ?? {};
    const newCount = computePrayerCount(data);
    const oldCount = computePrayerCount(event.data?.before?.data() ?? {});

    // Recompute server-managed fields if they're stale or missing.
    const desiredCompletedAt = newCount === 5
      ? (data.completedAt ?? Timestamp.now())
      : null;

    const needsPatch =
      data.prayerCount !== newCount
      || (newCount === 5 && !data.completedAt)
      || (newCount < 5 && data.completedAt !== null && data.completedAt !== undefined);

    if (needsPatch) {
      // Use update() not set() to avoid recursing into onWrite forever; we only patch
      // server-managed fields. The trigger fires again, but the second pass is a no-op
      // because needsPatch is now false.
      await after.ref.update({
        prayerCount: newCount,
        completedAt: desiredCompletedAt,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Fan out only on the rising edge to 5. If we're going from 5 → 4 (user un-marked
    // a prayer), the scheduled sweep will catch the broken streak — no need to do
    // a synchronous decrement here, which keeps this trigger fast and predictable.
    if (newCount === 5 && oldCount < 5) {
      await fanOutToFriendships(uid, date);
    }
  },
);

async function fanOutToFriendships(uid: string, date: string): Promise<void> {
  const friendships = await db.collection('friendships')
    .where('users', 'array-contains', uid)
    .where('status', '==', 'active')
    .get();

  if (friendships.empty) return;

  // Process sequentially-ish: small N (≤ a few hundred friends), and Firestore
  // transactions inside recomputePairStreak need to retry on contention without
  // a thundering herd.
  await Promise.all(
    friendships.docs.map(doc =>
      recomputePairStreak(doc.id, uid, date).catch(err => {
        console.error(`[onPrayerWrite] pair recompute failed pair=${doc.id}:`, err);
      })
    ),
  );
}
