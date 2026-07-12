/**
 * ChapterResolver — turns a Book's chapterSource into a playable chapter list.
 *
 * Strategies:
 *  - static   : chapters ship inline in the catalog (TTS output on our CDN)
 *  - archive  : archive.org metadata API → mp3 files (LibriVox etc.)
 *  - mp3quran : reciter moshaf server + zero-padded surah number
 *  - rss      : iTunes lookup → podcast RSS → <enclosure> URLs (stream-from-origin)
 *
 * Every remote resolution is cached in AsyncStorage so books open instantly and
 * work offline after first load. Failures throw — screens show retry states.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Book, Chapter } from './types';

const CACHE_PREFIX = 'sukoon_listen_chapters_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week; podcasts refresh sooner
const RSS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface ChapterCache {
  fetchedAt: number;
  chapters: Chapter[];
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/* ─── archive.org ─── */

interface ArchiveFile {
  name: string;
  length?: string; // seconds, sometimes "mm:ss"
  size?: string;
  title?: string;
  track?: string;
}

function parseArchiveLength(length?: string): number {
  if (!length) return 0;
  if (length.includes(':')) {
    const parts = length.split(':').map((p) => parseInt(p, 10) || 0);
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const secs = parseFloat(length);
  return Number.isFinite(secs) ? Math.round(secs) : 0;
}

/**
 * Pick one mp3 per track from an archive.org file list, preferring the small
 * 64kb derivative for mobile streaming. Pure — unit-tested.
 */
export function selectArchiveMp3s(files: ArchiveFile[]): ArchiveFile[] {
  const mp3s = files.filter((f) => f.name?.toLowerCase().endsWith('.mp3'));
  // Group by stem with bitrate suffixes stripped: foo.mp3 / foo_64kb.mp3 / foo_128kb.mp3
  const byStem = new Map<string, ArchiveFile[]>();
  for (const f of mp3s) {
    const stem = f.name.replace(/_(64|128|vbr)kb?\.mp3$/i, '.mp3').replace(/\.mp3$/i, '');
    const group = byStem.get(stem) ?? [];
    group.push(f);
    byStem.set(stem, group);
  }
  const picked: ArchiveFile[] = [];
  for (const group of byStem.values()) {
    const preferred =
      group.find((f) => /_64kb\.mp3$/i.test(f.name)) ??
      group.find((f) => /_128kb\.mp3$/i.test(f.name)) ??
      group[0];
    picked.push(preferred);
  }
  picked.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return picked;
}

async function resolveArchive(book: Book, identifier: string): Promise<Chapter[]> {
  const meta = await fetchJson(`https://archive.org/metadata/${identifier}`);
  const files: ArchiveFile[] = Array.isArray(meta?.files) ? meta.files : [];
  const picked = selectArchiveMp3s(files);
  if (picked.length === 0) throw new Error(`No mp3 files in archive item ${identifier}`);
  return picked.map((f, i) => ({
    id: `${book.id}_${i}`,
    bookId: book.id,
    index: i,
    title:
      f.title?.trim() ||
      f.name
        .replace(/\.mp3$/i, '')
        .replace(/_(64|128|vbr)kb$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim(),
    audioUrl: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
    durationSec: parseArchiveLength(f.length),
    fileSizeBytes: f.size ? parseInt(f.size, 10) || undefined : undefined,
  }));
}

/* ─── mp3quran.net ─── */

let suwarNamesPromise: Promise<Map<number, string>> | null = null;

async function getSurahNames(): Promise<Map<number, string>> {
  if (!suwarNamesPromise) {
    suwarNamesPromise = (async () => {
      const map = new Map<number, string>();
      try {
        const data = await fetchJson('https://www.mp3quran.net/api/v3/suwar?language=eng');
        for (const s of data?.suwar ?? []) {
          if (typeof s?.id === 'number' && typeof s?.name === 'string') {
            map.set(s.id, s.name.trim());
          }
        }
      } catch {
        // Fall back to "Surah N" titles below.
      }
      return map;
    })();
  }
  return suwarNamesPromise;
}

async function resolveMp3Quran(
  book: Book,
  reciterId: number,
  moshafId: number
): Promise<Chapter[]> {
  const data = await fetchJson('https://www.mp3quran.net/api/v3/reciters?language=eng');
  const reciter = (data?.reciters ?? []).find((r: any) => r.id === reciterId);
  if (!reciter) throw new Error(`Reciter ${reciterId} not found`);
  const moshaf =
    (reciter.moshaf ?? []).find((m: any) => m.id === moshafId) ?? reciter.moshaf?.[0];
  if (!moshaf?.server) throw new Error(`Moshaf ${moshafId} not found for reciter ${reciterId}`);

  const server: string = moshaf.server.endsWith('/') ? moshaf.server : `${moshaf.server}/`;
  const surahIds: number[] = String(moshaf.surah_list ?? '')
    .split(',')
    .map((s: string) => parseInt(s, 10))
    .filter((n: number) => Number.isFinite(n));
  const names = await getSurahNames();

  return surahIds.map((surah, i) => ({
    id: `${book.id}_${surah}`,
    bookId: book.id,
    index: i,
    title: names.get(surah) ? `${surah}. ${names.get(surah)}` : `Surah ${surah}`,
    audioUrl: `${server}${String(surah).padStart(3, '0')}.mp3`,
    durationSec: 0,
  }));
}

/* ─── Podcast RSS ─── */

/**
 * Minimal RSS parsing with regex — enough for <item><title> + <enclosure url>
 * without adding an XML dependency. Pure — unit-tested.
 */
export function parseRssEpisodes(
  xml: string
): { title: string; url: string; durationSec: number }[] {
  const episodes: { title: string; url: string; durationSec: number }[] = [];
  const items = xml.split(/<item[\s>]/i).slice(1);
  for (const chunk of items) {
    const enclosure = chunk.match(/<enclosure[^>]*\surl="([^"]+)"/i);
    if (!enclosure) continue;
    const titleMatch =
      chunk.match(/<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/i) ||
      chunk.match(/<title>([\s\S]*?)<\/title>/i);
    const durMatch = chunk.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i);
    let durationSec = 0;
    if (durMatch) {
      const raw = durMatch[1].trim();
      durationSec = raw.includes(':')
        ? raw.split(':').reduce((acc, p) => acc * 60 + (parseInt(p, 10) || 0), 0)
        : parseInt(raw, 10) || 0;
    }
    episodes.push({
      title: (titleMatch?.[1] ?? 'Episode').replace(/<[^>]+>/g, '').trim(),
      url: enclosure[1].replace(/&amp;/g, '&'),
      durationSec,
    });
  }
  // Feeds list newest first; audiobook-style listening wants oldest first.
  return episodes.reverse();
}

async function resolveRss(
  book: Book,
  itunesCollectionId: number,
  knownFeedUrl?: string
): Promise<Chapter[]> {
  let feedUrl = knownFeedUrl;
  if (!feedUrl) {
    const lookup = await fetchJson(`https://itunes.apple.com/lookup?id=${itunesCollectionId}`);
    feedUrl = lookup?.results?.[0]?.feedUrl;
  }
  if (!feedUrl) throw new Error(`No feed for podcast ${itunesCollectionId}`);
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${feedUrl}`);
  const xml = await res.text();
  const episodes = parseRssEpisodes(xml);
  if (episodes.length === 0) throw new Error(`No playable episodes in ${feedUrl}`);
  return episodes.map((ep, i) => ({
    id: `${book.id}_${i}`,
    bookId: book.id,
    index: i,
    title: ep.title,
    audioUrl: ep.url,
    durationSec: ep.durationSec,
  }));
}

/* ─── Public API ─── */

export const ChapterResolver = {
  async getChapters(book: Book, forceRefresh = false): Promise<Chapter[]> {
    if (book.chapterSource.kind === 'static') {
      return book.chapters ?? [];
    }

    const cacheKey = `${CACHE_PREFIX}${book.id}`;
    const ttl = book.chapterSource.kind === 'rss' ? RSS_CACHE_TTL_MS : CACHE_TTL_MS;
    const cached = safeParse<ChapterCache>(await AsyncStorage.getItem(cacheKey));
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < ttl && cached.chapters.length > 0) {
      return cached.chapters;
    }

    try {
      let chapters: Chapter[];
      switch (book.chapterSource.kind) {
        case 'archive':
          chapters = await resolveArchive(book, book.chapterSource.identifier);
          break;
        case 'mp3quran':
          chapters = await resolveMp3Quran(
            book,
            book.chapterSource.reciterId,
            book.chapterSource.moshafId
          );
          break;
        case 'rss':
          chapters = await resolveRss(
            book,
            book.chapterSource.itunesCollectionId,
            book.chapterSource.feedUrl
          );
          break;
        default:
          chapters = [];
      }
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ fetchedAt: Date.now(), chapters } satisfies ChapterCache)
      );
      return chapters;
    } catch (e) {
      // Offline / source hiccup: serve stale cache if we have one.
      if (cached && cached.chapters.length > 0) return cached.chapters;
      throw e;
    }
  },
};
