/** The back-button rules that stop "GO_BACK was not handled by any navigator". */

import { BACK_LOCK_MS, decideBack } from '../lib/backNavigation';

describe('decideBack', () => {
  it('goes back when there is a screen to return to', () => {
    expect(decideBack({ canGoBack: true, locked: false })).toBe('back');
  });

  it('falls back to a parent screen when there is no history (opened from a notification / deep link / reload)', () => {
    expect(decideBack({ canGoBack: false, locked: false })).toBe('fallback');
  });

  it('ignores a repeat tap while a back transition is underway — in either case', () => {
    expect(decideBack({ canGoBack: true, locked: true })).toBe('ignore');
    // The classic double-tap: the first press already popped the screen, so
    // history is now empty — the second press must NOT trigger a fallback jump.
    expect(decideBack({ canGoBack: false, locked: true })).toBe('ignore');
  });

  it('lock window covers a typical animation but is short enough not to feel stuck', () => {
    expect(BACK_LOCK_MS).toBeGreaterThanOrEqual(400);
    expect(BACK_LOCK_MS).toBeLessThanOrEqual(1000);
  });
});
