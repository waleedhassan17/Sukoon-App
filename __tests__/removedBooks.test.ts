/** One-time cleanup of previously downloaded AI books. */

import AsyncStorage from '@react-native-async-storage/async-storage';

const deleteBookDownloads = jest.fn(async (_id: string) => {});
jest.mock('../lib/audiobooks/downloads', () => ({
  DownloadManager: { deleteBookDownloads: (id: string) => deleteBookDownloads(id) },
}));

import { cleanupRemovedBooks, REMOVED_AI_BOOK_IDS } from '../lib/audiobooks/removedBooks';

const seed = require('../seed/catalog.json') as { books: { id: string }[] };

beforeEach(async () => {
  await AsyncStorage.clear();
  deleteBookDownloads.mockClear();
});

describe('cleanupRemovedBooks', () => {
  it('removes downloads for every removed AI book exactly once', async () => {
    await cleanupRemovedBooks();
    expect(deleteBookDownloads).toHaveBeenCalledTimes(REMOVED_AI_BOOK_IDS.length);
    await cleanupRemovedBooks(); // second visit
    expect(deleteBookDownloads).toHaveBeenCalledTimes(REMOVED_AI_BOOK_IDS.length);
  });

  it('clears cached chapter lists of the removed books only', async () => {
    await AsyncStorage.setItem('sukoon_listen_chapters_alchemy-of-happiness', '[]');
    await AsyncStorage.setItem('sukoon_listen_chapters_shakir-holy-koran', '[]');
    await cleanupRemovedBooks();
    expect(await AsyncStorage.getItem('sukoon_listen_chapters_alchemy-of-happiness')).toBeNull();
    expect(await AsyncStorage.getItem('sukoon_listen_chapters_shakir-holy-koran')).toBe('[]');
  });

  it('never throws, even if a deletion fails', async () => {
    deleteBookDownloads.mockRejectedValueOnce(new Error('disk'));
    await expect(cleanupRemovedBooks()).resolves.toBeUndefined();
  });

  it('never lists a book that is still in the library', () => {
    const live = new Set(seed.books.map((b) => b.id));
    for (const id of REMOVED_AI_BOOK_IDS) expect(live.has(id)).toBe(false);
  });
});
