/**
 * InviteService — the invite lifecycle: mint a code, resolve one, accept it.
 *
 * WHY THIS IS CLIENT-SIDE. The Firebase project is on the Spark plan, so the
 * callables in functions/ (createInvite / acceptInvite) cannot be deployed. Rather
 * than the previous arrangement — try the callable, and on failure fall through a
 * chain of increasingly desperate fallbacks, the last of which invented a code that
 * was never written to Firestore and produced a permanently dead share link — this
 * module is the single, honest path. It writes directly, and firestore.rules
 * validates every write:
 *
 *   • invites: fromUid must equal the caller, the code must match the doc id, and
 *     the expiry must be within bounds.
 *   • friendships: creation requires `viaInvite` to name a LIVE invite issued by the
 *     other member, so nobody can befriend a stranger and read their prayer history.
 *
 * When the project moves to Blaze, swap these bodies for FirebaseFunctions calls and
 * change the corresponding rules to `if false`. See SALAH_BUDDY.md.
 */

import { getFirestore, isFirebaseConfigured, authReady } from './firebaseConfig';
import { pairIdOf } from './salah/streakMath';

/** Crockford-style base32 minus look-alikes (no I/L/O/U/0/1). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LEN = 6;
const MAX_TRIES = 5;

/** One year, matching INVITE_TTL_MS in functions/src/types.ts. */
export const INVITE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const INVITE_CODE_RE = /^[A-Z0-9]{6}$/;

export type InviteFailure =
  | 'INVITE_NOT_FOUND'
  | 'INVITE_EXPIRED'
  | 'INVITE_REVOKED'
  | 'INVITE_SELF'
  | 'BLOCKED'
  | 'UNAVAILABLE';

export class InviteError extends Error {
  constructor(public readonly reason: InviteFailure, message?: string) {
    super(message ?? reason);
    this.name = 'InviteError';
  }
}

export interface ResolvedInvite {
  code: string;
  fromUid: string;
}

export interface AcceptResult {
  pairId: string;
  alreadyFriends: boolean;
}

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Normalize expiry across the epoch-millis convention and legacy Timestamp/Date values. */
function expiryMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const InviteService = {
  /**
   * Mint a fresh invite code for the caller, revoking any previous active one so the
   * displayed code always matches the live link.
   *
   * Collision handling uses a create-if-absent write rather than a blind set: the old
   * code called `.set()`, which on a collision would silently overwrite a different
   * user's invite. Under the current rules that write is rejected instead, and we
   * simply try another code.
   */
  async createInvite(): Promise<string> {
    if (!isFirebaseConfigured()) throw new InviteError('UNAVAILABLE');
    const uid = await authReady();
    const db = await getFirestore();
    if (!uid || !db) throw new InviteError('UNAVAILABLE');

    // Revoke prior active codes. Best-effort: an orphaned active invite is harmless
    // because acceptInvite re-validates, and failing here shouldn't block a new code.
    try {
      const stale = await db.collection('invites')
        .where('fromUid', '==', uid)
        .where('status', '==', 'active')
        .get();
      if (!stale.empty) {
        const batch = db.batch();
        stale.docs.forEach((d: any) => batch.update(d.ref, { status: 'revoked' }));
        await batch.commit();
      }
    } catch (err) {
      if (__DEV__) console.warn('[InviteService] revoking stale invites failed:', err);
    }

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const code = randomCode();
      const ref = db.collection('invites').doc(code);
      try {
        const existing = await ref.get();
        if (existing.exists) continue;

        const now = Date.now();
        await ref.set({
          code,
          fromUid: uid,
          createdAt: now,
          expiresAt: now + INVITE_TTL_MS,
          usedByUid: null,
          status: 'active',
        });

        // Mirror onto the profile so the Invites tab can render the current code
        // without querying the invites collection.
        await db.collection('users').doc(uid).set({ inviteCode: code }, { merge: true });
        return code;
      } catch (err) {
        // A concurrent writer took this code between our read and write; the rules
        // reject the overwrite. Try a different one.
        if (attempt === MAX_TRIES - 1) throw err;
      }
    }

    throw new InviteError('UNAVAILABLE', 'Could not generate a unique invite code.');
  },

  /**
   * Resolve a code to its inviter, validating status and expiry.
   * Throws InviteError so callers can render a specific message.
   */
  async resolveInvite(rawCode: string): Promise<ResolvedInvite> {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (!INVITE_CODE_RE.test(code)) throw new InviteError('INVITE_NOT_FOUND');

    if (!isFirebaseConfigured()) throw new InviteError('UNAVAILABLE');
    const db = await getFirestore();
    if (!db) throw new InviteError('UNAVAILABLE');

    const snap = await db.collection('invites').doc(code).get();
    if (!snap.exists) throw new InviteError('INVITE_NOT_FOUND');

    const data = snap.data() ?? {};
    if (data.status === 'revoked') throw new InviteError('INVITE_REVOKED');
    if (data.status !== 'active') throw new InviteError('INVITE_NOT_FOUND');

    const expires = expiryMillis(data.expiresAt);
    if (expires !== null && expires < Date.now()) throw new InviteError('INVITE_EXPIRED');

    const fromUid = data.fromUid as string | undefined;
    if (!fromUid) throw new InviteError('INVITE_NOT_FOUND');

    return { code, fromUid };
  },

  /**
   * Turn a code into an active friendship.
   *
   * Idempotent: accepting twice returns `alreadyFriends: true` and writes nothing,
   * so a double-tap or a retried deep link cannot duplicate or reset a streak.
   *
   * Invites are MULTI-USE — the same shared link keeps working for everyone who
   * opens it, so it is never marked used.
   */
  async acceptInvite(rawCode: string): Promise<AcceptResult> {
    const invite = await this.resolveInvite(rawCode);

    const uid = await authReady();
    const db = await getFirestore();
    if (!uid || !db) throw new InviteError('UNAVAILABLE');
    if (invite.fromUid === uid) throw new InviteError('INVITE_SELF');

    const pairId = pairIdOf(invite.fromUid, uid);
    const ref = db.collection('friendships').doc(pairId);
    const usersSorted: [string, string] = invite.fromUid < uid
      ? [invite.fromUid, uid]
      : [uid, invite.fromUid];

    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const now = Date.now();

      if (snap.exists) {
        const existing = snap.data() ?? {};
        if (existing.status === 'active') {
          return { pairId, alreadyFriends: true };
        }
        if (existing.status === 'blocked') {
          throw new InviteError('BLOCKED');
        }

        // status === 'removed' → reactivate. longestStreak survives as a memorial;
        // the current streak restarts from zero.
        tx.update(ref, {
          status: 'active',
          acceptedAt: now,
          currentStreak: 0,
          lastStreakDate: null,
          milestonesAchieved: [],
          viaInvite: invite.code,
          lastUpdatedAt: now,
        });
        return { pairId, alreadyFriends: false };
      }

      // Field set and ordering match the friendship create rule exactly; `viaInvite`
      // is what proves to the rules that we hold the inviter's live code.
      tx.set(ref, {
        users: usersSorted,
        status: 'active',
        initiatedBy: invite.fromUid,
        acceptedAt: now,
        currentStreak: 0,
        longestStreak: 0,
        lastStreakDate: null,
        milestonesAchieved: [],
        createdAt: now,
        viaInvite: invite.code,
      });
      return { pairId, alreadyFriends: false };
    });
  },

  /** Soft-delete a friendship. Either member may do this. */
  async removeFriend(otherUid: string): Promise<void> {
    const uid = await authReady();
    const db = await getFirestore();
    if (!uid || !db) throw new InviteError('UNAVAILABLE');

    await db.collection('friendships').doc(pairIdOf(uid, otherUid)).update({
      status: 'removed',
      removedBy: uid,
      currentStreak: 0,
      lastStreakDate: null,
      lastUpdatedAt: Date.now(),
    });
  },

  /**
   * Block a user. The rules make a blocked friendship readable only by the blocker,
   * so the blocked party simply sees the friend disappear rather than learning they
   * were blocked.
   */
  async blockFriend(otherUid: string): Promise<void> {
    const uid = await authReady();
    const db = await getFirestore();
    if (!uid || !db) throw new InviteError('UNAVAILABLE');

    const pairId = pairIdOf(uid, otherUid);
    const ref = db.collection('friendships').doc(pairId);
    const usersSorted: [string, string] = uid < otherUid ? [uid, otherUid] : [otherUid, uid];
    const now = Date.now();

    await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        // Tombstone, so a later invite acceptance between this pair is refused.
        tx.set(ref, {
          users: usersSorted,
          status: 'blocked',
          blockedBy: uid,
          initiatedBy: uid,
          acceptedAt: now,
          currentStreak: 0,
          longestStreak: 0,
          lastStreakDate: null,
          milestonesAchieved: [],
          createdAt: now,
        });
        return;
      }
      tx.update(ref, {
        status: 'blocked',
        blockedBy: uid,
        currentStreak: 0,
        lastStreakDate: null,
        lastUpdatedAt: now,
      });
    });
  },
};

export default InviteService;
