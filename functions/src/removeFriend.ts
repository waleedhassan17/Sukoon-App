/**
 * Callable: removeFriend — soft-delete a friendship (status='removed').
 *
 * Either side can remove. The streak goes to 0 (cannot be rebuilt across a
 * 'removed' boundary; longestStreak is preserved as a memorial).
 *
 * Status='removed' is invisible to both via firestore.rules — the client just
 * sees the friendship disappear from their list.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from './admin';
import { pairIdOf } from './streakMath';
import { FriendshipDoc } from './types';

export const removeFriend = onCall(
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
      if (!snap.exists) throw new HttpsError('not-found', 'NOT_FRIENDS');
      const f = snap.data() as FriendshipDoc;
      if (!f.users.includes(uid)) throw new HttpsError('permission-denied', 'NOT_PARTICIPANT');
      if (f.status === 'blocked') {
        throw new HttpsError('failed-precondition', 'ALREADY_BLOCKED');
      }
      tx.update(ref, {
        status: 'removed',
        removedBy: uid,
        currentStreak: 0,
        lastStreakDate: null,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true };
  },
);
