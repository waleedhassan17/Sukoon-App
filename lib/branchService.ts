/**
 * BranchService — wrapper around `react-native-branch` for invite deep links.
 *
 * Why Branch (per Phase 0 decision): Firebase Dynamic Links shut down in Aug 2025
 * and we don't own a domain for self-hosted App Links. Branch's free tier handles
 * deferred install attribution out of the box, which is exactly what the
 * "tap link → install → see Accept Invitation screen on first launch" flow needs.
 *
 * This module is GUARDED — if `react-native-branch` isn't installed (Expo Go /
 * dev), every method returns a graceful fallback so the rest of the app still works.
 *
 * To install for production:
 *   1. expo install react-native-branch
 *   2. Add to app.json plugins: ['react-native-branch', { apiKey: '<key>' }]
 *   3. Configure Branch dashboard with bundle IDs com.sukoon.app + iOS counterpart.
 *   4. Provide native Branch keys (Android manifest placeholders already exist).
 *   5. Set `EXPO_PUBLIC_BRANCH_ENABLED=true` at bundle time to turn Branch on.
 */

import { Linking, NativeModules } from 'react-native';

let cachedBranch: any = null;
let triedLoad = false;

function readEnvString(key: string): string {
  try {
    const v = (globalThis as any)?.process?.env?.[key];
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

/**
 * Branch can hard-crash at runtime if the native SDK is linked but the Branch
 * keys are missing/empty (common in local debug builds). We only enable Branch
 * if the build explicitly opts in via env.
 */
function shouldUseBranch(): boolean {
  if (!NativeModules?.RNBranch) return false;

  const enabledFlag = readEnvString('EXPO_PUBLIC_BRANCH_ENABLED').trim().toLowerCase();
  if (enabledFlag === 'true') return true;
  return false;
}

/**
 * Branch's JS entry calls into its native bridge at module-load time
 * (e.g. it reads RNBranch.STANDARD_EVENT_ADD_TO_CART). When the native module
 * isn't linked — Expo Go, or a custom dev client without `expo prebuild` —
 * `require('react-native-branch')` throws synchronously.
 *
 * We gate on the presence of `NativeModules.RNBranch` BEFORE requiring, so the
 * dev environment never even evaluates the package. The deep-link fallback via
 * the `sukoon://` URL scheme + `Linking` keeps the invite flow fully working.
 */
function loadBranch(): any | null {
  if (cachedBranch) return cachedBranch;
  if (triedLoad) return null;
  triedLoad = true;
  try {
    if (!shouldUseBranch()) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-branch');
    cachedBranch = mod?.default ?? mod;
    return cachedBranch;
  } catch {
    return null;
  }
}

export interface InviteLinkPayload {
  code: string;
  inviterDisplayName: string;
  inviterPhotoURL: string;
}

/** Result handed to a deep-link listener. */
export interface DeepLinkInvite {
  code: string;
  inviterDisplayName?: string;
  inviterPhotoURL?: string;
}

export type DeepLinkListener = (invite: DeepLinkInvite) => void;

const FALLBACK_HOST = 'https://sukoon-b36b4.web.app/invite'; // Static page that 302→Play Store and exposes ?code=
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sukoon.app';

export const BranchService = {
  /**
   * Generate a shareable URL containing the invite code. Tries Branch first
   * for deferred install attribution; falls back to a hand-built URL with
   * Play Store fallback as a query param.
   */
  async createInviteLink(payload: InviteLinkPayload): Promise<string> {
    const branch = loadBranch();
    if (branch) {
      try {
        const buo = await branch.createBranchUniversalObject(`invite/${payload.code}`, {
          title: `${payload.inviterDisplayName} invited you to Sukoon`,
          contentDescription:
            'Pray your 5 daily Salah together and watch the streak grow.',
          contentImageUrl: payload.inviterPhotoURL,
          contentMetadata: {
            customMetadata: {
              code: payload.code,
              inviterDisplayName: payload.inviterDisplayName,
              inviterPhotoURL: payload.inviterPhotoURL,
            },
          },
        });
        const linkProps = { feature: 'salah-buddy', channel: 'share' };
        const controlParams = {
          $fallback_url: PLAY_STORE_URL,
          $android_url: PLAY_STORE_URL,
          $desktop_url: FALLBACK_HOST,
          code: payload.code,
        };
        const { url } = await buo.generateShortUrl(linkProps, controlParams);
        return url;
      } catch {
        // Fall through to the static fallback below.
      }
    }
    // Static fallback — WhatsApp requires an https:// link to be clickable.
    // We use your Firebase project URL. You MUST deploy the hosting for this to work.
    return `https://sukoon-b36b4.web.app/invite?code=${encodeURIComponent(payload.code)}`;
  },

  /**
   * Subscribe to incoming deep links — both Branch's deferred-link callback and
   * the system Linking event for the `sukoon://` scheme. Returns teardown.
   */
  subscribe(listener: DeepLinkListener): () => void {
    const teardowns: (() => void)[] = [];
    const branch = loadBranch();

    if (branch) {
      try {
        const unsub = branch.subscribe(({ params }: any) => {
          if (!params) return;
          // Branch surfaces `+clicked_branch_link=true` on the first install/open.
          const code = params.code ?? params['code'];
          if (typeof code === 'string' && code.length === 6) {
            listener({
              code: code.toUpperCase(),
              inviterDisplayName: params.inviterDisplayName,
              inviterPhotoURL: params.inviterPhotoURL,
            });
          }
        });
        teardowns.push(() => { try { unsub?.(); } catch {} });
      } catch {
        // Branch failed to subscribe — fall back to plain Linking only.
      }
    }

    // Always also listen on the sukoon:// custom scheme as a backup
    // (handles the case where the user pastes the code or opens via push).
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const code = extractCodeFromUrl(url);
      if (code) listener({ code });
    };

    const sub = Linking.addEventListener('url', (e: { url: string }) => handleUrl(e.url));
    teardowns.push(() => sub.remove());

    Linking.getInitialURL().then(handleUrl).catch(() => {});

    return () => teardowns.forEach(fn => fn());
  },
};

function extractCodeFromUrl(url: string): string | null {
  try {
    // Match query param `?code=ABC123` or path `/invite/ABC123`.
    const codeParam = /[?&]code=([A-Z0-9]{6})/i.exec(url);
    if (codeParam) return codeParam[1].toUpperCase();
    const pathParam = /\/invite\/([A-Z0-9]{6})(?:[/?#]|$)/i.exec(url);
    if (pathParam) return pathParam[1].toUpperCase();
    return null;
  } catch {
    return null;
  }
}

export default BranchService;
