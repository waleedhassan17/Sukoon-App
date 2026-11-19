/** Tiny pure helpers for the prayer UI (countdown text, display names). */

import type { PrayerKey } from './prayerEngine';

/**
 * i18n key for a prayer's display name. Dhuhr on a Friday is Jumu'ah — the same
 * rule the notification titles use (lib/prayerSchedule.ts), so the screen and
 * the alert always agree. `date` is the prayer's own (local) instant.
 */
export function prayerNameKey(key: PrayerKey, date: Date): string {
  return key === 'dhuhr' && date.getDay() === 5 ? 'prayer.name.jumuah' : `prayer.name.${key}`;
}

/** 9_045_000 ms → "02:30:45". Never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

/** Spoken form for screen readers: "2 hours 30 minutes". */
export function spokenCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m > 0 || h === 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}
