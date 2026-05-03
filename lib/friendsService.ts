/**
 * FriendsService — client-side gateway for the friend-streak feature.
 *
 * Reads:
 *   - subscribeToFriends(): real-time listener over friendships where uid in users[]
 *     and status='active' (or status='blocked' AND blockedBy==self).
 *   - getFriendDetail(): one-shot read of a single friendship + the partner profile.
 *
 * Writes:
 *   - All friendship/invite mutations go through Cloud Functions callables
 *     (`@/lib/firebaseFunctions.ts`). Clients never write these collections directly.
 *
 * This service is intentionally thin — it knows how to wire Firestore queries to
 * React-friendly subscriptions (returning a teardown function) and how to
 * shape data for the UI (`FriendListEntry`).
 */

import { getAuth, getFirestore, isFirebaseConfigured } from './firebaseConfig';
import { UserProfileService, PublicUserProfile } from './userProfileService';

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
  lastBrokenAt: number | null;     // ms (24h window for 💔 badge)
  lastBrokenStreak: number;
  blockedBy?: string;
}

export interface FriendListEntry extends FriendshipSummary {
  partner: PublicUserProfile;
  todayCountSelf: number;
  todayCountPartner: number;
}

type Unsubscribe = () => void;

const DEFAULT_PARTNER_NAME = 'Sukoon User';

function legacyAutoName(uid: string): string {
  return `Friend ${uid.slice(-4).toUpperCase()}`;
}

function normalizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 40);
  return trimmed.length > 0 ? trimmed : null;
}

function todayLocalKey(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
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
    acceptedAt: d.acceptedAt?.toMillis ? d.acceptedAt.toMillis() : null,
    lastBrokenAt: d.lastBrokenAt?.toMillis ? d.lastBrokenAt.toMillis() : null,
    lastBrokenStreak: d.lastBrokenStreak ?? 0,
    blockedBy: d.blockedBy,
  };
}

export const FriendsService = {
  /**
   * Real-time list of the caller's friends. Returns a teardown function — caller
   * MUST invoke it on screen unmount or the listener leaks battery.
   *
   * Hydrates each entry with the partner's public profile and today's prayer counts.
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

    const fallbackProfile = (uid: string): PublicUserProfile => ({
      uid,
      displayName: DEFAULT_PARTNER_NAME,
      photoURL: '',
      inviteCode: null,
      timezone: 'UTC',
    });

    const publish = () => {
      if (!active) return;
      const entries: FriendListEntry[] = summaries.map(s => ({
        ...s,
        partner: profiles.get(s.partnerUid) ?? fallbackProfile(s.partnerUid),
        todayCountSelf: todaySelfCount,
        todayCountPartner: todayPartnerCounts.get(s.partnerUid) ?? 0,
      }));

      entries.sort((a, b) =>
        b.currentStreak - a.currentStreak
        || a.partner.displayName.localeCompare(b.partner.displayName));

      onUpdate(entries);
    };

    (async () => {
      try {
        const auth = await getAuth();
        const db = await getFirestore();
        if (!auth || !db) { onUpdate([]); return; }
        const uid = auth.currentUser?.uid;
        if (!uid) { onUpdate([]); return; }

        const query = db.collection('friendships')
          .where('users', 'array-contains', uid);

        unsub = query.onSnapshot(
          async (snap: any) => {
            if (!active) return;

            const nextSummaries: FriendshipSummary[] = [];
            snap.docs.forEach((doc: any) => {
              const s = snapToSummary(uid, doc);
              if (!s) return;
              // Visibility mirror of firestore.rules:
              if (s.status === 'active') nextSummaries.push(s);
              else if (s.status === 'blocked' && s.blockedBy === uid) nextSummaries.push(s);
            });

            summaries = nextSummaries;
            const partnerUids = Array.from(new Set(summaries.map(s => s.partnerUid)));

            // Keep live listeners to partner profiles so name changes reflect immediately.
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

                  const rawName = normalizeName(d.displayName);
                  const cleanedName = rawName && rawName !== legacyAutoName(puid)
                    ? rawName
                    : null;

                  profiles.set(puid, {
                    uid: puid,
                    displayName: cleanedName ?? DEFAULT_PARTNER_NAME,
                    photoURL: (d.photoURL as string) ?? '',
                    inviteCode: (d.inviteCode as string | null) ?? null,
                    timezone: (d.timezone as string) ?? 'UTC',
                  });
                  publish();
                },
                () => {
                  // ignore; we keep the last known profile
                },
              );
              profileUnsubs.set(puid, off);
            }

            // Refresh today's counts (used by header and list items)
            const todayKey = todayLocalKey();
            const [selfCount, partnerCounts] = await Promise.all([
              readPrayerCount(db, uid, todayKey),
              Promise.all(partnerUids.map(async puid => [puid, await readPrayerCount(db, puid, todayKey)] as const)),
            ]);
            todaySelfCount = selfCount;
            partnerCounts.forEach(([puid, c]) => todayPartnerCounts.set(puid, c));

            publish();
          },
          (err: Error) => onError(err),
        );
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

  /** Read the caller's `users/{uid}.inviteCode`. Used by the Invites tab. */
  async getOwnInviteCode(): Promise<string | null> {
    const profile = await UserProfileService.ensureProfile();
    return profile?.inviteCode ?? null;
  },
};

async function readPrayerCount(db: any, uid: string, dateKey: string): Promise<number> {
  try {
    const snap = await db.collection('prayers').doc(uid).collection('days').doc(dateKey).get();
    if (!snap.exists) return 0;
    return Number(snap.get('prayerCount') ?? 0);
  } catch {
    return 0;
  }
}

export default FriendsService;
