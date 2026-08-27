/**
 * streakSweep — scheduled hourly job that breaks streaks where at least one
 * full local day has elapsed since the last shared SDC.
 *
 * Why hourly: at-risk windows are timezone-bound. The slowest acceptable cadence
 * across all global timezones is 1h (24 / 24 = each timezone gets at least one
 * sweep per hour). Cheaper alternatives (12h, 24h) would let streaks linger
 * spuriously alive for hours after the partner missed the day.
 *
 * Algorithm per pair:
 *   1. For each user in the pair, compute their current local date.
 *   2. Use the EARLIER of the two dates as the "slowerToday" bound — that's the
 *      user who is still in the prior day; whichever one of the two had less
 *      time elapsed.
 *      Wait — re-read spec: "scheduled sweep handles this. The shared streak
 *      only advances after the LATER of the two has completed their local day."
 *      For BREAKING: we want to know whether any whole day has passed without
 *      a shared SDC. The fairest reading is to use the EARLIER user's "today"
 *      (the one who has had less time to accumulate) as the lower bound — if
 *      even that user is now ≥ 2 days past lastStreakDate, both have missed.
 *   3. If shouldBreakStreak(lastStreakDate, slowerToday), zero out + emit
 *      streak_broken for both, AND remember it on the friendship for 24h so
 *      the client can show the 💔 icon.
 *
 * NB: we DO NOT break a streak when only the latest day is incomplete and the
 * slower user is still in that same day — partner may yet complete it.
 *
 * Performance: friendships index is (status, lastStreakDate). We page through
 * active ones in order; pairs with null lastStreakDate (streak=0) are skipped
 * cheaply because shouldBreakStreak returns false.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, FieldValue, Timestamp } from './admin';
import { localDateKey } from './dates';
import { shouldBreakStreak } from './streakMath';
import { dispatchNotification } from './notifications';
import { FriendshipDoc } from './types';

const PAGE_SIZE = 200;

export const streakSweep = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const now = new Date();
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let total = 0, broken = 0;

    while (true) {
      let q = db.collection('friendships')
        .where('status', '==', 'active')
        .orderBy('lastStreakDate')
        .limit(PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const page = await q.get();
      if (page.empty) break;

      for (const doc of page.docs) {
        total++;
        const f = doc.data() as FriendshipDoc;
        if (!f.lastStreakDate || f.currentStreak === 0) continue;

        const userDocs = await db.getAll(
          db.collection('users').doc(f.users[0]),
          db.collection('users').doc(f.users[1]),
        );
        const tzs = userDocs.map(u => (u.get('timezone') as string | undefined) ?? 'UTC');
        const todays = tzs.map(tz => localDateKey(now, tz));

        // EARLIER local date = user who is still in the prior calendar day.
        // We use Math.min over date strings (ISO YYYY-MM-DD sorts lexicographically).
        const slowerToday = todays[0] < todays[1] ? todays[0] : todays[1];

        if (!shouldBreakStreak(f.lastStreakDate, slowerToday)) continue;

        await doc.ref.update({
          currentStreak: 0,
          lastBrokenAt: Timestamp.now(),
          lastBrokenStreak: f.currentStreak,
          lastUpdatedAt: FieldValue.serverTimestamp(),
        });
        broken++;

        await Promise.all(f.users.map(uid =>
          dispatchNotification({
            uid,
            type: 'streak_broken',
            title: '💔 Streak ended',
            body: `Your ${f.currentStreak}-day shared streak just broke. Start a new one tonight.`,
            payload: { pairId: doc.id, brokenStreak: f.currentStreak },
          }).catch(err => console.warn('[streakSweep] notify failed:', err))
        ));
      }

      lastDoc = page.docs[page.docs.length - 1];
      if (page.size < PAGE_SIZE) break;
    }

    console.log(`[streakSweep] scanned=${total} broken=${broken}`);
  },
);
