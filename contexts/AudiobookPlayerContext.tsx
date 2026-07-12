/**
 * AudiobookPlayerContext — React bridge for the AudiobookPlayer singleton.
 * Mounted once in the root layout so the mini-player and all Listen screens
 * share one live player state without prop drilling.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import audiobookPlayer, { AudiobookPlayerState } from '@/lib/audiobooks/player';

const AudiobookPlayerStateContext = createContext<AudiobookPlayerState>(
  audiobookPlayer.getState()
);

export function AudiobookPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AudiobookPlayerState>(audiobookPlayer.getState());

  useEffect(() => {
    return audiobookPlayer.subscribe(setState);
  }, []);

  return (
    <AudiobookPlayerStateContext.Provider value={state}>
      {children}
    </AudiobookPlayerStateContext.Provider>
  );
}

/** Live player state (re-renders on every status tick — keep consumers light). */
export function useAudiobookPlayer(): AudiobookPlayerState {
  return useContext(AudiobookPlayerStateContext);
}

/** Stable controls object — safe to use without re-render coupling. */
export const audiobookControls = audiobookPlayer;
