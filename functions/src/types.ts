/**
 * Shared type definitions for Sukoon Salah Buddy backend.
 * Mirrors the data model in the Phase 0 spec; the client uses identical shapes
 * (re-declared in `lib/friendsService.ts` to avoid coupling client to admin SDK).
 */

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export const PRAYER_KEYS: readonly PrayerKey[] = [
  'fajr', 'dhuhr', 'asr', 'maghrib', 'isha',
] as const;

export interface PrayerEntry {
  logged: boolean;
  loggedAt: FirebaseFirestore.Timestamp | null;
}

export interface PrayerDayDoc {
  date: string;            // YYYY-MM-DD in user's local timezone
  fajr: PrayerEntry;
  dhuhr: PrayerEntry;
  asr: PrayerEntry;
  maghrib: PrayerEntry;
  isha: PrayerEntry;
  prayerCount: number;     // 0..5 (computed server-side; clients may write but server overwrites)
  completedAt: FirebaseFirestore.Timestamp | null;
  timezone?: string;       // IANA tz the date string was computed in
  updatedAt: FirebaseFirestore.Timestamp;
}

export type FriendshipStatus = 'active' | 'blocked' | 'removed';

export interface FriendshipDoc {
  users: [string, string]; // sorted ascending
  status: FriendshipStatus;
  initiatedBy: string;
  acceptedAt: FirebaseFirestore.Timestamp | null;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null; // YYYY-MM-DD of last shared SDC (in initiator's tz convention)
  milestonesAchieved: number[];
  createdAt: FirebaseFirestore.Timestamp;
  blockedBy?: string;            // present iff status === 'blocked'
  removedBy?: string;            // present iff status === 'removed'
}

export type InviteStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface InviteDoc {
  code: string;
  fromUid: string;
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  usedByUid: string | null;
  status: InviteStatus;
}

export interface UserDoc {
  displayName: string;
  photoURL: string;
  inviteCode: string;
  timezone: string;
  createdAt: FirebaseFirestore.Timestamp;
  fcmTokens: string[];
}

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'streak_at_risk'
  | 'streak_milestone'
  | 'streak_broken';

export interface NotificationDoc {
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

export const STREAK_MILESTONES: readonly number[] = [7, 30, 100, 365] as const;
// Multi-use invite links are meant to be shared widely and kept around, so we
// give them a long life (1 year) rather than the original single-use 7 days.
export const INVITE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
