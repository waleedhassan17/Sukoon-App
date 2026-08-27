/**
 * Shared harness for the security-rules suite.
 *
 * These tests talk to the Firestore emulator over the client SDK as real signed-in
 * users, so what they assert is exactly what a device would experience. Seeding
 * uses withSecurityRulesDisabled() to plant fixtures that the rules would (quite
 * correctly) refuse to let a client create.
 */

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-sukoon-rules';

// Must match the firestore emulator port in ../../firebase.json. 8080 is occupied
// on the primary dev machine, hence the non-default choice.
const EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8090);

const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const CAROL = 'carol_uid';

/** Canonical pair id — mirrors pairIdOf() in firestore.rules and the app. */
function pairIdOf(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

const DAY = 24 * 60 * 60 * 1000;

/** A YYYY-MM-DD key `offsetDays` from today (UTC), matching the app's key format. */
function dateKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DAY);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** A prayer-day document with `count` prayers logged, in canonical field shape. */
function dayDoc(date, count) {
  const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const doc = { date, prayerCount: count, timezone: 'Asia/Karachi', updatedAt: Date.now() };
  keys.forEach((k, i) => {
    const logged = i < count;
    doc[k] = { logged, loggedAt: logged ? Date.now() : null };
  });
  doc.completedAt = count === 5 ? Date.now() : null;
  return doc;
}

/** An active friendship between two users, with optional streak state applied. */
function friendshipDoc(a, b, overrides = {}) {
  const users = a < b ? [a, b] : [b, a];
  return {
    users,
    status: 'active',
    initiatedBy: users[0],
    acceptedAt: Date.now(),
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: null,
    milestonesAchieved: [],
    createdAt: Date.now(),
    viaInvite: 'ABC234',
    ...overrides,
  };
}

/** An active invite issued by `fromUid`. */
function inviteDoc(code, fromUid, overrides = {}) {
  return {
    code,
    fromUid,
    createdAt: Date.now(),
    expiresAt: Date.now() + 365 * DAY,
    usedByUid: null,
    status: 'active',
    ...overrides,
  };
}

function profileDoc(overrides = {}) {
  return {
    displayName: 'Test User',
    photoURL: 'https://example.com/a.png',
    timezone: 'Asia/Karachi',
    inviteCode: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

async function makeTestEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: EMULATOR_PORT,
    },
  });
}

module.exports = {
  makeTestEnv,
  assertFails,
  assertSucceeds,
  pairIdOf,
  dateKey,
  dayDoc,
  friendshipDoc,
  inviteDoc,
  profileDoc,
  ALICE,
  BOB,
  CAROL,
  DAY,
};
