/**
 * Timezone-aware local-date helpers.
 *
 * Date keys are LOCAL date strings (YYYY-MM-DD) per the user's IANA timezone.
 * We intentionally never compare UTC offsets: by storing the local date string
 * and the IANA tz alongside it, DST transitions and travel both fall out
 * naturally — a "day" is whatever the user's wall clock sees as that calendar day.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Format a Date as YYYY-MM-DD as observed in the given IANA timezone. */
export function localDateKey(date: Date, timezone: string): string {
  // Intl.DateTimeFormat gives us each part in the target timezone, regardless of
  // the host's local tz. We use 'en-CA' which formats as YYYY-MM-DD by default.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** True iff `dateStr` is a valid YYYY-MM-DD string. */
export function isValidDateKey(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string') return false;
  const m = DATE_RE.exec(dateStr);
  if (!m) return false;
  const [, y, mo, d] = m;
  const month = Number(mo), day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Round-trip through Date to reject e.g. 2025-02-30
  const probe = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  return !isNaN(probe.getTime())
    && probe.getUTCFullYear() === Number(y)
    && probe.getUTCMonth() + 1 === month
    && probe.getUTCDate() === day;
}

/** Return the date key one calendar day before `dateKey` (no tz conversion needed — pure date math). */
export function previousDateKey(dateKey: string): string {
  const m = DATE_RE.exec(dateKey);
  if (!m) throw new Error(`Invalid date key: ${dateKey}`);
  const [, y, mo, d] = m;
  // Use UTC to avoid host-tz drift; we're only doing arithmetic on the date itself.
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  date.setUTCDate(date.getUTCDate() - 1);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Number of whole calendar days from `a` to `b` (b - a). Negative if b is earlier. */
export function dayDiff(a: string, b: string): number {
  const aMs = parseDateKeyToUTC(a);
  const bMs = parseDateKeyToUTC(b);
  return Math.round((bMs - aMs) / 86400000);
}

function parseDateKeyToUTC(dateKey: string): number {
  const m = DATE_RE.exec(dateKey);
  if (!m) throw new Error(`Invalid date key: ${dateKey}`);
  const [, y, mo, d] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d));
}

/** Validate IANA timezone string by feeding it to the Intl API. */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
