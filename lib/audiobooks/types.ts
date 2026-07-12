/**
 * Audiobooks ("Listen") data model.
 *
 * The catalog ships bundled in `seed/catalog.json` and can be overridden by the
 * optional Firestore `audiobooksCatalog` collection. Chapters are either listed
 * inline (TTS/CDN books) or resolved at runtime from the original source
 * (archive.org / mp3quran / podcast RSS) — see chapterResolver.ts.
 */

export type BookCategory =
  | 'quran'
  | 'sirah'
  | 'hadith'
  | 'aqidah'
  | 'spirituality'
  | 'selfhelp'
  | 'history'
  | 'geography'
  | 'fiction'
  | 'kids';

export type BookLanguage = 'en' | 'ur' | 'ar';
export type BookSource = 'librivox' | 'archive' | 'podcast' | 'own' | 'quran';
export type BookLicense = 'public_domain' | 'cc' | 'permission' | 'own';
export type NarrationType = 'human' | 'ai' | 'recitation';
export type BookStatus = 'ready' | 'pending' | 'generating';

/** How to obtain the chapter list for a book. */
export type ChapterSource =
  /** Chapters listed inline in the catalog entry (TTS output on our CDN). */
  | { kind: 'static' }
  /** archive.org item — chapter MP3s discovered via the metadata API. */
  | { kind: 'archive'; identifier: string }
  /** mp3quran.net reciter — MP3 per surah at {server}/{surah 3-digit}.mp3 */
  | { kind: 'mp3quran'; reciterId: number; moshafId: number }
  /** Podcast — feedUrl resolved via iTunes lookup, episodes from RSS enclosures. */
  | { kind: 'rss'; itunesCollectionId: number; feedUrl?: string };

export interface Chapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  audioUrl: string;
  durationSec: number;
  fileSizeBytes?: number;
  status?: BookStatus;
  ttsModel?: string;
  generatedAt?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  narrator: string;
  description: string;
  coverUrl?: string;
  category: BookCategory;
  language: BookLanguage;
  source: BookSource;
  license: BookLicense;
  narrationType: NarrationType;
  isKids: boolean;
  totalDurationSec: number;
  status: BookStatus;
  textSourceUrl?: string;
  ttsVoice?: string;
  /** Shown under the player/detail for podcast & archive content. */
  attribution?: string;
  /** Featured on the hero carousel. */
  featured?: boolean;
  chapterSource: ChapterSource;
  /** Only present when chapterSource.kind === 'static'. */
  chapters?: Chapter[];
}

export interface BookProgress {
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  positionMs: number;
  updatedAt: number;
  completed: boolean;
  /** Total seconds the user has listened to this book (approximate). */
  secondsListened: number;
}

export interface LibraryEntry {
  bookId: string;
  addedAt: number;
  downloadedBytes: number;
}

export interface ListenStreak {
  current: number;
  longest: number;
  /** YYYY-MM-DD of the last day with listening activity. */
  lastActiveDate: string | null;
}

export type BadgeId =
  | 'first_book_finished'
  | 'ten_hours'
  | 'streak_7'
  | 'streak_30';

export interface ListenStatsSummary {
  totalSeconds: number;
  booksCompleted: number;
  streak: ListenStreak;
  badges: BadgeId[];
}

/** Downloads are only offered for these licenses (podcast content is stream-only). */
export const DOWNLOADABLE_LICENSES: ReadonlyArray<BookLicense> = [
  'public_domain',
  'cc',
  'own',
];

export function isDownloadable(book: Book): boolean {
  return (
    DOWNLOADABLE_LICENSES.includes(book.license) &&
    book.chapterSource.kind !== 'rss'
  );
}

export const CATEGORY_LABEL_KEYS: Record<BookCategory, string> = {
  quran: 'listen.cat.quran',
  sirah: 'listen.cat.sirah',
  hadith: 'listen.cat.hadith',
  aqidah: 'listen.cat.aqidah',
  spirituality: 'listen.cat.spirituality',
  selfhelp: 'listen.cat.selfhelp',
  history: 'listen.cat.history',
  geography: 'listen.cat.geography',
  fiction: 'listen.cat.fiction',
  kids: 'listen.cat.kids',
};
