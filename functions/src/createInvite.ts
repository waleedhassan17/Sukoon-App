/**
 * Callable: createInvite — issue a fresh invite code for the caller.
 *
 * Why callable instead of letting the client write directly:
 *   - Need to revoke prior active invites atomically.
 *   - Need collision-checked code generation (5 retries).
 *   - Lets us record the code on the user's profile (`inviteCode`) so the UI can
 *     render the active code without a separate query.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import { createInviteForUser } from './inviteCode';

export const createInvite = onCall(
  { memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const code = await createInviteForUser(uid);

    // Mirror onto the user doc so client can render their current code without
    // querying the invites collection.
    await db.collection('users').doc(uid).set({ inviteCode: code }, { merge: true });

    return { code };
  },
);
