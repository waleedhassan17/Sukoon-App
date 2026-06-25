/**
 * Centralised, WhatsApp-friendly share formatting for Ayahs and Hadiths.
 *
 * Why this exists:
 *  - WhatsApp (and most chat apps) render text in a *proportional* font, so
 *    ASCII "boxes" built from ┌ ─ ┐ │ characters never line up and look broken.
 *  - Chat apps DO understand a small markdown subset: *bold*, _italic_,
 *    ~strike~ and ```mono```. We lean on that for a clean, premium look that
 *    survives copy/paste into any messenger.
 *
 * The result is a calm, well-spaced "card" that reads professionally in a chat
 * bubble without depending on monospace alignment.
 */

const DIVIDER = '┄┄┄┄┄┄┄┄┄┄┄┄┄';
const APP_FOOTER = '🌙 _Shared via Sukoon_';

/** Collapse stray whitespace and trim — keeps shared text tidy. */
function clean(s?: string | null): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

export interface AyahShareData {
  surahName?: string | null;
  surahNumber?: number | string | null;
  ayahNumber?: number | string | null;
  arabic?: string | null;
  english?: string | null;
  urdu?: string | null;
}

/** Build a polished, chat-ready message for a Quran verse. */
export function buildAyahShareMessage(v: AyahShareData): string {
  const arabic = clean(v.arabic);
  const english = clean(v.english);
  const urdu = clean(v.urdu);
  const surahName = clean(v.surahName) || 'Quran';

  const ref =
    v.surahNumber != null && v.ayahNumber != null
      ? `${v.surahNumber}:${v.ayahNumber}`
      : v.ayahNumber != null
        ? `Ayah ${v.ayahNumber}`
        : '';

  const lines: string[] = ['﷽', ''];

  // Ornate parentheses in correct RTL order: ﴾ … ﴿
  if (arabic) lines.push(`﴾ ${arabic} ﴿`, '');
  if (english) lines.push(`“${english}”`, '');
  if (urdu) lines.push(urdu, '');

  lines.push(DIVIDER);
  lines.push(`📖 *Surah ${surahName}*${ref ? `  ·  ${ref}` : ''}`);
  lines.push(APP_FOOTER);

  return lines.join('\n');
}

export interface HadithShareData {
  bookName?: string | null;
  arabic?: string | null;
  english?: string | null;
  urdu?: string | null;
  book?: number | string | null;
  hadith?: number | string | null;
  grade?: string | null;
}

/** Build a polished, chat-ready message for a Hadith. */
export function buildHadithShareMessage(h: HadithShareData): string {
  const arabic = clean(h.arabic);
  const translation = clean(h.english) || clean(h.urdu);
  const bookName = clean(h.bookName) || 'Hadith';
  const grade = clean(h.grade);

  const refParts: string[] = [];
  if (h.book != null && h.book !== '') refParts.push(`Book ${h.book}`);
  if (h.hadith != null && h.hadith !== '') refParts.push(`Hadith ${h.hadith}`);
  const ref = refParts.join(', ');

  const lines: string[] = [`☪️ *${bookName}*`, ''];

  if (arabic) lines.push(arabic, '');
  if (translation) lines.push(`“${translation}”`, '');

  lines.push(DIVIDER);
  lines.push(`📌 *${bookName}*${ref ? `  ·  ${ref}` : ''}`);
  if (grade) lines.push(`✓ ${grade}`);
  lines.push(APP_FOOTER);

  return lines.join('\n');
}
