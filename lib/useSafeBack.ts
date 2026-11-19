/**
 * useSafeBack — a back handler that can never dead-end.
 *
 * `router.back()` only works when there is a screen to go back to. When there is
 * not — the screen was opened straight from a notification or deep link, the app
 * was reloaded on it, or the button was tapped twice during the slide animation —
 * React Navigation logs "The action 'GO_BACK' was not handled by any navigator"
 * and the button silently does nothing.
 *
 * This hook:
 *   1. goes back when it can,
 *   2. otherwise REPLACES the screen with a sensible parent (default: Home),
 *   3. ignores repeat taps while a back transition is already underway.
 *
 *   const goBack = useSafeBack('/listen');   // parent to land on if there is no history
 *   <TouchableOpacity onPress={goBack} />
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, type Href } from 'expo-router';
import { BACK_LOCK_MS, decideBack } from './backNavigation';

export function useSafeBack(fallback: Href = '/'): () => void {
  const router = useRouter();
  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(() => {
    const action = decideBack({ canGoBack: router.canGoBack(), locked: lockedRef.current });
    if (action === 'ignore') return;

    lockedRef.current = true;
    timerRef.current = setTimeout(() => {
      lockedRef.current = false;
    }, BACK_LOCK_MS);

    if (action === 'back') router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
