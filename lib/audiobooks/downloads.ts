/**
 * DownloadManager — license-gated offline downloads via expo-file-system.
 *
 * Files land in app-private storage at
 *   {documentDirectory}audiobooks/{bookId}/{index padded to 3}.mp3
 * The player checks `getLocalUri()` before streaming, so downloaded chapters
 * play in airplane mode. Podcast (rss) content is stream-only by policy and
 * never offered for download — see isDownloadable() in types.ts.
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBundledSource } from './bundledAudio';
import { Book, Chapter, isDownloadable } from './types';

const KEY_INDEX = 'sukoon_listen_downloads'; // map chapterId → { bookId, path, bytes }

interface DownloadRecord {
  bookId: string;
  path: string;
  bytes: number;
}

type DownloadIndex = Record<string, DownloadRecord>;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function baseDir(): string {
  return `${FileSystem.documentDirectory}audiobooks/`;
}

function chapterPath(chapter: Chapter): string {
  return `${baseDir()}${chapter.bookId}/${String(chapter.index).padStart(3, '0')}.mp3`;
}

async function readIndex(): Promise<DownloadIndex> {
  return safeParse<DownloadIndex>(await AsyncStorage.getItem(KEY_INDEX)) ?? {};
}

async function writeIndex(index: DownloadIndex): Promise<void> {
  await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(index));
}

const activeDownloads = new Map<string, FileSystem.DownloadResumable>();

export const DownloadManager = {
  /** Local file URI if this chapter is downloaded, else null. */
  async getLocalUri(chapterId: string): Promise<string | null> {
    const index = await readIndex();
    const rec = index[chapterId];
    if (!rec) return null;
    try {
      const info = await FileSystem.getInfoAsync(rec.path);
      if (info.exists) return rec.path;
    } catch {}
    // Stale record — file was cleared by the OS or user.
    delete index[chapterId];
    await writeIndex(index);
    return null;
  },

  async isChapterDownloaded(chapterId: string): Promise<boolean> {
    return (await this.getLocalUri(chapterId)) !== null;
  },

  /** Set of downloaded chapter ids for a book (single read for list screens). */
  async getDownloadedChapterIds(bookId: string): Promise<Set<string>> {
    const index = await readIndex();
    return new Set(
      Object.entries(index)
        .filter(([, rec]) => rec.bookId === bookId)
        .map(([chapterId]) => chapterId)
    );
  },

  /**
   * Download one chapter. Throws for stream-only content (license gate).
   * onProgress reports 0..1.
   */
  async downloadChapter(
    book: Book,
    chapter: Chapter,
    onProgress?: (fraction: number) => void
  ): Promise<string> {
    if (!isDownloadable(book)) {
      throw new Error('DOWNLOAD_NOT_PERMITTED');
    }
    // Chapters bundled into the APK are already on-device — nothing to fetch.
    if (getBundledSource(chapter.id) !== null) {
      onProgress?.(1);
      return chapter.audioUrl;
    }
    const existing = await this.getLocalUri(chapter.id);
    if (existing) return existing;

    const path = chapterPath(chapter);
    const dir = path.substring(0, path.lastIndexOf('/'));
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});

    const resumable = FileSystem.createDownloadResumable(
      chapter.audioUrl,
      path,
      {},
      (p) => {
        if (onProgress && p.totalBytesExpectedToWrite > 0) {
          onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
        }
      }
    );
    activeDownloads.set(chapter.id, resumable);
    try {
      const result = await resumable.downloadAsync();
      if (!result?.uri) throw new Error('DOWNLOAD_FAILED');
      const info = await FileSystem.getInfoAsync(result.uri);
      const index = await readIndex();
      index[chapter.id] = {
        bookId: chapter.bookId,
        path: result.uri,
        bytes: info.exists && 'size' in info ? (info as any).size ?? 0 : 0,
      };
      await writeIndex(index);
      onProgress?.(1);
      return result.uri;
    } catch (e) {
      // Clean up partial file so a retry starts fresh.
      await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
      throw e;
    } finally {
      activeDownloads.delete(chapter.id);
    }
  },

  /** Download every chapter of a book sequentially. Returns count downloaded. */
  async downloadBook(
    book: Book,
    chapters: Chapter[],
    onChapterProgress?: (chapterIndex: number, fraction: number) => void
  ): Promise<number> {
    let done = 0;
    for (const chapter of chapters) {
      await this.downloadChapter(book, chapter, (f) =>
        onChapterProgress?.(chapter.index, f)
      );
      done++;
    }
    return done;
  },

  async cancelDownload(chapterId: string): Promise<void> {
    const active = activeDownloads.get(chapterId);
    if (active) {
      try {
        await active.pauseAsync();
      } catch {}
      activeDownloads.delete(chapterId);
    }
  },

  async deleteBookDownloads(bookId: string): Promise<void> {
    const index = await readIndex();
    for (const [chapterId, rec] of Object.entries(index)) {
      if (rec.bookId === bookId) delete index[chapterId];
    }
    await writeIndex(index);
    await FileSystem.deleteAsync(`${baseDir()}${bookId}`, { idempotent: true }).catch(() => {});
  },

  /** Total bytes on disk for a book (for the library screen). */
  async getDownloadedBytes(bookId: string): Promise<number> {
    const index = await readIndex();
    return Object.values(index)
      .filter((rec) => rec.bookId === bookId)
      .reduce((sum, rec) => sum + (rec.bytes || 0), 0);
  },
};
