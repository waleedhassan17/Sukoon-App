/**
 * Contract tests: the EXACT document shapes the client writes must be accepted by
 * the rules.
 *
 * The other two suites prove forgeries are rejected. This one guards the opposite
 * failure, which is easier to ship by accident: tightening a key allowlist in
 * firestore.rules and silently breaking a real write path. Every payload below is
 * copied from the corresponding client call site, and the comment names it — if you
 * change one, change the other.
 */

const {
  makeTestEnv, assertFails, assertSucceeds,
  pairIdOf, dateKey, ALICE, BOB,
} = require('./helpers');

const { doc, setDoc, updateDoc, getDoc } = require('firebase/firestore');

let testEnv;

beforeAll(async () => { testEnv = await makeTestEnv(); });
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
}

describe('UserProfileService.ensureProfile', () => {
  test('the create payload is accepted', async () => {
    // lib/userProfileService.ts — ensureProfile(), !snap.exists branch.
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}`), {
      displayName: 'Sukoon User',
      photoURL: 'https://api.dicebear.com/7.x/thumbs/png?seed=abc',
      inviteCode: null,
      timezone: 'Asia/Karachi',
      createdAt: Date.now(),
    }));
  });

  test('the update payload is accepted', async () => {
    // ensureProfile() builds a partial `updates` object and calls ref.update().
    await seed(db => setDoc(doc(db, `users/${ALICE}`), {
      displayName: 'Old', photoURL: '', inviteCode: null,
      timezone: 'UTC', createdAt: Date.now(),
    }));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, `users/${ALICE}`), {
      displayName: 'Aisha',
      photoURL: 'https://example.com/a.png',
      timezone: 'Asia/Karachi',
    }));
  });

  test('the legacy-token cleanup is accepted', async () => {
    // ensureProfile() → migrateTokensToPrivate(): copy into private/tokens, then
    // FieldValue.delete() both legacy fields off the public document.
    const { deleteField } = require('firebase/firestore');
    await seed(db => setDoc(doc(db, `users/${ALICE}`), {
      displayName: 'A', photoURL: '', inviteCode: null,
      timezone: 'UTC', createdAt: Date.now(),
      fcmToken: 'legacy', fcmTokens: ['legacy'],
    }));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(
      doc(db, `users/${ALICE}/private/tokens`),
      { fcmTokens: ['legacy'] },
      { merge: true },
    ));
    await assertSucceeds(updateDoc(doc(db, `users/${ALICE}`), {
      fcmToken: deleteField(),
      fcmTokens: deleteField(),
    }));
  });
});

describe('DataSyncService._mirrorToFriendsSchema', () => {
  test('the day-document payload is accepted', async () => {
    // lib/dataSyncService.ts — the set({...}, {merge:true}) on prayers/{uid}/days/{date}.
    const today = dateKey(0);
    const now = Date.now();
    const db = testEnv.authenticatedContext(ALICE).firestore();

    await assertSucceeds(setDoc(doc(db, `prayers/${ALICE}/days/${today}`), {
      date: today,
      fajr: { logged: true, loggedAt: now },
      dhuhr: { logged: true, loggedAt: now },
      asr: { logged: false, loggedAt: null },
      maghrib: { logged: false, loggedAt: null },
      isha: { logged: false, loggedAt: null },
      prayerCount: 2,
      completedAt: null,
      timezone: 'Asia/Karachi',
      updatedAt: now,
    }, { merge: true }));
  });

  test('a completed day sets completedAt and is accepted', async () => {
    const today = dateKey(0);
    const now = Date.now();
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const on = { logged: true, loggedAt: now };

    await assertSucceeds(setDoc(doc(db, `prayers/${ALICE}/days/${today}`), {
      date: today,
      fajr: on, dhuhr: on, asr: on, maghrib: on, isha: on,
      prayerCount: 5,
      completedAt: now,
      timezone: 'Asia/Karachi',
      updatedAt: now,
    }, { merge: true }));
  });
});

describe('InviteService', () => {
  test('the createInvite payloads are accepted', async () => {
    // lib/inviteService.ts — createInvite(): the invite doc, then the profile mirror.
    await seed(db => setDoc(doc(db, `users/${ALICE}`), {
      displayName: 'A', photoURL: '', inviteCode: null,
      timezone: 'UTC', createdAt: Date.now(),
    }));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    const now = Date.now();

    await assertSucceeds(setDoc(doc(db, 'invites/ABC234'), {
      code: 'ABC234',
      fromUid: ALICE,
      createdAt: now,
      expiresAt: now + 365 * 24 * 60 * 60 * 1000,
      usedByUid: null,
      status: 'active',
    }));

    await assertSucceeds(setDoc(
      doc(db, `users/${ALICE}`), { inviteCode: 'ABC234' }, { merge: true }));
  });

  test('the acceptInvite create payload is accepted', async () => {
    // lib/inviteService.ts — acceptInvite(), the tx.set() branch.
    await seed(db => setDoc(doc(db, 'invites/ABC234'), {
      code: 'ABC234', fromUid: ALICE, createdAt: Date.now(),
      expiresAt: Date.now() + 1000000, usedByUid: null, status: 'active',
    }));

    const db = testEnv.authenticatedContext(BOB).firestore();
    const now = Date.now();
    const users = ALICE < BOB ? [ALICE, BOB] : [BOB, ALICE];

    await assertSucceeds(setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
      users,
      status: 'active',
      initiatedBy: ALICE,
      acceptedAt: now,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      milestonesAchieved: [],
      createdAt: now,
      viaInvite: 'ABC234',
    }));
  });

  test('the removeFriend payload is accepted', async () => {
    // lib/inviteService.ts — removeFriend().
    const users = ALICE < BOB ? [ALICE, BOB] : [BOB, ALICE];
    await seed(db => setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
      users, status: 'active', initiatedBy: ALICE, acceptedAt: Date.now(),
      currentStreak: 4, longestStreak: 9, lastStreakDate: dateKey(-1),
      milestonesAchieved: [], createdAt: Date.now(), viaInvite: 'ABC234',
    }));

    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
      status: 'removed',
      removedBy: BOB,
      currentStreak: 0,
      lastStreakDate: null,
      lastUpdatedAt: Date.now(),
    }));
  });

  test('the blockFriend tombstone payload is accepted', async () => {
    // lib/inviteService.ts — blockFriend(), the !snap.exists branch.
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const now = Date.now();
    const users = ALICE < BOB ? [ALICE, BOB] : [BOB, ALICE];

    await assertSucceeds(setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
      users,
      status: 'blocked',
      blockedBy: ALICE,
      initiatedBy: ALICE,
      acceptedAt: now,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      milestonesAchieved: [],
      createdAt: now,
    }));
  });
});

describe('PairStreakEngine', () => {
  test('the advance payload is accepted', async () => {
    // lib/salah/pairStreak.ts — tryAdvance()'s tx.update().
    const today = dateKey(0);
    const users = ALICE < BOB ? [ALICE, BOB] : [BOB, ALICE];
    await seed(async db => {
      const on = { logged: true, loggedAt: Date.now() };
      const day = uid => ({
        date: today, fajr: on, dhuhr: on, asr: on, maghrib: on, isha: on,
        prayerCount: 5, completedAt: Date.now(), timezone: 'UTC', updatedAt: Date.now(),
      });
      await setDoc(doc(db, `prayers/${ALICE}/days/${today}`), day(ALICE));
      await setDoc(doc(db, `prayers/${BOB}/days/${today}`), day(BOB));
      await setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
        users, status: 'active', initiatedBy: ALICE, acceptedAt: Date.now(),
        currentStreak: 6, longestStreak: 6, lastStreakDate: dateKey(-1),
        milestonesAchieved: [], createdAt: Date.now(), viaInvite: 'ABC234',
      });
    });

    const db = testEnv.authenticatedContext(ALICE).firestore();
    // Streak reaches 7, so the milestone is awarded in the same write.
    await assertSucceeds(updateDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
      currentStreak: 7,
      longestStreak: 7,
      lastStreakDate: today,
      milestonesAchieved: [7],
      lastUpdatedAt: Date.now(),
    }));
  });

  test('the break payload is accepted', async () => {
    // lib/salah/pairStreak.ts — tryBreak()'s tx.update().
    const users = ALICE < BOB ? [ALICE, BOB] : [BOB, ALICE];
    await seed(db => setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
      users, status: 'active', initiatedBy: ALICE, acceptedAt: Date.now(),
      currentStreak: 12, longestStreak: 30, lastStreakDate: dateKey(-3),
      milestonesAchieved: [7], createdAt: Date.now(), viaInvite: 'ABC234',
    }));

    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
      currentStreak: 0,
      lastBrokenAt: Date.now(),
      lastBrokenStreak: 12,
      lastUpdatedAt: Date.now(),
    }));
  });
});

describe('FriendsService reads', () => {
  test('the friends listener query and its partner reads are authorised', async () => {
    // lib/friendsService.ts — subscribeToFriends() and its readPrayerCount() calls.
    const today = dateKey(0);
    const users = ALICE < BOB ? [ALICE, BOB] : [BOB, ALICE];
    await seed(async db => {
      await setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), {
        users, status: 'active', initiatedBy: ALICE, acceptedAt: Date.now(),
        currentStreak: 3, longestStreak: 3, lastStreakDate: dateKey(-1),
        milestonesAchieved: [], createdAt: Date.now(), viaInvite: 'ABC234',
      });
      await setDoc(doc(db, `users/${BOB}`), {
        displayName: 'Bilal', photoURL: '', inviteCode: null,
        timezone: 'UTC', createdAt: Date.now(),
      });
      await setDoc(doc(db, `prayers/${BOB}/days/${today}`), {
        date: today,
        fajr: { logged: true, loggedAt: 1 },
        dhuhr: { logged: false, loggedAt: null },
        asr: { logged: false, loggedAt: null },
        maghrib: { logged: false, loggedAt: null },
        isha: { logged: false, loggedAt: null },
        prayerCount: 1, completedAt: null, timezone: 'UTC', updatedAt: 1,
      });
    });

    const db = testEnv.authenticatedContext(ALICE).firestore();
    const { collection, query, where, orderBy, getDocs } = require('firebase/firestore');

    const snap = await assertSucceeds(getDocs(query(
      collection(db, 'friendships'),
      where('users', 'array-contains', ALICE),
      where('status', '==', 'active'),
      orderBy('currentStreak', 'desc'),
    )));
    expect(snap.size).toBe(1);

    // Partner profile and today-count, both hydrated by the listener.
    await assertSucceeds(getDoc(doc(db, `users/${BOB}`)));
    await assertSucceeds(getDoc(doc(db, `prayers/${BOB}/days/${today}`)));
  });
});
