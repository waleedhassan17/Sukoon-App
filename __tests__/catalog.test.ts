/** Catalog repository: seed validation, remote merge, search, category rules. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CatalogService, isOriginalNarration, isValidBook, mergeCatalog } from '../lib/audiobooks/catalog';
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
      expect(['human', 'recitation']).toContain(b.narrationType);
    }
  });

  it('podcast content is never marked downloadable-licensed', () => {
    for (const b of seed.books.filter((x) => x.chapterSource.kind === 'rss')) {
      expect(b.license).toBe('permission');
      expect(b.attribution).toBeTruthy();
    }
  });

  it('the bundled seed contains ONLY original narrations (no AI / TTS books)', () => {
    expect(seed.books.length).toBeGreaterThan(0);
    for (const b of seed.books) {
      expect(isOriginalNarration(b)).toBe(true);
      expect(b.source).not.toBe('own');
      expect(b.ttsVoice).toBeUndefined();
      expect(JSON.stringify(b)).not.toMatch(/Sukoon AI narration|edge-tts|bundled:\/\//i);
    }
  });
});

describe('isOriginalNarration (fail-closed)', () => {
  const human: any = { narrationType: 'human', source: 'librivox' };

  it('accepts human and recitation narrations', () => {
    expect(isOriginalNarration(human)).toBe(true);
    expect(isOriginalNarration({ narrationType: 'recitation', source: 'quran' })).toBe(true);
    expect(isOriginalNarration({ narrationType: 'human', source: 'podcast' })).toBe(true);
  });

  it('rejects AI narrations however they are marked', () => {
    expect(isOriginalNarration({ ...human, narrationType: 'ai' })).toBe(false);
    expect(isOriginalNarration({ ...human, source: 'own' })).toBe(false);
    expect(isOriginalNarration({ ...human, ttsVoice: 'en-US-GuyNeural' })).toBe(false);
  });

  it('rejects anything that does not positively declare an original narration', () => {
    expect(isOriginalNarration({ source: 'librivox' })).toBe(false); // missing narrationType
    expect(isOriginalNarration({ ...human, narrationType: 'robot' })).toBe(false); // unknown value
    expect(isOriginalNarration({ ...human, narrationType: undefined })).toBe(false);
    expect(isOriginalNarration(null)).toBe(false);
    expect(isOriginalNarration(undefined)).toBe(false);
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

  describe('AI narrations never surface', () => {
    const ai = (over: Partial<Book> = {}): Book =>
      ({ ...base[0], id: 'ai-book', narrationType: 'ai', source: 'own', ttsVoice: 'en-US-GuyNeural', ...over } as Book);

    it('drops AI books that arrive from the remote collection', () => {
      const merged = mergeCatalog(base, [ai()]);
      expect(merged.find((b) => b.id === 'ai-book')).toBeUndefined();
      expect(merged.length).toBe(base.length);
    });

    it('drops AI books present in the seed itself', () => {
      const merged = mergeCatalog([...base, ai({ id: 'seed-ai' })], []);
      expect(merged.find((b) => b.id === 'seed-ai')).toBeUndefined();
    });

    it('drops every flavour of marker, and unknown narration types', () => {
      const flavours: Book[] = [
        ai({ id: 'a1' }),
        ai({ id: 'a2', narrationType: 'human' as any }), // lies about narration but is source:'own' + ttsVoice
        { ...base[0], id: 'a3', narrationType: 'human', source: 'own' } as Book,
        { ...base[0], id: 'a4', narrationType: 'human', ttsVoice: 'x' } as Book,
        { ...base[0], id: 'a5', narrationType: undefined } as any,
        { ...base[0], id: 'a6', narrationType: 'synthetic' } as any,
      ];
      const merged = mergeCatalog(base, flavours);
      expect(merged.map((b) => b.id).sort()).toEqual(base.map((b) => b.id).sort());
    });

    it('a remote AI entry cannot override (replace) an original book with the same id', () => {
      const evil = ai({ id: base[0].id, title: 'Replaced by AI' });
      const merged = mergeCatalog(base, [evil]);
      expect(merged.find((b) => b.id === base[0].id)?.title).toBe(base[0].title);
    });

    it('still lets a remote ORIGINAL narration be added', () => {
      const extra = { ...base[0], id: 'new-human', narrationType: 'human', source: 'archive' } as Book;
      expect(mergeCatalog(base, [extra]).some((b) => b.id === 'new-human')).toBe(true);
    });
  });
});

describe('CatalogService never serves AI books, even from a stale on-device cache', () => {
  it('ignores AI entries in the cached remote catalog', async () => {
    const aiBook = { ...seed.books[0], id: 'cached-ai', narrationType: 'ai', source: 'own', ttsVoice: 'v' };
    await AsyncStorage.setItem(
      'sukoon_listen_catalog_cache',
      JSON.stringify({ fetchedAt: Date.now(), books: [aiBook] }),
    );
    CatalogService.invalidate();
    const books = await CatalogService.getBooks();
    expect(books.find((b) => b.id === 'cached-ai')).toBeUndefined();
    expect(books.every((b) => b.narrationType === 'human' || b.narrationType === 'recitation')).toBe(true);
  });

  it('exposes exactly the original books, with a sane shelf layout', async () => {
    const books = await CatalogService.getBooks();
    expect(books.length).toBe(seed.books.length);
    const cats = new Set(books.map((b) => (b.isKids ? 'kids' : b.category)));
    expect([...cats].sort()).toEqual(['kids', 'quran', 'sirah']);
    expect((await CatalogService.getFeatured()).length).toBeGreaterThan(0);
  });

  it('a filtered-out book id resolves to null (stale deep links degrade gracefully)', async () => {
    expect(await CatalogService.getBook('alchemy-of-happiness')).toBeNull();
    expect(await CatalogService.getBook('forty-hadith-nawawi')).toBeNull();
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
