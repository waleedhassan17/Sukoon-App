/**
 * Listen analytics — single seam for audiobook events.
 *
 * The app has no analytics SDK wired today, so this logs in dev and keeps a
 * small local ring buffer for debugging. When an analytics provider is added
 * (Firebase Analytics etc.), forward events from `track()` — call sites won't
 * change. Events collect NO personal data (book ids + counters only); see
 * docs/content-ops.md → Data safety.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type ListenEvent =
  | { name: 'listen_play'; bookId: string; chapterIndex: number }
  | { name: 'listen_complete_chapter'; bookId: string; chapterIndex: number }
  | { name: 'listen_complete_book'; bookId: string }
  | { name: 'listen_download'; bookId: string }
  | { name: 'listen_streak_day'; streak: number }
  | { name: 'listen_badge'; badge: string };

const BUFFER_KEY = 'sukoon_listen_events';
const BUFFER_MAX = 100;

export const ListenAnalytics = {
  track(event: ListenEvent): void {
    if (__DEV__) console.log('[ListenAnalytics]', event.name, event);
    // Local ring buffer — handy for support/debug, bounded, fire-and-forget.
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BUFFER_KEY);
        const buf: any[] = raw ? JSON.parse(raw) : [];
        buf.push({ ...event, at: Date.now() });
        await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buf.slice(-BUFFER_MAX)));
      } catch {}
    })();
  },
};
