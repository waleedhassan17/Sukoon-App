/**
 * MushafService — line-based Quran layout, served from BUNDLED JSON built from
 * the QUL layout databases the user provided (verified complete: 114/114 surahs,
 * contiguous word coverage):
 *   • assets/mushaf/layout-15.json → Indo-Pak 15-line (Qudratullah), 610 pages
 *   • assets/mushaf/layout-16.json → Indo-Pak 16-line (Taj Company), 548 pages
 *
 * Each page is a list of rows in print order:
 *   { t:'s', n }      → surah-name banner (n = surah number)
 *   { t:'b' }         → Bismillah line
 *   { t:'a', c, w }   → an ayah text line (c=1 centred; w = Indo-Pak words with
 *                       ayah numbers as plain Arabic-Indic digits)
 *
 * Authentic printed page/line breaks: every full page has exactly 15 / 16 lines,
 * page 1 = Al-Fatiha, page 2 = Al-Baqarah opening.
 */

export interface MushafRow {
  t: 's' | 'b' | 'a';
  n?: number;  // surah number (for 's' rows)
  c?: number;  // 1 = centred line (for 'a' rows)
  w?: string;  // line text (for 'a' rows)
}

export interface MushafLayout {
  linesPerPage: number;
  totalPages: number;
  name: string;
  juzPages: number[]; // juzPages[j-1] = first page of juz j in THIS layout
  pages: Record<string, MushafRow[]>;
}

let cache15: MushafLayout | null = null;
let cache16: MushafLayout | null = null;

export function getLayout(lines: number): MushafLayout {
  if (lines === 16) {
    if (!cache16) cache16 = require('@/assets/mushaf/layout-16.json') as MushafLayout;
    return cache16;
  }
  if (!cache15) cache15 = require('@/assets/mushaf/layout-15.json') as MushafLayout;
  return cache15;
}

export function getPageRows(layout: MushafLayout, pageNumber: number): MushafRow[] {
  return layout.pages[String(pageNumber)] || [];
}

/** True if a word token is an ayah-end marker (pure Arabic-Indic digits). */
export function isAyahNumber(token: string): boolean {
  return /^[٠-٩]+$/.test(token);
}

/** Map every page → the surah it belongs to (carried over on continuation pages). */
export function buildPageSurahMap(layout: MushafLayout): Record<number, number> {
  const map: Record<number, number> = {};
  let current = 1;
  for (let p = 1; p <= layout.totalPages; p++) {
    const banner = layout.pages[String(p)]?.find((r) => r.t === 's' && r.n);
    if (banner?.n) current = banner.n;
    map[p] = current;
  }
  return map;
}

/** The juz (para) number a page belongs to, using this layout's juz pages. */
export function juzForPage(layout: MushafLayout, pageNumber: number): number {
  let juz = 1;
  for (let j = 0; j < layout.juzPages.length; j++) {
    if (pageNumber >= layout.juzPages[j]) juz = j + 1;
    else break;
  }
  return juz;
}
