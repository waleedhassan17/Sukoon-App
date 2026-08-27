# Sukoon — Salah Buddy Streak Feature

Two friends keep a shared streak alive only when **both** complete all five daily
prayers in their own local day. Friend acquisition is invite-link only (WhatsApp +
system share sheet, with deferred install attribution via Branch.io).

This document is the deploy / run / verify guide.

---

## Read this first: the project is on the Spark plan

**Cloud Functions cannot be deployed.** That single fact shapes the whole design, so
it is worth stating plainly before anything else.

A streak is a social claim — it is worth something precisely because it is hard to
fake — which normally argues for a trusted server owning it. Without one, the
security rules do that job instead: rather than storing whatever number the client
sends, **`firestore.rules` re-derives every streak transition** from the two members'
own prayer documents and rejects any write that disagrees.

The client proposes; the rules decide.

### What a malicious client cannot do

| Attack | Defence |
|---|---|
| Invent a streak increment | Rules recompute the transition from `lastStreakDate` and both members' day docs |
| Claim a day the pair didn't complete | Rules `get()` both `prayers/*/days/{date}` and require `prayerCount == 5` on each |
| Write `prayerCount: 5` with nothing logged | Rules recompute the count from the five `logged` flags |
| Befriend a stranger to read their prayer history | `friendships` create requires `viaInvite` to name a **live invite issued by the other member** |
| Lower `longestStreak`, or inflate it | Pinned to exactly `max(old, new)` |
| Re-award or invent a milestone | `milestonesAchieved` must grow monotonically and stay within `[7, 30, 100, 365]` |
| Back-date or future-date a streak | Date keys bounded against `request.time` (±1 day for timezone slack) |

What remains trust-based is a user **lying about having prayed** in their own day
document. That is equally true of the Cloud Functions design — the server would trust
the same booleans — so staying on Spark costs very little here.

### What is genuinely lost, and what replaces it

| Blaze capability | Status | Replacement |
|---|---|---|
| `onPrayerWrite` streak fan-out | Not deployable | `lib/salah/pairStreak.ts`, run after logging a prayer and on Friends-screen focus |
| `streakSweep` hourly break job | Not deployable | Lazy break evaluation in the same module, rules-guarded |
| FCM push (milestone / streak broken) | **Not possible** — sending FCM requires a trusted server | In-app state only. `expo-notifications` local reminders are the available substitute |
| Server-side clock-tamper immunity | Weakened | `request.time` bound of ±1 day on every client-written date key |

`functions/` remains in the repo, compiling clean and passing its tests, as the
dormant Blaze path. See [Moving to Blaze](#moving-to-blaze).

---

## Data model

```
users/{uid}                                   PUBLIC — any signed-in user may read
  displayName, photoURL, timezone (IANA), inviteCode | null, createdAt

  ⚠ Rules cannot hide fields on read, so this document must contain ONLY public
    profile data. A write allowlist enforces that: adding a field here without
    also updating firestore.rules fails the write.

users/{uid}/private/{doc}                     OWNER ONLY
  tokens: { fcmTokens: string[], platform, lastTokenUpdate }

prayers/{uid}/days/{YYYY-MM-DD}               owner writes; ACTIVE FRIENDS may read
  date, timezone,
  fajr|dhuhr|asr|maghrib|isha: { logged: bool, loggedAt: number|null },
  prayerCount 0..5,     ← rules recompute this from the logged flags
  completedAt: number|null, updatedAt: number

invites/{CODE}                                any signed-in user may read
  code, fromUid, status: 'active'|'revoked',
  createdAt, expiresAt, usedByUid: null
  Codes are MULTI-USE: never consumed, so one shared link works for everyone.

friendships/{pairId}                          members only
  users: [uidA, uidB]  (sorted),  status: 'active'|'removed'|'blocked',
  initiatedBy, acceptedAt, viaInvite,
  currentStreak, longestStreak, lastStreakDate, milestonesAchieved: number[],
  blockedBy?, removedBy?, lastBrokenAt?, lastBrokenStreak?, createdAt, lastUpdatedAt
```

**`pairId` is the two uids sorted lexicographically and joined by `_`.** Defined in
three places that must agree: `pairIdOf()` in `firestore.rules`, in
`lib/salah/streakMath.ts`, and in `functions/src/streakMath.ts`. The rules
verify a friendship's document id equals this, so a client computing it differently
cannot create one at all.

**All time-valued fields are epoch milliseconds**, never Firestore `Timestamp`s. This
is what lets the rules do arithmetic on them directly. Readers tolerate legacy
`Timestamp` values written before this convention.

### Visibility

- **Removed** friendship — readable by nobody. It simply vanishes from both lists.
- **Blocked** friendship — readable only by the blocker. The blocked party perceives
  the friend as removed and is never told they were blocked.
- **Active** — readable by both members, which is also what unlocks reading each
  other's `prayers/*` documents.

---

## The streak rule, stated once

> A day `D` counts for a pair when **both** members have `prayers/{uid}/days/D` with
> `prayerCount == 5`, where each member writes `D` as their **own local date**.

Two friends in different timezones compare date **strings**, never instants — a
shared *day*, not a shared *moment*. Karachi's Tuesday and New York's Tuesday overlap
only partially in real time, but they are the same key, so both devices converge on
the same streak value regardless of which one evaluates first.

- `currentStreak` increments when `D` is the day after `lastStreakDate`, else resets to 1.
- `longestStreak = max(longestStreak, currentStreak)` — never decreases.
- **Breaking** is judged against whichever member is **further behind**: if even the
  user with the most time remaining is two calendar days past `lastStreakDate`, both
  missed a day. This keeps the streak alive for a partner who still has hours left.
- Milestones fire once each at **7, 30, 100, 365** days.

Milestone thresholds live in three places that must stay in sync: `STREAK_MILESTONES`
in `lib/salah/streakMath.ts` and in `functions/src/types.ts`, plus
`milestones()` in `firestore.rules`. The rules reject any value outside the set, so
changing one alone makes the award silently fail to write.

### Idempotency

Both members' devices race to record the same completed day. Every transition runs in
a Firestore transaction, and `applySharedDayComplete()` is a no-op when
`lastStreakDate` already equals the candidate date — so the loser of the race changes
nothing, and replays are free. The same holds for accepting an invite twice
(`alreadyFriends: true`, no write) and for recording a break twice.

---

## Repository layout

```
Sukoon-App/                    ← the git repo; app AND backend
├── firestore.rules            ← the security model; read its header first
├── firestore.indexes.json     ← composite indexes (see below)
├── firebase.json  .firebaserc ← project sukoon-b36b4; emulator ports
├── package.json               ← scripts: emu, test:rules, test:all, deploy:*
├── tools/emulator-env.js      ← JDK-21 preflight for the emulator
├── tests/rules/               ← 81 security-rules tests — the primary gate
│   ├── friendships.test.js      forgery attempts against streak state
│   ├── prayers.test.js          day docs, profiles, private tokens, invites
│   └── clientShapes.test.js     every real client payload must be ACCEPTED
├── functions/                 ← DORMANT Blaze path (compiles, tests pass)
├── public/invite/             ← hosting fallback page for invite links
├── lib/salah/                 ← the client streak engine (see its README.md)
├── lib/inviteService.ts       ← invite + friendship mutations
├── lib/friendsService.ts      ← listener + friend detail
└── app/tools/salah-*.tsx, app/invite/[code].tsx, app/friends/[uid].tsx
```

`functions/` and `tests/` are excluded from the app's `tsconfig.json` and from
Metro's `blockList` — they ship with the repo but never enter the app bundle.

### Indexes

| Collection | Fields | Used by |
|---|---|---|
| `friendships` | `users` CONTAINS, `status` ASC, `currentStreak` DESC | `subscribeToFriends()` — the friends listener |
| `friendships` | `status` ASC, `lastStreakDate` ASC | dormant `streakSweep` only; kept for a Blaze upgrade |
| `invites` | `fromUid` ASC, `status` ASC | `createInvite()` revoking prior codes |

---

## Setup

```bash
npm install
npm --prefix tests/rules install
npm --prefix functions install     # only if you intend to work on the Blaze path
```

Firebase CLI ≥ 13 and **JDK 21+** are needed for the emulator. This repo pins Java 17
for the Android Gradle build, so **do not change the system default** — `npm run emu`
scopes `JAVA_HOME` to the emulator via `tools/emulator-env.js`, which locates a
suitable JDK and tells you how to install one if none exists.

---

## Local development against the emulator

```bash
# Terminal 1 — Firestore + Auth emulators
npm run emu

# Terminal 2 — the app, pointed at them
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 npx expo start --dev-client
```

Firestore is on **8090**, not the usual 8080, which is occupied on the primary dev
machine; Auth is on 9099 and the emulator UI on 4000. On the Android emulator the
client reaches the host through `10.0.2.2` automatically. Override with
`EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` for a physical device on the same LAN.

Expo Go cannot run this feature at all — `@react-native-firebase` and Branch are
native modules — so use a dev client. The app degrades gracefully there: the Salah
tracker still works from AsyncStorage and the friends surfaces disable themselves.

---

## Testing

```bash
npm run test:all      # app + rules + functions
npm run test:rules    # 81 security-rules tests (boots the emulator itself)
npm run typecheck     # app and functions
```

The rules suite is the important one now that the rules carry the security weight.
It covers, on top of the happy paths:

- a fresh anonymous user listing friendships → allowed and empty, **never**
  `permission-denied` (the bug this work started from);
- the listener still succeeding when a `removed` friendship exists;
- every forgery in the table at the top of this document;
- a blocked user being unable to discover that they were blocked;
- non-friends being unable to read prayer history, and removed friends losing it;
- nobody but the owner reading `users/{uid}/private/tokens`;
- and — the opposite failure mode — **every real client payload being accepted**, so
  that tightening a key allowlist cannot silently break a live write path.

`__tests__/salahStreak.test.ts` covers the streak state machine and
asserts the app and `functions/` copies of the math have identical function bodies.

---

## Deploy

Only rules and indexes deploy on Spark. There are no functions to push.

```bash
firebase login
npm run deploy:firestore          # rules + indexes
```

Or separately: `npm run deploy:rules`, `npm run deploy:indexes`.

**Deploy indexes before rules**, and let index builds finish before the new rules go
live — the friends listener requires the `friendships` composite index, and a query
against a still-building index fails with `failed-precondition`.

### Deploy order — this matters

**Deploy rules and indexes BEFORE releasing the app update.** Both directions were
tested against the emulator:

| | Result |
|---|---|
| **Old app + new rules** | ✅ Works. The rules deliberately still accept the legacy `fcmToken` / `fcmTokens` / `platform` / `lastTokenUpdate` keys on `users/{uid}`. Without that allowance the old `ensureProfile()` throws on denial, no profile is created, and the feature dies for everyone who hasn't updated — a live outage for the length of the rollout. |
| **New app + old rules** | ⚠️ Degraded. Partner prayer reads are denied, so friend today-counts show `0/5` and the detail calendar renders partial. Nothing crashes, but it looks broken. |

So: **indexes → rules → app release.** Let index builds finish before the rules go
live; the friends listener needs the `friendships` composite index, and querying a
still-building index fails with `failed-precondition`.

The legacy-key allowance in `firestore.rules` is marked TRANSITIONAL with removal
criteria. Drop it once telemetry shows no meaningful traffic from app ≤ 1.3.0;
`tests/rules/prayers.test.js` has a `backward compatibility` block to delete with it.
Updated clients already migrate their tokens to `users/{uid}/private/tokens` and
delete the public copies on next launch.

Existing `invites/*` documents carry a `Timestamp` rather than epoch-millis
`expiresAt`. Handled: readers normalize both, and the friendship-create rule
deliberately does not check invite expiry (it checks `fromUid` + `status`, the
property that actually matters) so old codes keep working.

## Acceptance checklist

Run with two anonymous users against the emulator.

1. Fresh user opens **Friends** → empty state, no error banner.
2. Log 3 prayers with **zero** friends → the header reads `3/5`.
3. A creates an invite → B opens `/invite/{CODE}` → accept → each appears in the
   other's list with the correct name and today-count.
4. Both log all 5 for the same local date → shared streak becomes exactly **1**;
   revisiting the screen leaves it at 1.
5. Skip a day, then complete the next → streak resets to 1, `longestStreak` unchanged.
6. Drive `currentStreak` to 7 → milestone awarded once; re-syncing does not re-award.
7. Let a streak lapse two days → 💔 badge appears, and stops showing after 24h.
8. `npm run test:rules` → every forged write denied.
9. Airplane mode → the tracker still logs locally; no unhandled rejections.

### Manual deep-link test

```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "sukoon://invite/ABC234" com.sukoon.app
```

---

## Moving to Blaze

If billing is ever upgraded, the cutover is mechanical:

1. `firebase deploy --only functions` — `functions/` already compiles and passes tests.
2. In `firestore.rules`, change the `friendships` and `invites` **write** rules to
   `allow write: if false;`. The read rules stay as they are.
3. Delete the mutation methods in `lib/inviteService.ts` and the sync call
   in `lib/salah/pairStreak.ts`, and route the screens back through
   `lib/firebaseFunctions.ts`, which is kept intact for exactly this.
4. Drop `viaInvite` from the friendship create path — the server no longer needs the
   client to prove it holds a code.
5. FCM push starts working, which re-enables the milestone and streak-broken
   notifications in `functions/src/notifications.ts`.

Nothing in the current design forecloses this. The streak math is already shared
(byte-identical function bodies, enforced by a test), and the data model is unchanged.

---

## Known gaps

- **No push notifications.** Impossible without a trusted server. Local
  `expo-notifications` reminders are the available substitute and are not yet wired
  to streak events.
- **Streak breaks are evaluated lazily**, when a member next opens the app, rather
  than on a schedule. A pair who both stop opening Sukoon will see a stale streak
  until one of them returns.
- **`ShareStreakSheet` doesn't actually message the chosen friend** — it opens the OS
  share sheet with a generic message, ignoring `friendUid`.
- **Urdu strings for the new error taxonomy are unreviewed** by a native speaker.
- **Localization scope** is still limited to the Salah Buddy screens; the tracker
  itself (`app/tools/salah-tracker.tsx`) predates `lib/i18n.ts` and is English-only.
- **Google sign-in** remains deferred; anonymous uids persist across reinstall via
  Keychain/Keystore, so friendships survive, but not across a device change.
