/**
 * CatalogService — source of truth for the Listen library.
 *
 * Offline-first, matching the app-wide pattern (see dataSyncService.ts):
 *   1. The bundled `seed/catalog.json` always works, even fully offline.
 *   2. An optional Firestore `audiobooksCatalog` collection can add books or
 *      override seed entries (matched by id) without an app release — e.g. when
 *      the TTS agent publishes new chapters. Failures are silent; the seed wins.
 *
 * Remote results are cached in AsyncStorage so the last-known catalog is
 * available offline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, isFirebaseConfigured } from '../firebaseConfig';
import { Book, BookCategory } from './types';

const CACHE_KEY = 'sukoon_listen_catalog_cache';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // refresh remote at most twice a day

// Bundled seed — always available.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const seedCatalog = require('../../seed/catalog.json') as { books: Book[] };

interface RemoteCache {
  fetchedAt: number;
  books: Book[];
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Validate the minimum shape a book needs to render + play. Pure, unit-tested. */
export function isValidBook(b: any): b is Book {
  return (
    !!b &&
    typeof b.id === 'string' &&
    b.id.length > 0 &&
    typeof b.title === 'string' &&
    b.title.length > 0 &&
    typeof b.category === 'string' &&
    typeof b.license === 'string' &&
    !!b.chapterSource &&
    typeof b.chapterSource.kind === 'string'
  );
}

/** Merge remote entries over the seed (by id). Pure, unit-tested. */
export function mergeCatalog(seed: Book[], remote: Book[]): Book[] {
  const byId = new Map<string, Book>();
  for (const b of seed) if (isValidBook(b)) byId.set(b.id, b);
  for (const b of remote) if (isValidBook(b)) byId.set(b.id, b);
  return [...byId.values()];
}

let inMemory: Book[] | null = null;
let refreshPromise: Promise<void> | null = null;

export const CatalogService = {
  /**
   * Instant, synchronous-ish read: seed merged with the last cached remote.
   * Kicks off a background remote refresh (throttled by TTL).
   */
  async getBooks(): Promise<Book[]> {
    if (!inMemory) {
      const cached = safeParse<RemoteCache>(await AsyncStorage.getItem(CACHE_KEY));
      inMemory = mergeCatalog(seedCatalog.books, cached?.books ?? []);
      const stale = !cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS;
      if (stale) this.refreshRemote().catch(() => {});
    }
    return inMemory;
  },

  async getBook(id: string): Promise<Book | null> {
    const books = await this.getBooks();
    return books.find((b) => b.id === id) ?? null;
  },

  async getByCategory(category: BookCategory): Promise<Book[]> {
    const books = await this.getBooks();
    // Kids titles live only in the Kids section, regardless of their topic category.
    if (category === 'kids') return books.filter((b) => b.isKids);
    return books.filter((b) => b.category === category && !b.isKids);
  },

  async getKidsBooks(): Promise<Book[]> {
    const books = await this.getBooks();
    return books.filter((b) => b.isKids);
  },

  async getFeatured(): Promise<Book[]> {
    const books = await this.getBooks();
    const featured = books.filter((b) => b.featured && b.status === 'ready');
    return featured.length > 0 ? featured : books.filter((b) => b.status === 'ready').slice(0, 3);
  },

  /** Simple client-side search over title / author / narrator / category. */
  async search(query: string): Promise<Book[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const books = await this.getBooks();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.narrator.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  },

  /**
   * Pull catalog overrides from Firestore (collection `audiobooksCatalog`,
   * one doc per book, doc id == book id). No-ops silently when offline or
   * when the collection/rules aren't deployed yet.
   */
  async refreshRemote(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      try {
        if (!isFirebaseConfigured()) return;
        const db = await getFirestore();
        if (!db) return;
        const snap = await db.collection('audiobooksCatalog').get();
        const remote: Book[] = [];
        snap.forEach((doc: any) => {
          const data = { id: doc.id, ...doc.data() };
          if (isValidBook(data)) remote.push(data as Book);
        });
        if (remote.length > 0) {
          inMemory = mergeCatalog(seedCatalog.books, remote);
          await AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ fetchedAt: Date.now(), books: remote } satisfies RemoteCache)
          );
        } else {
          // Nothing remote yet — still stamp the cache so we don't hammer Firestore.
          await AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ fetchedAt: Date.now(), books: [] } satisfies RemoteCache)
          );
        }
      } catch {
        // Offline / rules not deployed — bundled seed remains authoritative.
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  },

  /** Test hook / pull-to-refresh support. */
  invalidate(): void {
    inMemory = null;
  },
};
