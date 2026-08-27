/**
 * Callable: blockFriend — set status='blocked', blockedBy=caller.
 *
 * Privacy guarantee (spec): the blocked user must not learn they were blocked.
 * firestore.rules enforces this — when status='blocked', only the blocker can
 * read the friendship document; the blocked user simply sees the friend vanish.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, Timestamp } from './admin';
import { pairIdOf } from './streakMath';
import { FriendshipDoc } from './types';

export const blockFriend = onCall(
  { memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const otherUid = String(request.data?.otherUid ?? '').trim();
    if (!otherUid || otherUid === uid) {
      throw new HttpsError('invalid-argument', 'Invalid otherUid.');
    }

    const pairId = pairIdOf(uid, otherUid);
    const ref = db.collection('friendships').doc(pairId);

    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const usersSorted: [string, string] = uid < otherUid ? [uid, otherUid] : [otherUid, uid];

      if (!snap.exists) {
        // Create a tombstone so future invites between this pair are blocked.
        tx.set(ref, {
          users: usersSorted,
          status: 'blocked',
          blockedBy: uid,
          initiatedBy: uid,
          acceptedAt: null,
          currentStreak: 0,
          longestStreak: 0,
          lastStreakDate: null,
          milestonesAchieved: [],
          createdAt: Timestamp.now(),
          lastUpdatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const f = snap.data() as FriendshipDoc;
      if (!f.users.includes(uid)) throw new HttpsError('permission-denied', 'NOT_PARTICIPANT');

      tx.update(ref, {
        status: 'blocked',
        blockedBy: uid,
        currentStreak: 0,
        lastStreakDate: null,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true };
  },
);
