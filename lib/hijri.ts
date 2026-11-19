/**
 * Offline Gregorian → Hijri conversion.
 *
 * Prefers the platform's Umm al-Qura calendar (`Intl`) when it is available and
 * sane — that is the civil calendar used in Saudi Arabia and by most Islamic
 * apps. Where `Intl` has no Islamic calendar (some Hermes/ICU builds), it falls
 * back to the tabular arithmetic calendar, which is within ±1 day.
 *
 * Pure, synchronous, no network.
 */

export interface HijriParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
}

export const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Awwal', 'Jumada al-Thani',
  'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

export const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

/** Gregorian y/m/d → Julian Day Number (proleptic Gregorian). */
function toJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

/** Tabular (arithmetic) Islamic calendar. Deterministic, ±1 day of observation. */
export function gregorianToHijriTabular(date: Date): HijriParts {
  const jdn = toJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  let l = jdn - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/** Umm al-Qura via Intl, or null if the runtime can't do it. */
function viaIntl(date: Date): HijriParts | null {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return null;
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    if (!String(fmt.resolvedOptions().calendar).startsWith('islamic')) return null;
    const parts = fmt.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const year = get('year');
    const month = get('month');
    const day = get('day');
    // Sanity: a real Hijri date in the current era.
    if (!(year >= 1300 && year <= 1700) || !(month >= 1 && month <= 12) || !(day >= 1 && day <= 30)) {
      return null;
    }
    return { year, month, day };
  } catch {
    return null;
  }
}

/** Best available Hijri date for a Gregorian `Date` (local calendar day). */
export function gregorianToHijri(date: Date = new Date()): HijriParts {
  return viaIntl(date) ?? gregorianToHijriTabular(date);
}

export function hijriMonthName(month: number, lang: 'en' | 'ar' = 'en'): string {
  const list = lang === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN;
  return list[(month - 1 + 12) % 12];
}

/** e.g. "8 Jumada al-Thani 1448 AH" */
export function formatHijri(date: Date = new Date(), lang: 'en' | 'ar' = 'en'): string {
  const h = gregorianToHijri(date);
  return `${h.day} ${hijriMonthName(h.month, lang)} ${h.year} AH`;
}
