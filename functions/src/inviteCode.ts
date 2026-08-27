/**
 * Invite code generator — collision-checked, server-side only.
 *
 * Charset: Crockford-style base32 minus look-alikes (no I/L/O/U/0/1).
 * 6 chars × 28 alphabet ≈ 481M codes — vanishingly small collision risk at expected scale,
 * but we still verify uniqueness against `invites/{code}` and retry up to MAX_TRIES.
 */

import { db, FieldValue, Timestamp } from './admin';
import { INVITE_TTL_MS, InviteDoc } from './types';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LEN = 6;
const MAX_TRIES = 5;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Create a fresh invite for `fromUid`. Revokes any prior active invite by the same user
 * so the displayed code in the app always matches the live one (spec: "Regenerate code
 * (revokes the previous one)").
 *
 * Returns the new code. Throws if collision-free generation fails after MAX_TRIES (which
 * in practice means Firestore is unavailable, not that the keyspace was exhausted).
 */
export async function createInviteForUser(fromUid: string): Promise<string> {
  // Revoke any existing active invites by this user (best-effort; safe to fail).
  try {
    const stale = await db.collection('invites')
      .where('fromUid', '==', fromUid)
      .where('status', '==', 'active')
      .get();
    if (!stale.empty) {
      const batch = db.batch();
      stale.docs.forEach(d => batch.update(d.ref, { status: 'revoked' }));
      await batch.commit();
    }
  } catch {
    // Non-fatal: an orphaned active invite is harmless because acceptInvite re-validates.
  }

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const code = randomCode();
    const ref = db.collection('invites').doc(code);

    // create() throws ALREADY_EXISTS on collision — atomic vs another writer with the same code.
    try {
      const now = Timestamp.now();
      const doc: Omit<InviteDoc, 'createdAt' | 'expiresAt'> & {
        createdAt: FirebaseFirestore.FieldValue;
        expiresAt: FirebaseFirestore.Timestamp;
      } = {
        code,
        fromUid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now.toMillis() + INVITE_TTL_MS),
        usedByUid: null,
        status: 'active',
      };
      await ref.create(doc);
      return code;
    } catch (err: unknown) {
      const code = (err as { code?: number | string } | null)?.code;
      // ALREADY_EXISTS = 6 (gRPC) or 'already-exists' (firestore). Anything else is fatal.
      if (code === 6 || code === 'already-exists') continue;
      throw err;
    }
  }
  throw new Error('Failed to generate a unique invite code after multiple attempts');
}
