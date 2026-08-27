# `lib/salah` — Salah Buddy shared-streak logic

The client half of the friend-streak feature. Read `SALAH_BUDDY.md` at the repo
root for the deploy/verify guide and the data model.

| File | Role |
|---|---|
| `dates.ts` | Timezone-aware local-date keys. **Mirror of `functions/src/dates.ts`.** |
| `streakMath.ts` | Pure streak state machine. **Mirror of `functions/src/streakMath.ts`.** |
| `pairStreak.ts` | The engine: reads both members' day docs, commits advances and breaks. |
| `prayerKeys.ts` | The single home of the `zuhr` (local) ↔ `dhuhr` (Firestore) mapping. |
| `todayCount.ts` | The user's own X/5 today, read from the local tracker. |
| `errors.ts` | Firebase error code → localized message + retryability. |

## Why the streak math is duplicated

`functions/` and `Sukoon-App/` are separate packages that cannot import from each
other. The project is on the **Spark** plan, so the Cloud Functions are undeployable
and `pairStreak.ts` runs the engine on the client instead; `functions/` stays in the
repo, compiling and tested, as the Blaze path.

Both copies must agree, or a billing upgrade would silently change how existing
users' streaks are computed. `__tests__/salahStreak.test.ts` compares the function
bodies of both copies and fails the build if they drift. **Edit both, or neither.**

## The one rule, stated once

> A day `D` counts for a pair when **both** members have `prayers/{uid}/days/D` with
> `prayerCount == 5`, where each member writes `D` as their **own** local date.

Two friends in different timezones therefore compare date *strings*, never instants —
a shared *day*, not a shared *moment*. Karachi's Tuesday and New York's Tuesday
overlap only partially in real time, but they are the same key, so both devices
converge on the same streak value.

Breaking is judged against whichever member is **further behind**, so a partner who
still has hours left in their local day keeps the streak alive.

## Trust model

`pairStreak.ts` computes a transition; `firestore.rules` independently re-derives it
from the same day documents and rejects any write that disagrees. The client is not
trusted — it is merely the thing that proposes. A client that computes the wrong
answer does not corrupt data, it just fails to write.

Milestone thresholds are defined in **three** places that must stay in sync:
`streakMath.ts` (`STREAK_MILESTONES`), `functions/src/types.ts`, and the
`milestones()` helper in `firestore.rules`. The rules reject any milestone value
outside that set, so adding one in a single place makes the award fail to write.
