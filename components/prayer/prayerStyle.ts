/**
 * One visual identity per prayer, shared across the app.
 * Gradients match the Salah Tracker and Salah Settings screens so a prayer is
 * the same colour everywhere (the old Prayer screen used a different, off-palette
 * set — Fajr was indigo here but sky-blue in the tracker).
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

/** Minimum touch target (px) per platform guidelines / docs/design-system.md. */
export const HIT = MIN_TOUCH;
