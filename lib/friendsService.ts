/**
 * FriendsService — client-side gateway for the friend-streak feature.
 *
 * Reads:
 *   - subscribeToFriends(): real-time listener over the caller's ACTIVE friendships.
 *   - getFriendDetail(): one-shot read of a friendship, the partner profile and the
 *     last 14 days of both members' prayer counts.
 *
 * Writes: none. Friendship and invite mutations live in ./inviteService.ts, and
 * streak transitions in ./salah/pairStreak.ts. Both are client-issued (the project
 * is on the Spark plan, so there are no deployable Cloud Functions) and both are
 * validated by firestore.rules, which re-derives every streak transition from the
 * two members' own prayer documents before accepting it.
 */

import { getFirestore, isFirebaseConfigured, authReady } from './firebaseConfig';
import { UserProfileService, PublicUserProfile } from './userProfileService';
import { localDateKey } from './salah/dates';
import { pairIdOf } from './salah/streakMath';

export type FriendshipStatus = 'active' | 'blocked' | 'removed';

export interface FriendshipSummary {
  pairId: string;
  users: [string, string];
  partnerUid: string;
  status: FriendshipStatus;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  milestonesAchieved: number[];
  acceptedAt: number | null;       // ms
  lastBrokenAt: number | null;     // ms (24h window for the 💔 badge)
  lastBrokenStreak: number;
  blockedBy?: string;
}

export interface FriendListEntry extends FriendshipSummary {
  partner: PublicUserProfile;
  todayCountSelf: number;
  todayCountPartner: number;
}

export interface FriendDetail extends FriendshipSummary {
  partner: PublicUserProfile;
  /**
   * The date keys the maps below are keyed by, OLDEST FIRST — ready to render as a
   * calendar strip. Returned rather than recomputed by the caller: both members'
   * days are indexed in the VIEWER's timezone, and a caller that rebuilt the keys
   * from, say, the partner's timezone would look up keys that aren't in the maps and
   * render every day as incomplete.
   */
  dateKeys: string[];
  /** date key → prayer count. Days with no document are absent. */
  selfDays: Record<string, number>;
  partnerDays: Record<string, number>;
  /** True when some day reads were denied or failed — the view is partial. */
  partial: boolean;
}

type Unsubscribe = () => void;

const DEFAULT_PARTNER_NAME = 'Sukoon User';
const DETAIL_DAYS = 14;

function legacyAutoName(uid: string): string {
  return `Friend ${uid.slice(-4).toUpperCase()}`;
}

function normalizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 40);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Timestamps are stored as epoch millis throughout (see the convention note at the
 * top of firestore.rules). Older documents written before that convention still
 * carry Firestore Timestamps, so tolerate both on read.
 */
function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  return null;
}

function snapToSummary(uid: string, doc: any): FriendshipSummary | null {
  const d = doc.data();
  if (!d) return null;
  const users = d.users as [string, string];
  if (!Array.isArray(users) || users.length !== 2) return null;
  const partnerUid = users.find(u => u !== uid);
  if (!partnerUid) return null;
  return {
    pairId: doc.id,
    users,
    partnerUid,
    status: d.status,
    currentStreak: d.currentStreak ?? 0,
    longestStreak: d.longestStreak ?? 0,
    lastStreakDate: d.lastStreakDate ?? null,
    milestonesAchieved: Array.isArray(d.milestonesAchieved) ? d.milestonesAchieved : [],
    acceptedAt: toMillis(d.acceptedAt),
    lastBrokenAt: toMillis(d.lastBrokenAt),
    lastBrokenStreak: d.lastBrokenStreak ?? 0,
    blockedBy: d.blockedBy,
  };
}

function shapeProfile(uid: string, data: any): PublicUserProfile {
  const rawName = normalizeName(data?.displayName);
  // Early builds auto-named users "Friend AB12"; show the neutral default instead
  // so the invite flow's "set your name" prompt reads as the real fix.
  const cleanedName = rawName && rawName !== legacyAutoName(uid) ? rawName : null;
  return {
    uid,
    displayName: cleanedName ?? DEFAULT_PARTNER_NAME,
    photoURL: (data?.photoURL as string) ?? '',
    inviteCode: (data?.inviteCode as string | null) ?? null,
    timezone: (data?.timezone as string) ?? 'UTC',
  };
}

function fallbackProfile(uid: string): PublicUserProfile {
  return {
    uid,
    displayName: DEFAULT_PARTNER_NAME,
    photoURL: '',
    inviteCode: null,
    timezone: 'UTC',
  };
}

/** The last `n` local date keys, most recent first, in the given timezone. */
function lastNDays(n: number, timezone: string, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(localDateKey(new Date(now.getTime() - i * 86400000), timezone));
  }
  return out;
}

async function readPrayerCount(db: any, uid: string, dateKey: string): Promise<number> {
  try {
    const snap = await db.collection('prayers').doc(uid).collection('days').doc(dateKey).get();
    if (!snap.exists) return 0;
    return Number(snap.get('prayerCount') ?? 0);
  } catch {
    return 0;
  }
}

export const FriendsService = {
  /**
   * Real-time list of the caller's friends. Returns a teardown function — caller
   * MUST invoke it on unmount or the listener leaks battery.
   *
   * The query is deliberately shaped so firestore.rules can authorise it wholesale:
   * `array-contains uid` proves membership and `status == 'active'` proves the
   * status branch. It used to fetch every status and filter client-side, which is
   * the "rules are not filters" mistake — a single removed friendship made the
   * whole listener fail with permission-denied.
   */
  subscribeToFriends(
    onUpdate: (entries: FriendListEntry[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      onUpdate([]);
      return () => {};
    }

    let unsub: Unsubscribe = () => {};
    let active = true;

    const profileUnsubs = new Map<string, Unsubscribe>();
    const profiles = new Map<string, PublicUserProfile>();
    const todayPartnerCounts = new Map<string, number>();
    let todaySelfCount = 0;
    let summaries: FriendshipSummary[] = [];

    const publish = () => {
      if (!active) return;
      onUpdate(summaries.map(s => ({
        ...s,
        partner: profiles.get(s.partnerUid) ?? fallbackProfile(s.partnerUid),
        todayCountSelf: todaySelfCount,
        todayCountPartner: todayPartnerCounts.get(s.partnerUid) ?? 0,
      })));
    };

    (async () => {
      try {
        // Await auth rather than reading currentUser synchronously: on a cold start
        // anonymous sign-in has usually not resolved yet, and an unauthenticated
        // read is exactly what produced the permission-denied banner.
        const uid = await authReady();
        const db = await getFirestore();
        if (!active) return;
        if (!db) { onUpdate([]); return; }
        if (!uid) {
          const err = new Error('Sign in required.') as Error & { code?: string };
          err.code = 'unauthenticated';
          onError(err);
          return;
        }

        // The caller's own IANA timezone decides which local day "today" is. Resolved
        // once here rather than per snapshot.
        const selfProfile = await UserProfileService.ensureProfile();
        const selfTimezone = selfProfile?.timezone ?? 'UTC';
        if (!active) return;

        // Ordering server-side keeps the list stable and uses the composite index
        // declared in firestore.indexes.json end-to-end.
        const query = db.collection('friendships')
          .where('users', 'array-contains', uid)
          .where('status', '==', 'active')
          .orderBy('currentStreak', 'desc');

        unsub = query.onSnapshot(
          async (snap: any) => {
            if (!active) return;

            summaries = snap.docs
              .map((doc: any) => snapToSummary(uid, doc))
              .filter((s: FriendshipSummary | null): s is FriendshipSummary => s !== null);

            const partnerUids = Array.from(new Set(summaries.map(s => s.partnerUid)));

            // Live listeners on partner profiles so a name change lands immediately.
            const desired = new Set(partnerUids);
            for (const [puid, off] of profileUnsubs) {
              if (!desired.has(puid)) {
                off();
                profileUnsubs.delete(puid);
                profiles.delete(puid);
                todayPartnerCounts.delete(puid);
              }
            }

            for (const puid of partnerUids) {
              if (profileUnsubs.has(puid)) continue;
              const off = db.collection('users').doc(puid).onSnapshot(
                (docSnap: any) => {
                  const d = typeof docSnap.data === 'function' ? docSnap.data() : (docSnap.data ?? {});
                  profiles.set(puid, shapeProfile(puid, d));
                  publish();
                },
                () => {
                  // Keep the last known profile; a transient profile read failure
                  // shouldn't blank out a friend's name.
                },
              );
              profileUnsubs.set(puid, off);
            }

            // Today's counts drive the list rows. The header's self-count is read
            // from the local tracker instead, so it stays correct with zero friends.
            //
            // `selfTimezone` is resolved once outside this callback: `profiles` only
            // ever holds PARTNER profiles, so looking the caller up in it always
            // missed and silently fell back to UTC — which reads yesterday's counts
            // for anyone east of Greenwich during their early morning.
            const todayKey = localDateKey(new Date(), selfTimezone);
            const [selfCount, partnerCounts] = await Promise.all([
              readPrayerCount(db, uid, todayKey),
              Promise.all(partnerUids.map(async puid =>
                [puid, await readPrayerCount(db, puid, todayKey)] as const)),
            ]);
            if (!active) return;
            todaySelfCount = selfCount;
            partnerCounts.forEach(([puid, c]) => todayPartnerCounts.set(puid, c));

            publish();
          },
          (err: Error) => onError(err),
        );

        // The caller may have torn down while we were awaiting auth.
        if (!active) unsub();
      } catch (err) {
        onError(err as Error);
      }
    })();

    return () => {
      active = false;
      unsub();
      for (const [, off] of profileUnsubs) off();
      profileUnsubs.clear();
    };
  },

  /**
   * One-shot read backing the friend-detail screen: the friendship, the partner's
   * profile, and 14 days of both members' prayer counts.
   *
   * Partner day reads are settled individually. They were previously issued under a
   * bare Promise.all, so a single denied read rejected the whole batch and blanked
   * the screen — which is exactly what happened before the rules allowed friends to
   * read each other's days at all. Partial data with a `partial` flag is far more
   * useful than an error page.
   */
  async getFriendDetail(partnerUid: string): Promise<FriendDetail | null> {
    const uid = await authReady();
    const db = await getFirestore();
    if (!uid || !db) return null;
    if (partnerUid === uid) return null;

    const pairId = pairIdOf(uid, partnerUid);

    const [friendshipSnap, partnerProfile] = await Promise.all([
      db.collection('friendships').doc(pairId).get(),
      UserProfileService.readPublicProfile(partnerUid),
    ]);

    if (!friendshipSnap.exists) return null;
    const summary = snapToSummary(uid, friendshipSnap);
    if (!summary) return null;

    // Both calendars are rendered against the viewer's own timezone so the two
    // columns line up; each member's underlying day docs are keyed by their own.
    const selfProfile = await UserProfileService.ensureProfile();
    const keys = lastNDays(DETAIL_DAYS, selfProfile?.timezone ?? 'UTC');

    const readAll = async (targetUid: string) => {
      const results = await Promise.allSettled(
        keys.map(k => db.collection('prayers').doc(targetUid).collection('days').doc(k).get()),
      );
      const out: Record<string, number> = {};
      let failures = 0;
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') { failures++; return; }
        const snap: any = r.value;
        if (snap.exists) out[keys[i]] = Number(snap.get('prayerCount') ?? 0);
      });
      return { days: out, failures };
    };

    const [selfRead, partnerRead] = await Promise.all([
      readAll(uid),
      readAll(partnerUid),
    ]);

    return {
      ...summary,
      partner: partnerProfile ?? fallbackProfile(partnerUid),
      dateKeys: keys.slice().reverse(), // oldest first, for the calendar strip
      selfDays: selfRead.days,
      partnerDays: partnerRead.days,
      partial: selfRead.failures > 0 || partnerRead.failures > 0,
    };
  },

  /** Read the caller's `users/{uid}.inviteCode`. Used by the Invites tab. */
  async getOwnInviteCode(): Promise<string | null> {
    const profile = await UserProfileService.ensureProfile();
    return profile?.inviteCode ?? null;
  },
};

export default FriendsService;
