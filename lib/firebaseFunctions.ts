/**
 * Lightweight wrapper around @react-native-firebase/functions for the four
 * Sukoon callables. We dynamic-import to avoid the native module crash when
 * the host is Expo Go (or any env without native Firebase).
 *
 * We keep this in a tiny module so the rest of the client doesn't need to know
 * the SDK shape — it just calls FirebaseFunctions.callX(args) and gets typed results.
 */

import { isFirebaseConfigured, hasNativeFirebaseModules } from './firebaseConfig';

let cachedFunctions: any = null;
let triedLoad = false;

/**
 * Lazy + dual-gated import of @react-native-firebase/functions.
 *
 * The Functions module loads its sibling app module at import time, which crashes
 * in Expo Go (no RNFBAppModule). We MUST check native availability BEFORE the
 * dynamic import, otherwise just touching the module evaluates it and throws.
 */
async function getFunctions(): Promise<any | null> {
  if (cachedFunctions) return cachedFunctions;
  if (triedLoad) return null;
  if (!isFirebaseConfigured() || !hasNativeFirebaseModules()) {
    triedLoad = true;
    return null;
  }
  try {
    const mod = await import('@react-native-firebase/functions');
    cachedFunctions = mod.default();
    triedLoad = true;
    return cachedFunctions;
  } catch (err) {
    if (__DEV__) console.warn('[FirebaseFunctions] unavailable:', err);
    triedLoad = true;
    return null;
  }
}

export interface CreateInviteResult { code: string }
export interface AcceptInviteResult { pairId: string; alreadyFriends: boolean }
export interface SimpleOkResult { ok: boolean }

async function call<TIn extends object, TOut>(name: string, args: TIn): Promise<TOut> {
  const fns = await getFunctions();
  if (!fns) throw new Error('FUNCTIONS_UNAVAILABLE');
  const callable = fns.httpsCallable(name);
  const res = await callable(args);
  return res.data as TOut;
}

export const FirebaseFunctions = {
  createInvite: () => call<{}, CreateInviteResult>('createInvite', {}),
  acceptInvite: (code: string) =>
    call<{ code: string }, AcceptInviteResult>('acceptInvite', { code }),
  removeFriend: (otherUid: string) =>
    call<{ otherUid: string }, SimpleOkResult>('removeFriend', { otherUid }),
  blockFriend: (otherUid: string) =>
    call<{ otherUid: string }, SimpleOkResult>('blockFriend', { otherUid }),
};

export default FirebaseFunctions;
