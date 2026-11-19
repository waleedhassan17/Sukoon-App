/**
 * NextPrayerCard — the one thing the screen leads with.
 * Name, time and a live countdown on a quiet frosted card. After Isha it shows
 * tomorrow's Fajr (labelled in the eyebrow), and Friday's Dhuhr reads Jumu'ah.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t, useLocale } from '@/lib/i18n';
import { PrayerTimesService } from '@/lib/prayerTimes';
import { NextPrayerInfo } from '@/lib/prayerEngine';
import { prayerNameKey } from '@/lib/prayerFormat';
import LiveCountdown from './LiveCountdown';

export default function NextPrayerCard({ next }: { next: NextPrayerInfo }) {
  useLocale();
  const nextMs = next.time.getTime();
  const name = t(prayerNameKey(next.key, next.time));
  const timeText = PrayerTimesService.formatInstant(nextMs);
  const eyebrow = next.isTomorrow
    ? `${t('prayer.nextPrayer')} · ${t('prayer.tomorrow')}`
    : t('prayer.nextPrayer');

  return (
    <View style={s.card} accessible accessibilityLabel={`${eyebrow}: ${name}, ${timeText}`}>
      <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>

      <View style={s.nameRow}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <Text style={s.time}>{timeText}</Text>
      </View>

      <View style={s.divider} />

      <View style={s.countRow}>
        <Text style={s.countLabel} numberOfLines={1}>{t('prayer.timeUntil', { name })}</Text>
        <LiveCountdown target={nextMs} style={s.count} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: 'rgba(255,255,255,0.72)' },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  name: { flexShrink: 1, fontSize: 30, fontWeight: '800', letterSpacing: -0.4, color: '#FFFFFF' },
  time: { marginStart: 12, fontSize: 22, fontWeight: '600', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.22)', marginVertical: 14 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  countLabel: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.78)' },
  count: { marginStart: 12, fontSize: 30, fontWeight: '700', letterSpacing: 0.5, color: '#FFFFFF' },
});
