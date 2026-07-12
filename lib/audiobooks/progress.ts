/**
 * ListenProgress — resume positions, "My Library", and completion flags.
 *
 * Offline-first: AsyncStorage is primary, DataSyncService mirrors to the cloud
 * (users/{uid}/audiobooks/*) in the background. Writes are debounced by the
 * player (every 10s + on pause) so we only persist meaningful positions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataSyncService } from '../dataSyncService';
import { BookProgress, LibraryEntry } from './types';

const KEYS = {
  PROGRESS: 'sukoon_listen_progress', // map bookId → BookProgress
  LIBRARY: 'sukoon_listen_library',   // LibraryEntry[]
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Last-write-wins merge of local and cloud progress maps (per book).
 * Pure — unit-tested.
 */
export function mergeProgress(
  local: Record<string, BookProgress>,
  cloud: Record<string, BookProgress>
): Record<string, BookProgress> {
  const merged: Record<string, BookProgress> = { ...local };
  for (const [bookId, cloudEntry] of Object.entries(cloud)) {
    const localEntry = merged[bookId];
    if (!localEntry || (cloudEntry.updatedAt ?? 0) > (localEntry.updatedAt ?? 0)) {
      merged[bookId] = cloudEntry;
    }
  }
  return merged;
}

async function readAll(): Promise<Record<string, BookProgress>> {
  return safeParse<Record<string, BookProgress>>(await AsyncStorage.getItem(KEYS.PROGRESS)) ?? {};
}

async function writeAll(map: Record<string, BookProgress>): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROGRESS, JSON.stringify(map));
  DataSyncService.pushToCloud('audiobooks', 'progress', map).catch(() => {});
}

export const ListenProgress = {
  async get(bookId: string): Promise<BookProgress | null> {
    const map = await readAll();
    return map[bookId] ?? null;
  },

  async getAll(): Promise<Record<string, BookProgress>> {
    return readAll();
  },

  /** Books with progress, most recent first — powers "Jump back in". */
  async getRecent(limit = 10): Promise<BookProgress[]> {
    const map = await readAll();
    return Object.values(map)
      .filter((p) => !p.completed)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  },

  async save(progress: BookProgress): Promise<void> {
    const map = await readAll();
    const prev = map[progress.bookId];
    map[progress.bookId] = {
      ...progress,
      secondsListened: Math.max(progress.secondsListened, prev?.secondsListened ?? 0),
      updatedAt: Date.now(),
    };
    await writeAll(map);
  },

  async markCompleted(bookId: string): Promise<void> {
    const map = await readAll();
    const prev = map[bookId];
    if (!prev) return;
    map[bookId] = { ...prev, completed: true, updatedAt: Date.now() };
    await writeAll(map);
  },

  /** Pull cloud progress once (e.g. app start) and merge last-write-wins. */
  async syncFromCloud(): Promise<void> {
    try {
      const cloud = await DataSyncService.pullFromCloud<Record<string, BookProgress>>(
        'audiobooks',
        'progress'
      );
      if (!cloud) return;
      const local = await readAll();
      const merged = mergeProgress(local, cloud);
      await AsyncStorage.setItem(KEYS.PROGRESS, JSON.stringify(merged));
    } catch {
      // Offline — local wins.
    }
  },

  /* ── Library ("My Books") ── */

  async getLibrary(): Promise<LibraryEntry[]> {
    return safeParse<LibraryEntry[]>(await AsyncStorage.getItem(KEYS.LIBRARY)) ?? [];
  },

  async isInLibrary(bookId: string): Promise<boolean> {
    const lib = await this.getLibrary();
    return lib.some((e) => e.bookId === bookId);
  },

  async addToLibrary(bookId: string): Promise<void> {
    const lib = await this.getLibrary();
    if (lib.some((e) => e.bookId === bookId)) return;
    lib.unshift({ bookId, addedAt: Date.now(), downloadedBytes: 0 });
    await AsyncStorage.setItem(KEYS.LIBRARY, JSON.stringify(lib));
    DataSyncService.pushToCloud('audiobooks', 'library', lib).catch(() => {});
  },

  async removeFromLibrary(bookId: string): Promise<void> {
    const lib = (await this.getLibrary()).filter((e) => e.bookId !== bookId);
    await AsyncStorage.setItem(KEYS.LIBRARY, JSON.stringify(lib));
    DataSyncService.pushToCloud('audiobooks', 'library', lib).catch(() => {});
  },
};
