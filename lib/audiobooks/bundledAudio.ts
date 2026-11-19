/**
 * Bundled audiobook audio — chapters that ship inside the APK/AAB so a book plays
 * offline from the moment the app is installed (no download step).
 *
 * Currently EMPTY. The only bundled titles were AI-narrated hadith collections,
 * which were removed when the library became original-narrations-only (see
 * `isOriginalNarration` in ./catalog). The API is kept because the player,
 * downloader and book screen all resolve `bundled://` chapters through it.
 *
 * To bundle an original recording: add the file under assets/audiobooks/, list it
 * here keyed by chapter id ({bookId}_{index}) with a `require(...)`, and set the
 * catalog chapter's `audioUrl` to `bundled://<bookId>/<index>`. Keep this SHORT —
 * the app binary grows by the full size of every file listed.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

const BUNDLED_CHAPTERS: Record<string, number> = {};

export function getBundledSource(chapterId: string): number | null {
  return BUNDLED_CHAPTERS[chapterId] ?? null;
}

export function isBookBundled(bookId: string): boolean {
  return Object.keys(BUNDLED_CHAPTERS).some((id) => id.startsWith(`${bookId}_`));
}
