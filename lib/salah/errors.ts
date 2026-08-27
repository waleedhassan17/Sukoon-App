/**
 * Error taxonomy for the Salah Buddy surfaces.
 *
 * Before this existed, every screen showed the raw Firebase SDK string —
 * "Missing or insufficient permissions." — under a "Tap to retry" affordance that
 * could not possibly help, because a rules rejection is not transient. Meanwhile
 * the invite-accept screen mapped every unrecognised failure to "Couldn't reach
 * the server", which told an offline user and a permission-denied user the same
 * (half-wrong) thing.
 *
 * Mapping each Firebase error code to a distinct message AND a retryability flag
 * lets the UI offer retry only where retrying is meaningful.
 */

import { t } from '../i18n';

export type FriendsErrorKind =
  | 'permissionDenied'
  | 'offline'
  | 'missingIndex'
  | 'unauthenticated'
  | 'notFound'
  | 'unknown';

export interface FriendsError {
  kind: FriendsErrorKind;
  /** Localized, user-facing text. */
  message: string;
  /** Whether a "Tap to retry" affordance should be offered. */
  retryable: boolean;
}

const MESSAGE_KEY: Record<FriendsErrorKind, string> = {
  permissionDenied: 'friends.errors.permissionDenied',
  offline: 'friends.errors.offline',
  missingIndex: 'friends.errors.missingIndex',
  unauthenticated: 'friends.errors.unauthenticated',
  notFound: 'friends.errors.notFound',
  unknown: 'common.error',
};

// Retrying only helps when the failure is transient. A rules rejection or a
// missing composite index will fail identically forever, so offering retry there
// just trains people to tap a dead button.
const RETRYABLE: Record<FriendsErrorKind, boolean> = {
  permissionDenied: false,
  offline: true,
  missingIndex: false,
  unauthenticated: true,   // auth may still be settling on a cold start
  notFound: false,
  unknown: true,
};

/**
 * Firebase surfaces its code as `err.code`, usually prefixed by the product
 * ("firestore/permission-denied", "auth/network-request-failed"). Callables use
 * bare gRPC names. We match on the suffix to cover both.
 */
function codeOf(err: unknown): string {
  const raw = (err as { code?: unknown } | null)?.code;
  if (typeof raw !== 'string') return '';
  return raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw;
}

export function classifyError(err: unknown): FriendsErrorKind {
  const code = codeOf(err);

  switch (code) {
    case 'permission-denied':
      return 'permissionDenied';
    case 'unavailable':
    case 'network-request-failed':
    case 'deadline-exceeded':
      return 'offline';
    case 'failed-precondition':
      // Firestore reuses failed-precondition for several things; the missing-index
      // variant is the one worth naming, and it always says so in the message.
      return /index/i.test(String((err as Error)?.message ?? ''))
        ? 'missingIndex'
        : 'unknown';
    case 'unauthenticated':
      return 'unauthenticated';
    case 'not-found':
      return 'notFound';
    default:
      return 'unknown';
  }
}

/** Classify a thrown value and resolve it to localized, retry-aware UI state. */
export function toFriendsError(err: unknown): FriendsError {
  const kind = classifyError(err);
  return {
    kind,
    message: t(MESSAGE_KEY[kind]),
    retryable: RETRYABLE[kind],
  };
}
