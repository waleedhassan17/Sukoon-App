/**
 * UserProfileService — manages the public-facing profile document at users/{uid}.
 *
 * Responsibilities:
 *   - Ensure the profile doc exists on app start (one-shot upsert).
 *   - Keep `timezone` in sync with the device's IANA tz (rewrites if it changes,
 *     e.g. when the user travels).
 *   - Provide `displayName` / `photoURL` defaults for anonymous users so the
 *     friend list still has something visible.
 *
 * Backwards-compat: the existing FCMService writes a `fcmToken` (string) field;
 * we now migrate to `fcmTokens` (array). Both fields may exist temporarily; the
 * client and server prefer `fcmTokens`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, getAuth, isFirebaseConfigured } from './firebaseConfig';

const PROFILE_KEYS = {
  DISPLAY_NAME: 'sukoon_profile_display_name',
  AVATAR_SEED: 'sukoon_profile_avatar_seed',
  LAST_TZ: 'sukoon_profile_last_tz',
};

const DEFAULT_DISPLAY_NAME = 'Sukoon User';

function legacyAutoName(uid: string): string {
  return `Friend ${uid.slice(-4).toUpperCase()}`;
}

function normalizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 40);
  return trimmed.length > 0 ? trimmed : null;
}

export interface PublicUserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  inviteCode: string | null;
  timezone: string;
}

function deviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * DiceBear-style fallback avatar URL — deterministic and free; no SDK.
 * We store the seed so a user keeps the same avatar across reinstalls.
 */
function avatarFromSeed(seed: string): string {
  const safeSeed = encodeURIComponent(seed);
  return `https://api.dicebear.com/7.x/initials/png?seed=${safeSeed}&backgroundType=gradientLinear`;
}

async function ensureLocalDefaults(uid: string): Promise<{ displayName: string; photoURL: string }> {
  let displayName = await AsyncStorage.getItem(PROFILE_KEYS.DISPLAY_NAME);
  let avatarSeed = await AsyncStorage.getItem(PROFILE_KEYS.AVATAR_SEED);

  // Migrate legacy auto-name (derived from UID) to a stable non-random default.
  if (displayName && displayName.trim() === legacyAutoName(uid)) {
    displayName = null;
  }

  if (!displayName) {
    // Stable fallback — users can (and should) override in Settings.
    displayName = DEFAULT_DISPLAY_NAME;
    await AsyncStorage.setItem(PROFILE_KEYS.DISPLAY_NAME, displayName);
  }
  if (!avatarSeed) {
    avatarSeed = uid;
    await AsyncStorage.setItem(PROFILE_KEYS.AVATAR_SEED, avatarSeed);
  }
  return { displayName, photoURL: avatarFromSeed(avatarSeed) };
}

export const UserProfileService = {
  /** True when the name is a placeholder (not user-provided). */
  isLikelyAutoDisplayName(name: string | null | undefined, uid: string): boolean {
    const n = (name ?? '').trim();
    if (!n) return true;
    if (n === DEFAULT_DISPLAY_NAME) return true;
    if (n === 'Friend') return true;
    if (n === legacyAutoName(uid)) return true;
    return false;
  },

  /**
   * Idempotent upsert of the user's profile doc. Safe to call on every app start.
   * Only writes when something has actually changed (to avoid burning Firestore quota).
   */
  async ensureProfile(): Promise<PublicUserProfile | null> {
    if (!isFirebaseConfigured()) return null;
    const auth = await getAuth();
    const db = await getFirestore();
    if (!auth || !db) return null;

    const user = auth.currentUser;
    if (!user) return null;
    const uid: string = user.uid;

    let { displayName, photoURL } = await ensureLocalDefaults(uid);
    const tz = deviceTimezone();

    // Prefer Firebase Auth displayName if it exists (helps keep names consistent).
    const authName = normalizeName((user as any)?.displayName);
    if (authName && authName !== displayName) {
      displayName = authName;
      await AsyncStorage.setItem(PROFILE_KEYS.DISPLAY_NAME, displayName);
    }

    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        displayName,
        photoURL,
        inviteCode: null,
        timezone: tz,
        createdAt: Date.now(),
        fcmTokens: [],
      }, { merge: true });
      await AsyncStorage.setItem(PROFILE_KEYS.LAST_TZ, tz);
      return { uid, displayName, photoURL, inviteCode: null, timezone: tz };
    }

    const data = snap.data() ?? {};
    const updates: Record<string, unknown> = {};

    // Prefer server values when present (supports name changes from any device).
    const serverDisplayNameRaw = normalizeName(data.displayName);
    const serverDisplayName = serverDisplayNameRaw && !UserProfileService.isLikelyAutoDisplayName(serverDisplayNameRaw, uid)
      ? serverDisplayNameRaw
      : null;
    if (serverDisplayName && serverDisplayName !== displayName) {
      displayName = serverDisplayName;
      await AsyncStorage.setItem(PROFILE_KEYS.DISPLAY_NAME, displayName);
    } else if (!serverDisplayName && data.displayName !== displayName) {
      updates.displayName = displayName;
    }

    const serverPhotoURL = typeof data.photoURL === 'string' && data.photoURL.trim().length > 0
      ? String(data.photoURL).trim()
      : null;
    if (serverPhotoURL && serverPhotoURL !== photoURL) {
      photoURL = serverPhotoURL;
    } else if (!serverPhotoURL && data.photoURL !== photoURL) {
      updates.photoURL = photoURL;
    }

    if (data.timezone !== tz) updates.timezone = tz;
    // Migrate legacy single fcmToken field into fcmTokens array on first sight.
    if (typeof data.fcmToken === 'string' && Array.isArray(data.fcmTokens)) {
      if (!data.fcmTokens.includes(data.fcmToken)) {
        updates.fcmTokens = [...data.fcmTokens, data.fcmToken];
      }
    } else if (typeof data.fcmToken === 'string' && !Array.isArray(data.fcmTokens)) {
      updates.fcmTokens = [data.fcmToken];
    } else if (!Array.isArray(data.fcmTokens)) {
      updates.fcmTokens = [];
    }

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }
    await AsyncStorage.setItem(PROFILE_KEYS.LAST_TZ, tz);

    return {
      uid,
      displayName,
      photoURL,
      inviteCode: (data.inviteCode as string | null) ?? null,
      timezone: tz,
    };
  },

  async setDisplayName(name: string): Promise<void> {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    await AsyncStorage.setItem(PROFILE_KEYS.DISPLAY_NAME, trimmed);

    if (!isFirebaseConfigured()) return;
    const auth = await getAuth();
    const db = await getFirestore();
    const user = auth?.currentUser;
    if (!auth || !db || !user) return;

    try {
      // Keep Auth profile in sync when possible.
      if (typeof (user as any).updateProfile === 'function') {
        await (user as any).updateProfile({ displayName: trimmed });
      }
    } catch {
      // Non-fatal; Firestore profile is the source of truth.
    }
    await db.collection('users').doc(user.uid).set({ displayName: trimmed }, { merge: true });
  },

  /** Read another user's public profile (used for the Accept Invitation screen). */
  async readPublicProfile(uid: string): Promise<PublicUserProfile | null> {
    if (!isFirebaseConfigured() || !uid) return null;
    const db = await getFirestore();
    if (!db) return null;
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      return {
        uid,
        displayName: normalizeName(data.displayName) ?? DEFAULT_DISPLAY_NAME,
        photoURL: (data.photoURL as string) ?? avatarFromSeed(uid),
        inviteCode: (data.inviteCode as string | null) ?? null,
        timezone: (data.timezone as string) ?? 'UTC',
      };
    } catch {
      return null;
    }
  },

  /**
   * Get the user's existing invite code from their profile doc.
   * Returns null if no code exists or Firebase is unavailable.
   */
  async getExistingInviteCode(): Promise<string | null> {
    if (!isFirebaseConfigured()) return null;
    const auth = await getAuth();
    const db = await getFirestore();
    if (!auth || !db) return null;
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      return (data.inviteCode as string | null) ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Returns true if the given invite code exists in Firestore and is still active/unexpired.
   * Used by the invite screen to detect stale codes before displaying them.
   */
  async isInviteCodeActive(code: string): Promise<boolean> {
    if (!code || !isFirebaseConfigured()) return false;
    const db = await getFirestore();
    if (!db) return false;
    try {
      const snap = await db.collection('invites').doc(code).get();
      if (!snap.exists) return false;
      const data = snap.data() ?? {};
      if (data.status !== 'active') return false;
      const expiresAt = data.expiresAt;
      if (expiresAt) {
        const expiryMs = typeof expiresAt.toMillis === 'function'
          ? expiresAt.toMillis()
          : expiresAt instanceof Date ? expiresAt.getTime() : Number(expiresAt);
        if (expiryMs < Date.now()) return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Generate a local invite code and write it directly to Firestore.
   * Fallback for when Cloud Functions are unavailable (dev builds).
   * Uses the same Crockford-style charset as the Cloud Function.
   */
  async generateLocalInviteCode(): Promise<string | null> {
    if (!isFirebaseConfigured()) return null;
    const auth = await getAuth();
    const db = await getFirestore();
    if (!auth || !db) return null;
    const user = auth.currentUser;
    if (!user) return null;

    const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }

    try {
      // Revoke any existing active invites before creating a new one
      const stale = await db.collection('invites')
        .where('fromUid', '==', user.uid)
        .where('status', '==', 'active')
        .get();
      if (!stale.empty) {
        const batch = db.batch();
        stale.docs.forEach(d => batch.update(d.ref, { status: 'revoked' }));
        await batch.commit();
      }

      // Create the new invite document
      await db.collection('invites').doc(code).set({
        code,
        fromUid: user.uid,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        usedByUid: null,
        status: 'active',
      });

      // Update user profile with new code
      await db.collection('users').doc(user.uid).set({ inviteCode: code }, { merge: true });

      return code;
    } catch (e) {
      if (__DEV__) console.warn('[UserProfileService] generateLocalInviteCode error:', e);
      return null;
    }
  },
};

export default UserProfileService;
