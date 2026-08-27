/**
 * Callable: acceptInvite — turn an invite code into an active friendship.
 *
 * Hard rules (spec):
 *   - Recipient cannot be the inviter (no self-friending).
 *   - Code must be active and unexpired.
 *   - Idempotent under retry: if the friendship already exists active, return success.
 *   - If a removed friendship exists between the pair, re-activate it (preserve longest-streak).
 *   - If a blocked friendship exists, refuse (the blocker controls re-friending).
 *
 * MULTI-USE: the invite is never consumed. The same code can be accepted by many
 * different friends; each acceptance just creates that recipient's own pair with
 * the inviter. We only touch the invite to mark a genuinely-expired one as expired.
 *
 * Transaction: read invite → read friendship → write friendship. All-or-nothing.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, Timestamp } from './admin';
import { dispatchNotification } from './notifications';
import { pairIdOf } from './streakMath';
import { FriendshipDoc, InviteDoc } from './types';

export const acceptInvite = onCall(
  { memory: '256MiB' },
  async (request) => {
    const recipientUid = request.auth?.uid;
    if (!recipientUid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const code = String(request.data?.code ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Invite code must be 6 characters.');
    }

    const inviteRef = db.collection('invites').doc(code);

    const result = await db.runTransaction(async tx => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new HttpsError('not-found', 'INVITE_NOT_FOUND');
      }
      const invite = inviteSnap.data() as InviteDoc;

      if (invite.status !== 'active') {
        throw new HttpsError('failed-precondition', `INVITE_${invite.status.toUpperCase()}`);
      }
      if (invite.expiresAt.toMillis() < Date.now()) {
        tx.update(inviteRef, { status: 'expired' });
        throw new HttpsError('failed-precondition', 'INVITE_EXPIRED');
      }
      if (invite.fromUid === recipientUid) {
        throw new HttpsError('failed-precondition', 'INVITE_SELF');
      }

      const inviterUid = invite.fromUid;
      const pairId = pairIdOf(inviterUid, recipientUid);
      const friendshipRef = db.collection('friendships').doc(pairId);
      const friendshipSnap = await tx.get(friendshipRef);

      const usersSorted: [string, string] = inviterUid < recipientUid
        ? [inviterUid, recipientUid]
        : [recipientUid, inviterUid];

      if (friendshipSnap.exists) {
        const existing = friendshipSnap.data() as FriendshipDoc;
        if (existing.status === 'active') {
          // Idempotent: already friends. Multi-use invite stays active.
          return { pairId, alreadyFriends: true, inviterUid };
        }
        if (existing.status === 'blocked') {
          throw new HttpsError('permission-denied', 'BLOCKED');
        }
        // status === 'removed' → reactivate; keep longestStreak history.
        tx.update(friendshipRef, {
          status: 'active',
          acceptedAt: Timestamp.now(),
          currentStreak: 0,
          lastStreakDate: null,
          milestonesAchieved: [],
          removedBy: FieldValue.delete(),
          lastUpdatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const newDoc: Omit<FriendshipDoc, 'createdAt'> & {
          createdAt: FirebaseFirestore.FieldValue;
        } = {
          users: usersSorted,
          status: 'active',
          initiatedBy: inviterUid,
          acceptedAt: Timestamp.now(),
          currentStreak: 0,
          longestStreak: 0,
          lastStreakDate: null,
          milestonesAchieved: [],
          createdAt: FieldValue.serverTimestamp(),
        };
        tx.set(friendshipRef, newDoc);
      }

      // Multi-use: invite is intentionally left active so others can still accept it.
      return { pairId, alreadyFriends: false, inviterUid };
    });

    // Out-of-transaction: notify the inviter that someone accepted.
    if (!result.alreadyFriends) {
      await dispatchNotification({
        uid: result.inviterUid,
        type: 'invite_accepted',
        title: '🤝 Friend joined!',
        body: 'Your invite was accepted. Pray together and watch the streak grow.',
        payload: { pairId: result.pairId, byUid: recipientUid },
      }).catch(err => console.warn('[acceptInvite] notify failed:', err));
    }

    return { pairId: result.pairId, alreadyFriends: result.alreadyFriends };
  },
);
