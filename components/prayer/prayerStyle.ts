/**
 * One visual identity per prayer, shared by the prayer screens.
 * Gradients match the Salah Tracker and Tracker Settings, so a prayer is the
 * same colour everywhere; the Arabic names are the Tracker's, character for
 * character.
 */

import type { PrayerKey } from '@/lib/prayerEngine';
import { MIN_TOUCH } from '@/constants/theme';

export interface PrayerVisual {
  icon: string; // Ionicons name
  grad: readonly [string, string];
}

export const PRAYER_STYLE: Record<PrayerKey, PrayerVisual> = {
  fajr: { icon: 'moon-outline', grad: ['#56A8E2', '#3D8FCC'] },
  sunrise: { icon: 'sunny-outline', grad: ['#E8B04A', '#D4952B'] },
  dhuhr: { icon: 'sunny', grad: ['#F0C146', '#DBA830'] },
  asr: { icon: 'partly-sunny', grad: ['#F09846', '#DB7F30'] },
  maghrib: { icon: 'cloudy-night', grad: ['#9B72CF', '#7C56B2'] },
  isha: { icon: 'moon', grad: ['#4568B8', '#3350A0'] },
};

const ARABIC: Record<PrayerKey, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظُّهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العِشاء',
};

/**
 * Arabic name shown beside the prayer's name. Dhuhr on a Friday is Jumu'ah —
 * the same rule as `prayerNameKey` (lib/prayerFormat.ts). `date` is the
 * prayer's own local instant.
 */
export function prayerArabicName(key: PrayerKey, date: Date): string {
  return key === 'dhuhr' && date.getDay() === 5 ? 'الجمعة' : ARABIC[key];
}

/** Minimum touch target (px) per platform guidelines / docs/design-system.md. */
export const HIT = MIN_TOUCH;
