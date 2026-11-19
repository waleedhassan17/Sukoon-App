/**
 * One-time cleanup after the library became original-narrations-only.
 *
 * Users who already downloaded chapters of the AI-narrated books would otherwise
 * keep those files on disk with no way to reach (or delete) them from the UI.
 * This removes their downloads and cached chapter lists exactly once.
 *
 * The id list is intentionally static: it records what was removed, and the
 * `isOriginalNarration` filter in ./catalog guarantees none of them (nor any
 * future AI book) can reappear regardless of this list.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadManager } from './downloads';

const FLAG_KEY = 'sukoon_listen_ai_cleanup_v1';
const CHAPTER_CACHE_PREFIX = 'sukoon_listen_chapters_';

export const REMOVED_AI_BOOK_IDS: readonly string[] = [
  'sayings-of-muhammad',
  'alchemy-of-happiness',
  'deliverance-from-error',
  'kashf-al-mahjub',
  'gulistan-of-sadi',
  'bustan-of-sadi',
  'kalila-and-dimna',
  'travels-of-ibn-battuta',
  'short-history-saracens',
  'hayy-ibn-yaqzan',
  'forty-hadith-nawawi',
  'forty-hadith-qudsi',
  'riyad-us-saliheen-selections',
  'sukoon-stories-prophets-kids',
  'sukoon-40-hadith-little-muslims',
  'sukoon-productivity-sunnah',
];

/** Idempotent; safe to call on every Listen visit. Never throws. */
export async function cleanupRemovedBooks(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(FLAG_KEY)) === 'done') return;

    for (const id of REMOVED_AI_BOOK_IDS) {
      await DownloadManager.deleteBookDownloads(id).catch(() => {});
    }
    await AsyncStorage.multiRemove(REMOVED_AI_BOOK_IDS.map((id) => `${CHAPTER_CACHE_PREFIX}${id}`)).catch(() => {});

    await AsyncStorage.setItem(FLAG_KEY, 'done');
  } catch {
    // Best-effort housekeeping: try again next time.
  }
}
