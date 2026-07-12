/** Catalog repository: seed validation, remote merge, search, category rules. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CatalogService, isValidBook, mergeCatalog } from '../lib/audiobooks/catalog';
import { Book } from '../lib/audiobooks/types';

const seed = require('../seed/catalog.json') as { books: Book[] };

beforeEach(async () => {
  await AsyncStorage.clear();
  CatalogService.invalidate();
});

describe('seed catalog integrity', () => {
  it('every seed entry is a valid book', () => {
    for (const b of seed.books) {
      expect(isValidBook(b)).toBe(true);
    }
  });

  it('ids are unique', () => {
    const ids = seed.books.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every book records a license and a narration badge type', () => {
    for (const b of seed.books) {
      expect(['public_domain', 'cc', 'permission', 'own']).toContain(b.license);
      expect(['human', 'ai', 'recitation']).toContain(b.narrationType);
    }
  });

  it('podcast content is never marked downloadable-licensed', () => {
    for (const b of seed.books.filter((x) => x.chapterSource.kind === 'rss')) {
      expect(b.license).toBe('permission');
      expect(b.attribution).toBeTruthy();
    }
  });

  it('pending TTS books have empty static chapters awaiting the agent', () => {
    for (const b of seed.books.filter((x) => x.status === 'pending')) {
      expect(b.chapterSource.kind).toBe('static');
      expect(b.chapters ?? []).toHaveLength(0);
    }
  });
});

describe('mergeCatalog', () => {
  const base = seed.books.slice(0, 3);

  it('remote overrides seed by id', () => {
    const override = { ...base[0], title: 'Updated Title', status: 'ready' as const };
    const merged = mergeCatalog(base, [override]);
    expect(merged.find((b) => b.id === base[0].id)?.title).toBe('Updated Title');
    expect(merged.length).toBe(base.length);
  });

  it('remote can add new books', () => {
    const extra = { ...base[0], id: 'brand-new-book' };
    expect(mergeCatalog(base, [extra]).length).toBe(base.length + 1);
  });

  it('malformed remote entries are dropped', () => {
    const junk: any = { id: '', title: null };
    expect(mergeCatalog(base, [junk]).length).toBe(base.length);
  });
});

describe('CatalogService queries', () => {
  it('search matches title, author and narrator case-insensitively', async () => {
    expect((await CatalogService.search('pickthall')).length).toBeGreaterThan(0);
    expect((await CatalogService.search('ALAFASY')).length).toBeGreaterThan(0);
    expect(await CatalogService.search('   ')).toEqual([]);
  });

  it('kids books appear only in the kids category', async () => {
    const kids = await CatalogService.getByCategory('kids');
    expect(kids.length).toBeGreaterThan(0);
    expect(kids.every((b) => b.isKids)).toBe(true);

    const sirah = await CatalogService.getByCategory('sirah');
    expect(sirah.every((b) => !b.isKids)).toBe(true);
  });

  it('featured shelf only contains playable (ready) books', async () => {
    const featured = await CatalogService.getFeatured();
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((b) => b.status === 'ready')).toBe(true);
  });
});
