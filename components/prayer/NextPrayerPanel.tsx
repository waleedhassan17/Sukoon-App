/**
 * NextPrayerPanel — what's next, in the Salah Tracker's stats-panel style.
 *
 *   ┌──────────────┬──────────────┬──────────────┐
 *   │     Asr      │   3:22 PM    │   01:46:52   │
 *   │ Next prayer  │    Begins    │  Time left   │
 *   └──────────────┴──────────────┴──────────────┘
 *
 * After Isha it shows tomorrow's Fajr (the first label reads "Tomorrow"), and
 * Friday's Dhuhr reads Jumu'ah. Also exports the panel-shaped loading skeleton.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t, useLocale } from '@/lib/i18n';
import { PrayerTimesService } from '@/lib/prayerTimes';
import { NextPrayerInfo } from '@/lib/prayerEngine';
import { prayerNameKey } from '@/lib/prayerFormat';
import LiveCountdown from './LiveCountdown';

const FIT = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 } as const;

export default function NextPrayerPanel({ next }: { next: NextPrayerInfo }) {
  useLocale();
  const nextMs = next.time.getTime();
  const name = t(prayerNameKey(next.key, next.time));
  const timeText = PrayerTimesService.formatInstant(nextMs);
  const nameLabel = next.isTomorrow ? t('prayer.tomorrow') : t('prayer.nextPrayer');

  return (
    <View style={s.panel} accessible accessibilityLabel={`${t('prayer.nextPrayer')}: ${name}, ${timeText}`}>
      <View style={s.stat}>
        <Text style={s.value} {...FIT}>{name}</Text>
        <Text style={s.label} numberOfLines={1}>{nameLabel}</Text>
      </View>
      <View style={s.divider} />
      <View style={s.stat}>
        <Text style={s.value} {...FIT}>{timeText}</Text>
        <Text style={s.label} numberOfLines={1}>{t('prayer.begins')}</Text>
      </View>
      <View style={s.divider} />
      <View style={s.stat}>
        <LiveCountdown target={nextMs} style={s.value} {...FIT} />
        <Text style={s.label} numberOfLines={1}>{t('prayer.timeLeft')}</Text>
      </View>
    </View>
  );
}

/** Same footprint as the panel, for the first paint while times load. */
export function NextPrayerPanelSkeleton() {
  return <View style={[s.panel, s.skeleton]} />;
}

const s = StyleSheet.create({
  // Matches the Tracker's statsRow / statBox / statBigNum / statLabel / statDivider.
  panel: {
    flexDirection: 'row',
    // Bottom-align the columns so the labels share a line even when a value's
    // script is taller (Urdu prayer names).
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeleton: { height: 82 },
  stat: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  value: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2, color: 'rgba(255,255,255,0.6)' },
  divider: { alignSelf: 'center', width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },
});
