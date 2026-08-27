/**
 * friendships/{pairId} — the collection that carries streak state.
 *
 * On the Spark plan there is no trusted server, so these rules are the only thing
 * preventing a client from writing whatever streak it likes. Each test here maps
 * to a specific forgery the rules are supposed to defeat.
 */

const {
  makeTestEnv, assertFails, assertSucceeds,
  pairIdOf, dateKey, dayDoc, friendshipDoc, inviteDoc,
  ALICE, BOB, CAROL,
} = require('./helpers');

const { doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, getDocs } =
  require('firebase/firestore');

let testEnv;
const PAIR = pairIdOf(ALICE, BOB);

beforeAll(async () => { testEnv = await makeTestEnv(); });
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

/** Seed fixtures bypassing rules — these are states the server would have created. */
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
}

/** Both members complete all five prayers on `date`. */
async function seedSharedDay(date) {
  await seed(async db => {
    await setDoc(doc(db, `prayers/${ALICE}/days/${date}`), dayDoc(date, 5));
    await setDoc(doc(db, `prayers/${BOB}/days/${date}`), dayDoc(date, 5));
  });
}

describe('reading friendships', () => {
  test('a fresh anonymous user listing their friendships succeeds and is empty', async () => {
    // The regression that produced the permission-denied banner. The listener
    // query must be authorised wholesale, not post-filtered.
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const q = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', ALICE),
      where('status', '==', 'active'),
      orderBy('currentStreak', 'desc'),
    );
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.empty).toBe(true);
  });

  test('the same query still succeeds when a removed friendship exists', async () => {
    // Previously one `removed` doc killed the entire listener, because the rules
    // were narrower than the query.
    await seed(async db => {
      await setDoc(doc(db, `friendships/${PAIR}`),
        friendshipDoc(ALICE, BOB, { status: 'removed', removedBy: BOB }));
      await setDoc(doc(db, `friendships/${pairIdOf(ALICE, CAROL)}`),
        friendshipDoc(ALICE, CAROL));
    });

    const db = testEnv.authenticatedContext(ALICE).firestore();
    const snap = await assertSucceeds(getDocs(query(
      collection(db, 'friendships'),
      where('users', 'array-contains', ALICE),
      where('status', '==', 'active'),
      orderBy('currentStreak', 'desc'),
    )));
    expect(snap.size).toBe(1);
  });

  test('a member reads their own active friendship', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(db, `friendships/${PAIR}`)));
  });

  test('a non-member cannot read someone else\'s friendship', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.authenticatedContext(CAROL).firestore();
    await assertFails(getDoc(doc(db, `friendships/${PAIR}`)));
  });

  test('a blocked user cannot read the friendship, so they never learn they were blocked', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { status: 'blocked', blockedBy: ALICE })));

    // The blocker can still see it...
    await assertSucceeds(
      getDoc(doc(testEnv.authenticatedContext(ALICE).firestore(), `friendships/${PAIR}`)));
    // ...the blocked party cannot.
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext(BOB).firestore(), `friendships/${PAIR}`)));
  });

  test('an unauthenticated client reads nothing', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `friendships/${PAIR}`)));
  });
});

describe('creating a friendship', () => {
  test('succeeds when the caller holds the other user\'s live invite', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { initiatedBy: ALICE, viaInvite: 'ABC234' })));
  });

  test('FORGERY: cannot befriend an arbitrary user without an invite', async () => {
    // Without this check, any client could mint a friendship with any uid and
    // thereby gain read access to that user's entire prayer history.
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { initiatedBy: ALICE, viaInvite: 'NOPE99' })));
  });

  test('FORGERY: cannot use an invite issued by a third party', async () => {
    await seed(db => setDoc(doc(db, 'invites/CCC234'), inviteDoc('CCC234', CAROL)));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { initiatedBy: ALICE, viaInvite: 'CCC234' })));
  });

  test('FORGERY: cannot use a revoked invite', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'),
      inviteDoc('ABC234', ALICE, { status: 'revoked' })));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { viaInvite: 'ABC234' })));
  });

  test('FORGERY: cannot create a pair the caller is not part of', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(CAROL).firestore();
    await assertFails(setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { viaInvite: 'ABC234' })));
  });

  test('FORGERY: cannot create a friendship with a pre-baked streak', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        viaInvite: 'ABC234', currentStreak: 500, longestStreak: 500,
      })));
  });

  test('FORGERY: document id must match the sorted uid pair', async () => {
    await seed(db => setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE)));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, 'friendships/some_other_id'),
      friendshipDoc(ALICE, BOB, { viaInvite: 'ABC234' })));
  });
});

describe('advancing the shared streak', () => {
  test('advances by exactly one when both members completed the day', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        currentStreak: 4, longestStreak: 9, lastStreakDate: dateKey(-1),
      })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 5,
      longestStreak: 9,
      lastStreakDate: today,
      milestonesAchieved: [],
      lastUpdatedAt: Date.now(),
    }));
  });

  test('restarts at 1 after a gap', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        currentStreak: 12, longestStreak: 30, lastStreakDate: dateKey(-4),
      })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 1, longestStreak: 30, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot skip ahead — a gap day must reset, not continue', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        currentStreak: 12, longestStreak: 30, lastStreakDate: dateKey(-4),
      })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 13, longestStreak: 30, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot advance when only one member completed the day', async () => {
    const today = dateKey(0);
    await seed(async db => {
      await setDoc(doc(db, `prayers/${ALICE}/days/${today}`), dayDoc(today, 5));
      await setDoc(doc(db, `prayers/${BOB}/days/${today}`), dayDoc(today, 3));
      await setDoc(doc(db, `friendships/${PAIR}`),
        friendshipDoc(ALICE, BOB, { currentStreak: 0, lastStreakDate: null }));
    });

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 1, longestStreak: 1, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot advance on a day with no prayer documents at all', async () => {
    const today = dateKey(0);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 1, longestStreak: 1, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot jump the streak by an arbitrary amount', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 4, longestStreak: 4, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 9999, longestStreak: 9999, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot back-date lastStreakDate to resurrect an old streak', async () => {
    const past = dateKey(-3);
    await seedSharedDay(past);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 2, longestStreak: 2, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 3, longestStreak: 3, lastStreakDate: past,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot claim a future date beyond the timezone slack', async () => {
    const future = dateKey(5);
    await seedSharedDay(future);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 1, longestStreak: 1, lastStreakDate: future,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: longestStreak can never decrease', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 1, longestStreak: 40, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 2, longestStreak: 2, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: longestStreak cannot be inflated past the true maximum', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 1, longestStreak: 1, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 2, longestStreak: 900, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('milestone is awarded when the streak reaches a real threshold', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 6, longestStreak: 6, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 7, longestStreak: 7, lastStreakDate: today,
      milestonesAchieved: [7], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot invent a milestone value outside the published set', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 6, longestStreak: 6, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 7, longestStreak: 7, lastStreakDate: today,
      milestonesAchieved: [7, 12345], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: milestones are monotone — an earned one cannot be dropped', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        currentStreak: 30, longestStreak: 30, lastStreakDate: dateKey(-1),
        milestonesAchieved: [7, 30],
      })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 31, longestStreak: 31, lastStreakDate: today,
      milestonesAchieved: [7], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: a non-member cannot touch the streak at all', async () => {
    const today = dateKey(0);
    await seedSharedDay(today);
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 1, longestStreak: 1, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(CAROL).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 2, longestStreak: 2, lastStreakDate: today,
      milestonesAchieved: [], lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: membership is immutable — nobody can join an existing pair', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      users: [ALICE, CAROL], lastUpdatedAt: Date.now(),
    }));
  });
});

describe('breaking, removing and blocking', () => {
  test('a member records a break once two days have elapsed', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        currentStreak: 9, longestStreak: 9, lastStreakDate: dateKey(-3),
      })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 0, lastBrokenAt: Date.now(), lastBrokenStreak: 9,
      lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot report a broken streak larger than the one that existed', async () => {
    // lastBrokenStreak drives the 💔 badge, so an inflated value is a vanity forgery.
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        currentStreak: 2, longestStreak: 2, lastStreakDate: dateKey(-3),
      })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 0, lastBrokenAt: Date.now(), lastBrokenStreak: 400,
      lastUpdatedAt: Date.now(),
    }));
  });

  test('cannot break a streak that is still within its grace window', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, {
        currentStreak: 9, longestStreak: 9, lastStreakDate: dateKey(0),
      })));

    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      currentStreak: 0, lastBrokenAt: Date.now(), lastBrokenStreak: 9,
      lastUpdatedAt: Date.now(),
    }));
  });

  test('either member may remove, zeroing the streak but keeping longestStreak', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`),
      friendshipDoc(ALICE, BOB, { currentStreak: 5, longestStreak: 20, lastStreakDate: dateKey(-1) })));

    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${PAIR}`), {
      status: 'removed', removedBy: BOB, currentStreak: 0,
      lastStreakDate: null, lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot attribute a removal to the other party', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      status: 'removed', removedBy: ALICE, currentStreak: 0,
      lastStreakDate: null, lastUpdatedAt: Date.now(),
    }));
  });

  test('a member may block, recording themselves as the blocker', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${PAIR}`), {
      status: 'blocked', blockedBy: ALICE, currentStreak: 0,
      lastStreakDate: null, lastUpdatedAt: Date.now(),
    }));
  });

  test('a removed pair can be reactivated with a fresh invite, keeping longestStreak', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE));
      await setDoc(doc(db, `friendships/${PAIR}`),
        friendshipDoc(ALICE, BOB, {
          status: 'removed', removedBy: BOB, currentStreak: 0, longestStreak: 20,
        }));
    });

    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(updateDoc(doc(db, `friendships/${PAIR}`), {
      status: 'active', acceptedAt: Date.now(), currentStreak: 0,
      lastStreakDate: null, milestonesAchieved: [], viaInvite: 'ABC234',
      lastUpdatedAt: Date.now(),
    }));
  });

  test('FORGERY: cannot unblock yourself out of someone else\'s block', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'invites/ABC234'), inviteDoc('ABC234', ALICE));
      await setDoc(doc(db, `friendships/${PAIR}`),
        friendshipDoc(ALICE, BOB, { status: 'blocked', blockedBy: ALICE }));
    });

    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, `friendships/${PAIR}`), {
      status: 'active', acceptedAt: Date.now(), currentStreak: 0,
      lastStreakDate: null, milestonesAchieved: [], viaInvite: 'ABC234',
      lastUpdatedAt: Date.now(),
    }));
  });

  test('friendships are never hard-deleted', async () => {
    await seed(db => setDoc(doc(db, `friendships/${PAIR}`), friendshipDoc(ALICE, BOB)));
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const { deleteDoc } = require('firebase/firestore');
    await assertFails(deleteDoc(doc(db, `friendships/${PAIR}`)));
  });
});
