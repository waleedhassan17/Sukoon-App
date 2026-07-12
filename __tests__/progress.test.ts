/** Resume-position save/restore and cloud-merge semantics. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ListenProgress, mergeProgress } from '../lib/audiobooks/progress';
import { BookProgress } from '../lib/audiobooks/types';

function makeProgress(overrides: Partial<BookProgress> = {}): BookProgress {
  return {
    bookId: 'book-a',
    chapterId: 'book-a_0',
    chapterIndex: 0,
    positionMs: 5_000,
    updatedAt: 1_000,
    completed: false,
    secondsListened: 5,
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('mergeProgress (last-write-wins)', () => {
  it('keeps the newer entry per book', () => {
    const local = { 'book-a': makeProgress({ updatedAt: 2_000, positionMs: 9_000 }) };
    const cloud = { 'book-a': makeProgress({ updatedAt: 1_000, positionMs: 1_000 }) };
    expect(mergeProgress(local, cloud)['book-a'].positionMs).toBe(9_000);

    const cloudNewer = { 'book-a': makeProgress({ updatedAt: 3_000, positionMs: 12_000 }) };
    expect(mergeProgress(local, cloudNewer)['book-a'].positionMs).toBe(12_000);
  });

  it('unions books present on only one side', () => {
    const local = { 'book-a': makeProgress() };
    const cloud = { 'book-b': makeProgress({ bookId: 'book-b' }) };
    const merged = mergeProgress(local, cloud);
    expect(Object.keys(merged).sort()).toEqual(['book-a', 'book-b']);
  });
});

describe('ListenProgress save/restore', () => {
  it('round-trips a saved position', async () => {
    await ListenProgress.save(makeProgress({ positionMs: 42_000 }));
    const restored = await ListenProgress.get('book-a');
    expect(restored?.positionMs).toBe(42_000);
    expect(restored?.chapterIndex).toBe(0);
  });

  it('never decreases secondsListened on later saves', async () => {
    await ListenProgress.save(makeProgress({ secondsListened: 100 }));
    await ListenProgress.save(makeProgress({ secondsListened: 40 }));
    const restored = await ListenProgress.get('book-a');
    expect(restored?.secondsListened).toBe(100);
  });

  it('getRecent sorts by recency and excludes completed books', async () => {
    await ListenProgress.save(makeProgress({ bookId: 'old' }));
    await new Promise((r) => setTimeout(r, 5));
    await ListenProgress.save(makeProgress({ bookId: 'new' }));
    await ListenProgress.save(makeProgress({ bookId: 'done' }));
    await ListenProgress.markCompleted('done');

    const recent = await ListenProgress.getRecent();
    expect(recent.map((p) => p.bookId)).toEqual(['new', 'old']);
  });

  it('markCompleted flags the book', async () => {
    await ListenProgress.save(makeProgress());
    await ListenProgress.markCompleted('book-a');
    expect((await ListenProgress.get('book-a'))?.completed).toBe(true);
  });

  it('library add/remove round-trips', async () => {
    await ListenProgress.addToLibrary('book-a');
    expect(await ListenProgress.isInLibrary('book-a')).toBe(true);
    await ListenProgress.addToLibrary('book-a'); // idempotent
    expect((await ListenProgress.getLibrary()).length).toBe(1);
    await ListenProgress.removeFromLibrary('book-a');
    expect(await ListenProgress.isInLibrary('book-a')).toBe(false);
  });
});
