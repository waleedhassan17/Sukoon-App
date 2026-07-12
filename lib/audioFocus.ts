/**
 * AudioFocus — one audio source at a time, app-wide.
 *
 * Three independent expo-av users exist: the Quran ayah engine
 * (lib/audioPlayer.ts), the Azan player (lib/azanPlayer.ts) and the audiobook
 * player (lib/audiobooks/player.ts). Each registers a stop/pause handler here
 * and requests focus before playing; everyone else gets silenced.
 *
 * Azan is special-cased: it takes focus (pausing an audiobook mid-chapter is
 * correct behaviour during the call to prayer) but registers no handler, since
 * it is short-lived and should never be interrupted by music-style playback.
 */

type StopHandler = () => void;

const handlers = new Map<string, StopHandler>();

export const AudioFocus = {
  /** Register how to silence this player. Call once at module init. */
  register(owner: string, stop: StopHandler): void {
    handlers.set(owner, stop);
  },

  /** Silence every other registered player before starting playback. */
  request(owner: string): void {
    for (const [name, stop] of handlers) {
      if (name === owner) continue;
      try {
        stop();
      } catch {
        // A failing sibling must never block playback.
      }
    }
  },
};
