/**
 * prayers/{uid}/days/{date} — the streak's source of truth, plus users/* and
 * invites/*.
 *
 * The prayerCount check here is the one that used to live in the onPrayerWrite
 * Cloud Function: without it a client could write prayerCount: 5 having logged
 * nothing, and the friendship rules — which trust prayerCount — would happily
 * mint a streak on top of it.
 */

const {
  makeTestEnv, assertFails, assertSucceeds,
  pairIdOf, dateKey, dayDoc, friendshipDoc, inviteDoc, profileDoc,
  ALICE, BOB, CAROL, DAY,
} = require('./helpers');

const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

let testEnv;

beforeAll(async () => { testEnv = await makeTestEnv(); });
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
}

describe('prayers/{uid}/days/{date}', () => {
  const today = dateKey(0);

  test('the owner writes their own day document', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, `prayers/${ALICE}/days/${today}`), dayDoc(today, 3)));
  });

  test('FORGERY: prayerCount must match the logged flags', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const forged = { ...dayDoc(today, 0), prayerCount: 5 };
    await assertFails(setDoc(doc(db, `prayers/${ALICE}/days/${today}`), forged));
  });

  test('FORGERY: prayerCount cannot be understated either', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const forged = { ...dayDoc(today, 5), prayerCount: 2 };
    await assertFails(setDoc(doc(db, `prayers/${ALICE}/days/${today}`), forged));
  });

  test('FORGERY: cannot write into another user\'s prayer history', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(
      setDoc(doc(db, `prayers/${ALICE}/days/${today}`), dayDoc(today, 5)));
  });

  test('FORGERY: the date field must match the document id', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, `prayers/${ALICE}/days/${today}`), dayDoc(dateKey(-2), 5)));
  });

  test('FORGERY: cannot pre-log a far-future day (clock tampering)', async () => {
    const far = dateKey(30);
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, `prayers/${ALICE}/days/${far}`), dayDoc(far, 5)));
  });

  test('tomorrow is allowed, because a user in UTC+14 is legitimately a day ahead', async () => {
    const tomorrow = dateKey(1);
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, `prayers/${ALICE}/days/${tomorrow}`), dayDoc(tomorrow, 5)));
  });

  test('FORGERY: unexpected fields are rejected', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, `prayers/${ALICE}/days/${today}`),
      { ...dayDoc(today, 5), isAdmin: true }));
  });

  test('FORGERY: a malformed prayer entry is rejected', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, `prayers/${ALICE}/days/${today}`),
      { ...dayDoc(today, 5), fajr: 'prayed' }));
  });

  test('an active friend may read the partner\'s days', async () => {
    // This is what unbreaks the friend-detail calendar and the partner
    // today-counts, both of which silently read 0 under the old owner-only rule.
    await seed(async db => {
      await setDoc(doc(db, `prayers/${ALICE}/days/${today}`), dayDoc(today, 5));
      await setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`), friendshipDoc(ALICE, BOB));
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, `prayers/${ALICE}/days/${today}`)));
  });

  test('a stranger may not read another user\'s days', async () => {
    await seed(db => setDoc(doc(db, `prayers/${ALICE}/days/${today}`), dayDoc(today, 5)));
    const db = testEnv.authenticatedContext(CAROL).firestore();
    await assertFails(getDoc(doc(db, `prayers/${ALICE}/days/${today}`)));
  });

  test('a REMOVED friend loses read access to prayer history', async () => {
    await seed(async db => {
      await setDoc(doc(db, `prayers/${ALICE}/days/${today}`), dayDoc(today, 5));
      await setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`),
        friendshipDoc(ALICE, BOB, { status: 'removed', removedBy: ALICE }));
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(getDoc(doc(db, `prayers/${ALICE}/days/${today}`)));
  });
});

describe('users/{uid}', () => {
  test('the owner creates and updates their own profile', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}`), profileDoc()));
    await assertSucceeds(
      updateDoc(doc(db, `users/${ALICE}`), { displayName: 'Aisha' }));
  });

  test('any signed-in user reads a profile, because the accept screen needs the inviter\'s name', async () => {
    await seed(db => setDoc(doc(db, `users/${ALICE}`), profileDoc()));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, `users/${ALICE}`)));
  });

  test('FORGERY: cannot write another user\'s profile', async () => {
    await seed(db => setDoc(doc(db, `users/${ALICE}`), profileDoc()));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, `users/${ALICE}`), { displayName: 'pwned' }));
  });

  test('FORGERY: cannot smuggle an extra field into a world-readable profile', async () => {
    // The write allowlist is what makes the open read rule safe.
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, `users/${ALICE}`),
      { ...profileDoc(), isAdmin: true }));
    await assertFails(setDoc(doc(db, `users/${ALICE}`),
      { ...profileDoc(), secretNotes: 'private' }));
  });

  describe('backward compatibility with app versions <= 1.3.0', () => {
    // These pin the TRANSITIONAL allowance in firestore.rules. Old builds write FCM
    // tokens onto this document; rejecting them would break every user who has not
    // yet updated, because the old ensureProfile() throws on denial and then no
    // profile exists at all. Delete this block when the rules allowance is removed.
    test('an old client can still create its profile with fcmTokens: []', async () => {
      const db = testEnv.authenticatedContext(ALICE).firestore();
      await assertSucceeds(setDoc(doc(db, `users/${ALICE}`),
        { ...profileDoc(), fcmTokens: [] }, { merge: true }));
    });

    test('an old client can still register an FCM token', async () => {
      await seed(db => setDoc(doc(db, `users/${ALICE}`), profileDoc()));
      const db = testEnv.authenticatedContext(ALICE).firestore();
      await assertSucceeds(setDoc(doc(db, `users/${ALICE}`), {
        fcmTokens: ['tok'], fcmToken: 'tok',
        platform: 'android', lastTokenUpdate: Date.now(),
      }, { merge: true }));
    });

    test('the allowance is narrow — it does not open the door to other fields', async () => {
      await seed(db => setDoc(doc(db, `users/${ALICE}`), profileDoc()));
      const db = testEnv.authenticatedContext(ALICE).firestore();
      await assertFails(setDoc(doc(db, `users/${ALICE}`),
        { role: 'admin' }, { merge: true }));
    });
  });

  test('createdAt is immutable', async () => {
    await seed(db => setDoc(doc(db, `users/${ALICE}`), profileDoc()));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `users/${ALICE}`), { createdAt: 0 }));
  });

  test('an over-long display name is rejected', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, `users/${ALICE}`),
      profileDoc({ displayName: 'x'.repeat(200) })));
  });
});

describe('users/{uid}/private — FCM tokens', () => {
  test('the owner reads and writes their own token document', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/private/tokens`), { fcmTokens: ['t1'] }));
    await assertSucceeds(getDoc(doc(db, `users/${ALICE}/private/tokens`)));
  });

  test('nobody else can read another user\'s FCM tokens', async () => {
    await seed(db => setDoc(doc(db, `users/${ALICE}/private/tokens`), { fcmTokens: ['t1'] }));

    // Not a stranger...
    await assertFails(getDoc(
      doc(testEnv.authenticatedContext(CAROL).firestore(), `users/${ALICE}/private/tokens`)));

    // ...and not even an active friend.
    await seed(db => setDoc(doc(db, `friendships/${pairIdOf(ALICE, BOB)}`),
      friendshipDoc(ALICE, BOB)));
    await assertFails(getDoc(
      doc(testEnv.authenticatedContext(BOB).firestore(), `users/${ALICE}/private/tokens`)));
  });
});

describe('invites/{code}', () => {
  test('the inviter creates their own code', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
  });

  test('any signed-in user may resolve a code', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, 'invites/ABC234')));
  });

  test('FORGERY: cannot issue an invite in someone else\'s name', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
  });

  test('FORGERY: the code field must match the document id', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'invites/ABC234'), inviteDoc('ZZZ999', ALICE)));
  });

  test('FORGERY: cannot mint a code that outlives any plausible revocation', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'invites/ABC234'),
      inviteDoc('ABC234', ALICE, { expiresAt: Date.now() + 4000 * DAY })));
  });

  test('FORGERY: cannot create an already-used invite', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'invites/ABC234'),
      inviteDoc('ABC234', ALICE, { usedByUid: BOB })));
  });

  test('the inviter revokes their own code', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, 'invites/ABC234'), { status: 'revoked' }));
  });

  test('FORGERY: a recipient cannot revoke or otherwise mutate an invite', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, 'invites/ABC234'), { status: 'revoked' }));
    await assertFails(updateDoc(doc(db, 'invites/ABC234'), { fromUid: BOB }));
  });

  test('FORGERY: cannot repoint an existing invite at a different user', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, 'invites/ABC234'), { fromUid: CAROL }));
  });
});
