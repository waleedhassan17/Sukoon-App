/**
 * Share cards — the pure (React-free, native-free) half of image sharing.
 *
 * Every Ayah / Hadith share in Sukoon is a designed PNG card, never plain text.
 * This module decides WHAT goes on the card and HOW BIG it is set:
 *   - content builders (reference line, narrator split, file name),
 *   - an auto-fit type scale so short and long texts both sit well in the frame,
 *   - the fixed card palettes and output formats.
 *
 * The visual component (`components/share/ShareCard.tsx`) reads the layout
 * constants below, so the estimator and the real layout never drift apart.
 * Everything here is unit-tested in `__tests__/shareCard.test.ts`.
 */

export type ShareKind = 'ayah' | 'hadith';
export type CardLang = 'english' | 'urdu';
export type CardThemeId = 'emerald' | 'midnight' | 'ivory';
export type CardFormatId = 'post' | 'story';

export interface ShareCardContent {
  kind: ShareKind;
  arabic: string;
  english: string;
  urdu: string;
  /** Uppercased on the card, e.g. "Ali 'Imran 3:8" or "Sahih al-Bukhari 6018". */
  reference: string;
  /** Hadith only — pulled out of "Narrated X: …" so it can be set on its own line. */
  narrator?: string;
  grade?: string;
  /** File-system-safe base name, e.g. "sukoon-ayah-ali-imran-3-8". */
  fileName: string;
}

/* ───────────────────────────── Text helpers ───────────────────────────── */

/** Strip stray markup, collapse whitespace and trim. */
export function clean(s?: string | number | null): string {
  return String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase ASCII slug for file names: "Ali 'Imran 3:8" → "ali-imran-3-8". */
export function slugify(s: string, max = 60): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** Arabic letter count without harakat / Quranic marks / tatweel — what drives line count. */
export function arabicLength(s: string): number {
  return clean(String(s ?? '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')).length;
}

/** Spaces before a Quranic pause mark (U+06D6–U+06ED) stay single so the mark hugs its word. */
const BEFORE_WAQF = new RegExp(` +(?=[${String.fromCharCode(0x06d6)}-${String.fromCharCode(0x06ed)}])`, 'g');

/**
 * AlQalamQuran's word space is only 0.1 em (most fonts: ~0.25 em), so words
 * visibly run together at card sizes. Doubling each gap gives ~0.2 em, which
 * reads cleanly without looking spaced out. Presentation only — the stored
 * text is untouched.
 */
export function widenArabicSpaces(s: string): string {
  return s.replace(/ +/g, '  ').replace(BEFORE_WAQF, ' ');
}

/* ───────────────────────────── Content builders ───────────────────────────── */

export interface AyahCardInput {
  surahName?: string | null;
  surahNumber?: number | string | null;
  ayahNumber?: number | string | null;
  /** Range label from the emotion engine, e.g. "5-6" — wins over ayahNumber. */
  ayahLabel?: string | null;
  arabic?: string | null;
  english?: string | null;
  urdu?: string | null;
}

/** "Ali 'Imran 3:8" · "Quran 2:255" when the name is missing (or just a number). */
export function ayahReference(v: AyahCardInput): string {
  const rawName = clean(v.surahName);
  const name = rawName && !/^\d+$/.test(rawName) ? rawName : 'Quran';
  const surah = clean(v.surahNumber);
  const verse = clean(v.ayahLabel) || clean(v.ayahNumber);
  if (surah && verse) return `${name} ${surah}:${verse}`;
  if (verse) return `${name} · Ayah ${verse}`;
  return name;
}

export function ayahCardContent(v: AyahCardInput): ShareCardContent {
  const reference = ayahReference(v);
  return {
    kind: 'ayah',
    arabic: clean(v.arabic),
    english: clean(v.english),
    urdu: clean(v.urdu),
    reference,
    fileName: `sukoon-ayah-${slugify(reference) || 'quran'}`,
  };
}

export interface HadithCardInput {
  bookName?: string | null;
  /** Collection-wide hadith number (sunnah.com style citation). */
  hadithNumber?: number | string | null;
  arabic?: string | null;
  english?: string | null;
  urdu?: string | null;
  grade?: string | null;
}

/** sunnah.com style citation: "Sahih al-Bukhari 6018". */
export function hadithReference(bookName?: string | null, hadithNumber?: number | string | null): string {
  const name = clean(bookName) || 'Hadith';
  const num = clean(hadithNumber);
  return num ? `${name} ${num}` : name;
}

const NARRATOR_RE = /^Narrated\s+(?:by\s+)?([^:\n]{2,80}?)\s*:\s*/i;

/** "Narrated Abu Huraira: The Prophet said…" → { narrator: "Abu Huraira", body: "The Prophet said…" }. */
export function splitNarrator(english: string): { narrator?: string; body: string } {
  const text = clean(english);
  const m = NARRATOR_RE.exec(text);
  if (!m) return { body: text };
  const body = text.slice(m[0].length).trim();
  if (!body) return { body: text };
  return { narrator: m[1].trim(), body };
}

export function hadithCardContent(h: HadithCardInput): ShareCardContent {
  const { narrator, body } = splitNarrator(clean(h.english));
  const reference = hadithReference(h.bookName, h.hadithNumber);
  const grade = clean(h.grade);
  return {
    kind: 'hadith',
    arabic: clean(h.arabic),
    english: body,
    urdu: clean(h.urdu),
    reference,
    ...(narrator ? { narrator } : {}),
    ...(grade ? { grade } : {}),
    fileName: `sukoon-hadith-${slugify(reference) || 'hadith'}`,
  };
}

/* ───────────────────────────── Translation choice ───────────────────────────── */

export function availableLangs(c: ShareCardContent): CardLang[] {
  const out: CardLang[] = [];
  if (c.english) out.push('english');
  if (c.urdu) out.push('urdu');
  return out;
}

/** The preferred translation if the card has it, else whichever exists. */
export function resolveCardLang(c: ShareCardContent, preferred?: CardLang | null): CardLang {
  const langs = availableLangs(c);
  if (preferred && langs.includes(preferred)) return preferred;
  return langs[0] ?? 'english';
}

export function cardTranslation(c: ShareCardContent, lang: CardLang): string {
  return lang === 'urdu' ? c.urdu : c.english;
}

/* ───────────────────────────── Formats & layout ───────────────────────────── */

/** All card geometry is designed on a 360-unit-wide canvas and scaled at render time. */
export const CARD_BASE_WIDTH = 360;
/** Shared image width in pixels — the standard for WhatsApp / Instagram. */
export const CARD_OUTPUT_WIDTH = 1080;

export interface CardFormat {
  id: CardFormatId;
  /** height / width of the minimum frame. */
  aspect: number;
  padTop: number;
  /** Type is set a touch larger on the roomier Story canvas. */
  typeBoost: number;
}

export const CARD_FORMATS: Record<CardFormatId, CardFormat> = {
  post: { id: 'post', aspect: 5 / 4, padTop: 44, typeBoost: 1 },
  story: { id: 'story', aspect: 16 / 9, padTop: 72, typeBoost: 1.08 },
};

/** Fixed vertical rhythm (in base units). ShareCard.tsx uses these exact values. */
export const CARD_LAYOUT = {
  padX: 30,
  padBottom: 16,
  brandBlock: 38,
  ornament: 16,
  ornamentGap: 24,
  dividerGap: 20,
  narrator: 26,
  pillGap: 26,
  pill: 28,
  grade: 22,
} as const;

export function cardFrameHeight(format: CardFormatId): number {
  return Math.round(CARD_BASE_WIDTH * CARD_FORMATS[format].aspect);
}

/** Output pixel size for a laid-out card of (width × height) units/dp. */
export function cardOutputSize(width: number, height: number): { width: number; height: number } {
  const ratio = width > 0 ? height / width : CARD_FORMATS.post.aspect;
  return { width: CARD_OUTPUT_WIDTH, height: Math.round(CARD_OUTPUT_WIDTH * ratio) };
}

/* ───────────────────────────── Type scale ───────────────────────────── */

export interface CardTypeScale {
  arabic: number;
  arabicLine: number;
  translation: number;
  translationLine: number;
}

type Tier = readonly [maxLength: number, size: number];
// Preferred sizes by length. The top tiers match the reference card's bold look.
const ARABIC_TIERS: readonly Tier[] = [[40, 34], [90, 30], [170, 26], [300, 22], [500, 19], [Infinity, 16]];
const TRANSLATION_TIERS: readonly Tier[] = [[80, 24], [160, 21], [280, 18.5], [450, 16], [700, 14], [Infinity, 12.5]];

const ARABIC_MIN = 16;
const TRANSLATION_MIN = 12.5;
/** Nastaleeq looks ~25% smaller than Latin at the same point size. */
const URDU_SCALE = 1.25;
/** Vertical padding ShareCard adds around Urdu text (top + bottom), in base units. */
const URDU_PAD = 4;
/** Fit-to-frame may shrink type to this share of its preferred size; beyond that the card grows. */
const MAX_SHRINK = 0.8;

/**
 * Line-height multipliers. AlQalamQuran's own ascent+descent is 1.75 em and
 * Jameel Noori's 1.41 em; the extra keeps stacked marks from touching.
 */
export const LINE_HEIGHT = { arabic: 1.9, english: 1.5, urdu: 1.75 } as const;

/**
 * Average advance per character as a fraction of the font size, measured with
 * HarfBuzz shaping on the real fonts (AlQalamQuran 0.32, Jameel Noori 0.26,
 * Noto Serif Italic — Android's `serif` — 0.46) plus a margin for word-wrap
 * slack. Used only to estimate line counts.
 */
const ADVANCE = { arabic: 0.34, english: 0.48, urdu: 0.29 } as const;

function tierSize(len: number, tiers: readonly Tier[]): number {
  for (const [max, size] of tiers) if (len <= max) return size;
  return tiers[tiers.length - 1][1];
}

function estimateLines(chars: number, size: number, advance: number, width: number): number {
  if (chars <= 0) return 0;
  return Math.max(1, Math.ceil((chars * size * advance) / width));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Font sizes for a card. Starts from length tiers, then shrinks both texts
 * together (by at most 20%, never below a readable floor) until the estimated
 * block fits the format's frame. Content that still doesn't fit makes the card
 * taller — sacred text is never truncated and type never gets cramped.
 */
export function cardTypeScale(c: ShareCardContent, format: CardFormatId, lang: CardLang): CardTypeScale {
  const f = CARD_FORMATS[format];
  const L = CARD_LAYOUT;
  const translation = cardTranslation(c, lang);
  const arLen = arabicLength(c.arabic);
  const trLen = clean(translation).length;
  const isUrdu = lang === 'urdu';
  const trLineMul = isUrdu ? LINE_HEIGHT.urdu : LINE_HEIGHT.english;
  const trAdvance = isUrdu ? ADVANCE.urdu : ADVANCE.english;

  const arPref = tierSize(arLen, ARABIC_TIERS) * f.typeBoost;
  const urduScale = isUrdu ? URDU_SCALE : 1;
  const trPref = tierSize(trLen, TRANSLATION_TIERS) * urduScale * f.typeBoost;
  const arMin = Math.max(ARABIC_MIN, arPref * MAX_SHRINK);
  const trMin = Math.max(TRANSLATION_MIN * urduScale, trPref * MAX_SHRINK);

  const width = CARD_BASE_WIDTH - 2 * L.padX;
  const fixed =
    f.padTop + L.padBottom + L.brandBlock + L.ornament + L.ornamentGap + L.pillGap + L.pill +
    (c.arabic && translation ? 2 * L.dividerGap + 1 : 0) +
    (c.narrator && !isUrdu ? L.narrator : 0) +
    (c.grade ? L.grade : 0) +
    (isUrdu && translation ? URDU_PAD : 0);
  const available = cardFrameHeight(format) - fixed;

  const blockHeight = (ar: number, tr: number) =>
    estimateLines(arLen, ar, ADVANCE.arabic, width) * ar * LINE_HEIGHT.arabic +
    estimateLines(trLen, tr, trAdvance, width) * tr * trLineMul;

  let ar = arPref;
  let tr = trPref;
  for (let i = 0; i < 24 && blockHeight(ar, tr) > available; i++) {
    if (ar <= arMin && tr <= trMin) break;
    ar = Math.max(arMin, ar * 0.95);
    tr = Math.max(trMin, tr * 0.95);
  }

  ar = round1(ar);
  tr = round1(tr);
  return {
    arabic: ar,
    arabicLine: Math.round(ar * LINE_HEIGHT.arabic),
    translation: tr,
    translationLine: Math.round(tr * trLineMul),
  };
}

/* ───────────────────────────── Palettes ───────────────────────────── */

export interface CardTheme {
  id: CardThemeId;
  /** Top → bottom background. */
  gradient: readonly [string, string];
  /** Soft light at the top of the card for depth. */
  glow: string;
  arabic: string;
  translation: string;
  /** Leaf ornament. */
  accent: string;
  /** Ornament hairlines. */
  rule: string;
  divider: string;
  pillBg: string;
  pillText: string;
  /** Narrator + grade. */
  muted: string;
  /** Brand mark + wordmark. */
  brand: string;
}

/** Fixed palettes — a shared image must look the same whatever theme the sender's app is in. */
export const CARD_THEMES: Record<CardThemeId, CardTheme> = {
  // Matches the reference card: flat deep green #18362A, mint ornament + pill text.
  emerald: {
    id: 'emerald',
    gradient: ['#1B3B2E', '#153126'],
    glow: 'rgba(255,255,255,0.045)',
    arabic: '#FFFFFD',
    translation: '#F3F6F2',
    accent: '#BEE0D0',
    rule: 'rgba(255,255,255,0.22)',
    divider: 'rgba(255,255,255,0.12)',
    pillBg: 'rgba(190,224,208,0.08)',
    pillText: '#C4E6D8',
    muted: 'rgba(196,230,216,0.72)',
    brand: 'rgba(255,255,255,0.45)',
  },
  midnight: {
    id: 'midnight',
    gradient: ['#13202B', '#0B131B'],
    glow: 'rgba(217,185,91,0.05)',
    arabic: '#FBF6EA',
    translation: '#ECE7DB',
    accent: '#D9B95B',
    rule: 'rgba(217,185,91,0.38)',
    divider: 'rgba(255,255,255,0.10)',
    pillBg: 'rgba(217,185,91,0.10)',
    pillText: '#E6C976',
    muted: 'rgba(230,201,118,0.75)',
    brand: 'rgba(255,255,255,0.40)',
  },
  ivory: {
    id: 'ivory',
    gradient: ['#FCF9F2', '#F2EADB'],
    glow: 'rgba(255,255,255,0.5)',
    arabic: '#143D2B',
    translation: '#26372F',
    accent: '#B08D2E',
    rule: 'rgba(176,141,46,0.45)',
    divider: 'rgba(20,61,43,0.14)',
    pillBg: 'rgba(20,61,43,0.07)',
    pillText: '#1F5A40',
    muted: 'rgba(31,90,64,0.75)',
    brand: 'rgba(20,61,43,0.45)',
  },
};

export const CARD_THEME_ORDER: readonly CardThemeId[] = ['emerald', 'midnight', 'ivory'];

/* ───────────────────────────── Saved preferences ───────────────────────────── */

export interface SharePrefs {
  theme: CardThemeId;
  format: CardFormatId;
  /** Last translation picked in the sheet; null = follow the screen's default. */
  lang: CardLang | null;
}

export const DEFAULT_SHARE_PREFS: SharePrefs = { theme: 'emerald', format: 'post', lang: null };

/** Parse persisted prefs defensively — anything unknown falls back to the default. */
export function parseSharePrefs(raw: string | null | undefined): SharePrefs {
  if (!raw) return { ...DEFAULT_SHARE_PREFS };
  try {
    const v = JSON.parse(raw) ?? {};
    const own = (o: object, k: unknown) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
    return {
      theme: own(CARD_THEMES, v.theme) ? v.theme : DEFAULT_SHARE_PREFS.theme,
      format: own(CARD_FORMATS, v.format) ? v.format : DEFAULT_SHARE_PREFS.format,
      lang: v.lang === 'english' || v.lang === 'urdu' ? v.lang : null,
    };
  } catch {
    return { ...DEFAULT_SHARE_PREFS };
  }
}
