/**
 * END-TO-END ACCEPTANCE RUN — the checklist in SALAH_BUDDY.md, executed.
 *
 * This is the gate before deploying rules to production. It drives two users
 * through the real feature flow against the REAL security rules, using the REAL
 * client streak math imported from lib/salah/streakMath.ts — not a
 * reimplementation. Every Firestore payload below is the one the app actually
 * writes (lib/inviteService.ts, lib/salah/pairStreak.ts, lib/dataSyncService.ts).
 *
 * What this covers: checklist items 3–8 — invite, accept, idempotency, the streak
 * advancing by exactly 1, a gap resetting it, longestStreak never decreasing,
 * milestones firing once, and the 💔 broken window.
 *
 * What it does NOT cover, and still needs a human on two devices: item 1 (the
 * empty-state renders instead of a banner), item 2 (the header X/5 — unit-tested
 * separately in __tests__/todayCount.test.ts), and item 9 (airplane mode / Expo Go
 * degradation). Those are UI-level and cannot be asserted from here.
 */

import {
  makeTestEnv, assertFails, assertSucceeds,
  pairIdOf, ALICE, BOB,
} from './helpers';

// The genuine client math — the same module the app ships.
import { applySharedDayComplete, shouldBreakStreak } from '../../lib/salah/streakMath';

const {
  doc, getDoc, setDoc, updateDoc, runTransaction,
  collection, query, where, orderBy, getDocs,
} = require('firebase/firestore');

let testEnv: any;
const PAIR = pairIdOf(ALICE, BOB);
const DAY_MS = 86400000;

beforeAll(async () => { testEnv = await makeTestEnv(); });
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

const dbFor = (uid: string) => testEnv.authenticatedContext(uid).firestore();

/** UTC date key `offset` days from now — matches the app's YYYY-MM-DD format. */
function dayKey(offset: number): string {
  const d = new Date(Date.now() + offset * DAY_MS);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Exactly what UserProfileService.ensureProfile() writes on create. */
async function createProfile(uid: string, displayName: string) {
  await assertSucceeds(setDoc(doc(dbFor(uid), `users/${uid}`), {
    displayName, photoURL: '', inviteCode: null,
    timezone: 'Asia/Karachi', createdAt: Date.now(),
  }, { merge: true }));
}

/** Exactly what InviteService.createInvite() writes. */
async function createInvite(uid: string, code: string) {
  const db = dbFor(uid);
  const now = Date.now();
  await assertSucceeds(setDoc(doc(db, `invites/${code}`), {
    code, fromUid: uid, createdAt: now,
    expiresAt: now + 365 * DAY_MS, usedByUid: null, status: 'active',
  }));
  await assertSucceeds(setDoc(doc(db, `users/${uid}`), { inviteCode: code }, { merge: true }));
}

/** Exactly what InviteService.acceptInvite() does, transaction and all. */
async function acceptInvite(recipientUid: string, code: string) {
  const db = dbFor(recipientUid);
  const inviteSnap = await getDoc(doc(db, `invites/${code}`));
  if (!inviteSnap.exists()) throw new Error('INVITE_NOT_FOUND');
  const invite = inviteSnap.data();
  const inviterUid = invite.fromUid;

  const pairId = pairIdOf(inviterUid, recipientUid);
  const ref = doc(db, `friendships/${pairId}`);
  const users = inviterUid < recipientUid
    ? [inviterUid, recipientUid] : [recipientUid, inviterUid];

  return runTransaction(db, async (tx: any) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    if (snap.exists()) {
      const existing = snap.data();
      if (existing.status === 'active') return { pairId, alreadyFriends: true };
      if (existing.status === 'blocked') throw new Error('BLOCKED');
      tx.update(ref, {
        status: 'active', acceptedAt: now, currentStreak: 0,
        lastStreakDate: null, milestonesAchieved: [],
        viaInvite: code, lastUpdatedAt: now,
      });
      return { pairId, alreadyFriends: false };
    }
    tx.set(ref, {
      users, status: 'active', initiatedBy: inviterUid, acceptedAt: now,
      currentStreak: 0, longestStreak: 0, lastStreakDate: null,
      milestonesAchieved: [], createdAt: now, viaInvite: code,
    });
    return { pairId, alreadyFriends: false };
  });
}

/** Exactly what DataSyncService._mirrorToFriendsSchema() writes. */
async function logPrayers(uid: string, dateKey: string, count: number) {
  const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const now = Date.now();
  const day: any = { date: dateKey, prayerCount: count, timezone: 'Asia/Karachi', updatedAt: now };
  keys.forEach((k, i) => {
    const logged = i < count;
    day[k] = { logged, loggedAt: logged ? now : null };
  });
  day.completedAt = count === 5 ? now : null;
  await assertSucceeds(setDoc(doc(dbFor(uid), `prayers/${uid}/days/${dateKey}`), day, { merge: true }));
}

/**
 * Exactly what PairStreakEngine.tryAdvance() does: read the partner's day, run the
 * real streak math, commit in a transaction. Returns milestones unlocked, or null.
 */
async function syncStreak(uid: string, candidateDate: string): Promise<number[] | null> {
  const db = dbFor(uid);
  const fs = await getDoc(doc(db, `friendships/${PAIR}`));
  if (!fs.exists()) return null;
  const f = fs.data();
  const partnerUid = f.users.find((u: string) => u !== uid);

  const partnerDay = await getDoc(doc(db, `prayers/${partnerUid}/days/${candidateDate}`));
  if (!partnerDay.exists() || partnerDay.data().prayerCount !== 5) return null;

  const ref = doc(db, `friendships/${PAIR}`);
  return runTransaction(db, async (tx: any) => {
    const fresh = await tx.get(ref);
    const d = fresh.data();
    if (d.status !== 'active') return null;

    const next = applySharedDayComplete({
      currentStreak: d.currentStreak ?? 0,
      longestStreak: d.longestStreak ?? 0,
      lastStreakDate: d.lastStreakDate ?? null,
      milestonesAchieved: d.milestonesAchieved ?? [],
      candidateDate,
    });
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

/** Exactly what PairStreakEngine.tryBreak() does. */
async function syncBreak(uid: string, todayKey: string): Promise<boolean> {
  const db = dbFor(uid);
  const ref = doc(db, `friendships/${PAIR}`);
  return runTransaction(db, async (tx: any) => {
    const fresh = await tx.get(ref);
    const d = fresh.data();
    const streak = d.currentStreak ?? 0;
    if (streak <= 0) return false;
    if (!shouldBreakStreak(d.lastStreakDate ?? null, todayKey)) return false;
    tx.update(ref, {
      currentStreak: 0, lastBrokenAt: Date.now(),
      lastBrokenStreak: streak, lastUpdatedAt: Date.now(),
    });
    return true;
  });
}

const readPair = async (uid: string) =>
  (await getDoc(doc(dbFor(uid), `friendships/${PAIR}`))).data();

// ─────────────────────────────────────────────────────────────────────────────

describe('ACCEPTANCE 1 — a fresh user sees an empty list, not an error', () => {
  test('the friends listener query is authorised and returns nothing', async () => {
    await createProfile(ALICE, 'Aisha');
    const snap: any = await assertSucceeds(getDocs(query(
      collection(dbFor(ALICE), 'friendships'),
      where('users', 'array-contains', ALICE),
      where('status', '==', 'active'),
      orderBy('currentStreak', 'desc'),
    )));
    expect(snap.empty).toBe(true);
  });
});

describe('ACCEPTANCE 3 — invite, accept, and both appear in each other\'s list', () => {
  test('the full invite flow works and is idempotent', async () => {
    await createProfile(ALICE, 'Aisha');
    await createProfile(BOB, 'Bilal');
    await createInvite(ALICE, 'ABC234');

    const first = await acceptInvite(BOB, 'ABC234');
    expect(first.alreadyFriends).toBe(false);
    expect(first.pairId).toBe(PAIR);

    // Accepting twice must not duplicate or reset anything.
    const second = await acceptInvite(BOB, 'ABC234');
    expect(second.alreadyFriends).toBe(true);

    // Each side sees the other.
    for (const [self, partner] of [[ALICE, BOB], [BOB, ALICE]]) {
      const snap: any = await assertSucceeds(getDocs(query(
        collection(dbFor(self), 'friendships'),
        where('users', 'array-contains', self),
        where('status', '==', 'active'),
        orderBy('currentStreak', 'desc'),
      )));
      expect(snap.size).toBe(1);
      expect(snap.docs[0].data().users).toContain(partner);
    }

    // The invite stays active — it is multi-use by design.
    expect((await getDoc(doc(dbFor(ALICE), 'invites/ABC234'))).data().status).toBe('active');
  });

  test('each friend can read the other\'s today-count', async () => {
    await createProfile(ALICE, 'Aisha');
    await createProfile(BOB, 'Bilal');
    await createInvite(ALICE, 'ABC234');
    await acceptInvite(BOB, 'ABC234');

    await logPrayers(BOB, dayKey(0), 3);
    const seen: any = await assertSucceeds(
      getDoc(doc(dbFor(ALICE), `prayers/${BOB}/days/${dayKey(0)}`)));
    expect(seen.data().prayerCount).toBe(3);
  });
});

describe('ACCEPTANCE 4-6 — the shared streak', () => {
  async function befriend() {
    await createProfile(ALICE, 'Aisha');
    await createProfile(BOB, 'Bilal');
    await createInvite(ALICE, 'ABC234');
    await acceptInvite(BOB, 'ABC234');
  }

  test('4 — completing a shared day advances the streak by EXACTLY 1, and repeats are no-ops', async () => {
    await befriend();
    const today = dayKey(0);

    // Only Alice has finished — nothing should move.
    await logPrayers(ALICE, today, 5);
    expect(await syncStreak(ALICE, today)).toBeNull();
    expect((await readPair(ALICE)).currentStreak).toBe(0);

    // Bob finishes too.
    await logPrayers(BOB, today, 5);
    expect(await syncStreak(BOB, today)).toEqual([]);
    expect((await readPair(BOB)).currentStreak).toBe(1);

    // Both devices re-sync — the streak must stay at 1.
    expect(await syncStreak(ALICE, today)).toBeNull();
    expect(await syncStreak(BOB, today)).toBeNull();
    expect((await readPair(ALICE)).currentStreak).toBe(1);
  });

  test('5 — a missed day resets the streak, and longestStreak survives', async () => {
    await befriend();

    // Three consecutive shared days.
    for (const off of [-5, -4, -3]) {
      await logPrayers(ALICE, dayKey(off), 5);
      await logPrayers(BOB, dayKey(off), 5);
      await syncStreak(ALICE, dayKey(off));
    }
    let pair = await readPair(ALICE);
    expect(pair.currentStreak).toBe(3);
    expect(pair.longestStreak).toBe(3);

    // dayKey(-2) is skipped entirely. Next shared day is dayKey(-1).
    await logPrayers(ALICE, dayKey(-1), 5);
    await logPrayers(BOB, dayKey(-1), 5);
    await syncStreak(ALICE, dayKey(-1));

    pair = await readPair(ALICE);
    expect(pair.currentStreak).toBe(1);   // reset by the gap
    expect(pair.longestStreak).toBe(3);   // never decreases
  });

  test('6 — the 7-day milestone fires exactly once', async () => {
    await befriend();
    const unlocked: number[][] = [];

    for (let i = 7; i >= 1; i--) {
      const d = dayKey(-i);
      await logPrayers(ALICE, d, 5);
      await logPrayers(BOB, d, 5);
      const m = await syncStreak(ALICE, d);
      if (m && m.length) unlocked.push(m);
    }

    const pair = await readPair(ALICE);
    expect(pair.currentStreak).toBe(7);
    expect(pair.longestStreak).toBe(7);
    expect(pair.milestonesAchieved).toEqual([7]);
    expect(unlocked).toEqual([[7]]);   // awarded on exactly one day

    // An eighth day must not re-award it.
    await logPrayers(ALICE, dayKey(0), 5);
    await logPrayers(BOB, dayKey(0), 5);
    expect(await syncStreak(BOB, dayKey(0))).toEqual([]);
    expect((await readPair(BOB)).milestonesAchieved).toEqual([7]);
  });

  test('concurrent sync from both devices cannot double-count', async () => {
    await befriend();
    const today = dayKey(0);
    await logPrayers(ALICE, today, 5);
    await logPrayers(BOB, today, 5);

    // Both devices race on the same completed day. One of them may lose the race
    // and have its write rejected by the rules — that is the safety net working,
    // and PairStreakEngine.sync() catches it per-pair. What must hold either way
    // is the invariant: the day is counted exactly once.
    await Promise.allSettled([syncStreak(ALICE, today), syncStreak(BOB, today)]);

    const pair = await readPair(ALICE);
    expect(pair.currentStreak).toBe(1);
    expect(pair.lastStreakDate).toBe(today);

    // And a further sync from either side still changes nothing.
    await Promise.allSettled([syncStreak(ALICE, today), syncStreak(BOB, today)]);
    expect((await readPair(BOB)).currentStreak).toBe(1);
  });
});

describe('ACCEPTANCE 7 — the broken-streak window', () => {
  test('a lapsed streak is recorded as broken, once', async () => {
    await createProfile(ALICE, 'Aisha');
    await createProfile(BOB, 'Bilal');
    await createInvite(ALICE, 'ABC234');
    await acceptInvite(BOB, 'ABC234');

    for (const off of [-4, -3]) {
      await logPrayers(ALICE, dayKey(off), 5);
      await logPrayers(BOB, dayKey(off), 5);
      await syncStreak(ALICE, dayKey(off));
    }
    expect((await readPair(ALICE)).currentStreak).toBe(2);

    // Two days have since passed with nothing logged.
    expect(await syncBreak(ALICE, dayKey(0))).toBe(true);

    const pair = await readPair(ALICE);
    expect(pair.currentStreak).toBe(0);
    expect(pair.lastBrokenStreak).toBe(2);
    expect(pair.longestStreak).toBe(2);
    // Drives the 💔 badge's 24h window in FriendListItem.
    expect(Date.now() - pair.lastBrokenAt).toBeLessThan(5000);

    // Re-running the sweep changes nothing.
    expect(await syncBreak(BOB, dayKey(0))).toBe(false);
    expect((await readPair(BOB)).lastBrokenStreak).toBe(2);
  });

  test('a streak still inside its grace window is NOT broken', async () => {
    await createProfile(ALICE, 'Aisha');
    await createProfile(BOB, 'Bilal');
    await createInvite(ALICE, 'ABC234');
    await acceptInvite(BOB, 'ABC234');

    await logPrayers(ALICE, dayKey(-1), 5);
    await logPrayers(BOB, dayKey(-1), 5);
    await syncStreak(ALICE, dayKey(-1));

    // Yesterday's streak, today still in progress — the partner may yet finish.
    expect(await syncBreak(ALICE, dayKey(0))).toBe(false);
    expect((await readPair(ALICE)).currentStreak).toBe(1);
  });
});

describe('ACCEPTANCE 8 — forged writes are rejected in the live flow', () => {
  test('a third party cannot join an established pair or read its history', async () => {
    await createProfile(ALICE, 'Aisha');
    await createProfile(BOB, 'Bilal');
    await createInvite(ALICE, 'ABC234');
    await acceptInvite(BOB, 'ABC234');
    await logPrayers(ALICE, dayKey(0), 5);
    await logPrayers(BOB, dayKey(0), 5);

    const CAROL = 'carol_uid';
    await createProfile(CAROL, 'Carol');

    // Carol cannot write herself into the EXISTING Alice–Bob pair.
    await assertFails(updateDoc(doc(dbFor(CAROL), `friendships/${PAIR}`), {
      users: [ALICE, CAROL].sort(), lastUpdatedAt: Date.now(),
    }));
    // Nor read it.
    await assertFails(getDoc(doc(dbFor(CAROL), `friendships/${PAIR}`)));
    // Nor read either member's prayer history — she is friends with neither.
    await assertFails(getDoc(doc(dbFor(CAROL), `prayers/${ALICE}/days/${dayKey(0)}`)));
    await assertFails(getDoc(doc(dbFor(CAROL), `prayers/${BOB}/days/${dayKey(0)}`)));

    // Without a live invite she cannot start a pair with Alice at all.
    await assertFails(setDoc(doc(dbFor(CAROL), `friendships/${pairIdOf(ALICE, CAROL)}`), {
      users: [ALICE, CAROL].sort(), status: 'active', initiatedBy: ALICE,
      acceptedAt: Date.now(), currentStreak: 0, longestStreak: 0,
      lastStreakDate: null, milestonesAchieved: [], createdAt: Date.now(),
      viaInvite: 'NOPE99',
    }));

    // Holding Alice's code, she MAY befriend Alice — invites are multi-use by
    // design, that is what makes one shared link work for many friends. It gives
    // her no access to Bob.
    await assertSucceeds(setDoc(doc(dbFor(CAROL), `friendships/${pairIdOf(ALICE, CAROL)}`), {
      users: [ALICE, CAROL].sort(), status: 'active', initiatedBy: ALICE,
      acceptedAt: Date.now(), currentStreak: 0, longestStreak: 0,
      lastStreakDate: null, milestonesAchieved: [], createdAt: Date.now(),
      viaInvite: 'ABC234',
    }));
    await assertSucceeds(getDoc(doc(dbFor(CAROL), `prayers/${ALICE}/days/${dayKey(0)}`)));
    await assertFails(getDoc(doc(dbFor(CAROL), `prayers/${BOB}/days/${dayKey(0)}`)));
  });

  test('a member cannot fabricate a streak they did not earn', async () => {
    await createProfile(ALICE, 'Aisha');
    await createProfile(BOB, 'Bilal');
    await createInvite(ALICE, 'ABC234');
    await acceptInvite(BOB, 'ABC234');

    // Alice completes her own day but Bob has not.
    await logPrayers(ALICE, dayKey(0), 5);
    await assertFails(updateDoc(doc(dbFor(ALICE), `friendships/${PAIR}`), {
      currentStreak: 1, longestStreak: 1, lastStreakDate: dayKey(0),
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
    expect((await readPair(ALICE)).currentStreak).toBe(0);
  });
});
