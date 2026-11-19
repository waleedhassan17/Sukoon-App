/**
 * Pure rules for the "back" button — no React / router imports, so they can be
 * unit-tested in plain Node. The hook that applies them is lib/useSafeBack.ts.
 */

export type BackDecision = 'back' | 'fallback' | 'ignore';

/**
 * How long repeat taps are ignored after a back press. Covers the slide / modal
 * dismiss animation, during which the button is still on screen and can be
 * tapped again.
 */
export const BACK_LOCK_MS = 600;

/**
 * What a back tap should do right now.
 *
 *  - 'ignore'   a back transition is already underway (double tap)
 *  - 'back'     there is a screen to return to
 *  - 'fallback' there is NOT (screen opened from a notification / deep link, or
 *               the app was reloaded on it) — go to a sensible parent instead of
 *               dead-ending with "GO_BACK was not handled by any navigator"
 */
export function decideBack(state: { canGoBack: boolean; locked: boolean }): BackDecision {
  if (state.locked) return 'ignore';
  return state.canGoBack ? 'back' : 'fallback';
}
