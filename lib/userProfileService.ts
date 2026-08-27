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
 * PRIVACY: users/{uid} is readable by any signed-in user, because the invite-accept
 * screen must show the inviter's name before any friendship exists. Firestore rules
 * cannot project fields on read, so this document must contain ONLY public profile
 * data. FCM registration tokens therefore live in users/{uid}/private/tokens, which
 * is owner-only; ensureProfile() migrates them out of any legacy `fcmToken` /
 * `fcmTokens` field it finds here.
 *
 * The rules enforce an exact key allowlist on writes, so adding a field to this
 * document without also updating firestore.rules will fail the write outright.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, getAuth, isFirebaseConfigured, authReady } from './firebaseConfig';

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

/** Owner-only document holding this user's FCM registration tokens. */
export const PRIVATE_TOKENS_DOC = 'tokens';

/**
 * Move FCM tokens out of the world-readable profile document and into
 * users/{uid}/private/tokens.
 *
 * Older builds wrote `fcmToken` (string) and later `fcmTokens` (array) directly onto
 * users/{uid}, which any signed-in user could read. A leaked registration token lets
 * someone send spoofed pushes to that device, so it does not belong in a public doc.
 *
 * Runs at most once per device per legacy field: after the delete there is nothing
 * left to migrate. Non-throwing by design — the caller treats it as best-effort.
 */
async function migrateTokensToPrivate(
  db: any,
  uid: string,
  data: Record<string, any>,
): Promise<void> {
  const legacy: string[] = [];
  if (typeof data.fcmToken === 'string' && data.fcmToken.length > 0) legacy.push(data.fcmToken);
  if (Array.isArray(data.fcmTokens)) {
    data.fcmTokens.forEach((t: unknown) => {
      if (typeof t === 'string' && t.length > 0) legacy.push(t);
    });
  }

  const hasLegacyFields = 'fcmToken' in data || 'fcmTokens' in data;
  if (!hasLegacyFields) return;

  const firestore = await import('@react-native-firebase/firestore');
  const FieldValue = firestore.default.FieldValue;

  if (legacy.length > 0) {
    await db.collection('users').doc(uid).collection('private').doc(PRIVATE_TOKENS_DOC)
      .set({ fcmTokens: FieldValue.arrayUnion(...legacy) }, { merge: true });
  }

  // Clear the public copies. The rules' key allowlist rejects these fields on any
  // future write, so this is the last time they can appear.
  await db.collection('users').doc(uid).update({
    fcmToken: FieldValue.delete(),
    fcmTokens: FieldValue.delete(),
  });
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
    // Await auth instead of reading currentUser synchronously — on a cold start
    // anonymous sign-in has typically not resolved yet, and every write below
    // needs request.auth to be populated or the rules reject it.
    const uid = await authReady();
    const db = await getFirestore();
    if (!uid || !db) return null;

    const auth = await getAuth();
    const user = auth?.currentUser ?? null;

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
      // Exactly the keys firestore.rules allows on this document — no fcmTokens.
      await ref.set({
        displayName,
        photoURL,
        inviteCode: null,
        timezone: tz,
        createdAt: Date.now(),
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

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }

    // Relocate any tokens left in the public document by an older build. Best
    // effort and non-fatal: failing to move a token costs a push, not the profile.
    await migrateTokensToPrivate(db, uid, data).catch(() => {});

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

};

export default UserProfileService;
