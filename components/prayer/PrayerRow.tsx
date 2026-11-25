/**
 * PrayerRow — one prayer as a card, in the Salah Tracker's card style:
 * gradient badge, name with its Arabic beside it, and on the trailing side the
 * time and a bell.
 *
 * Past prayers are dimmed; the next one gets a tinted border and an "Up next"
 * pill. The bell toggles the azan alert for that
 * prayer; sunrise passes `alertOn={null}` because it is not a prayer and has no
 * alert. The Arabic name is hidden in Urdu, where the name is already in script.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { t, useLocale } from '@/lib/i18n';
import { PrayerKey } from '@/lib/prayerEngine';
import { PRAYER_STYLE, HIT } from './prayerStyle';

export type RowState = 'past' | 'next' | 'upcoming';

export default function PrayerRow({
  prayerKey,
  label,
  arabic,
  time,
  state,
  alertOn,
  onToggleAlert,
}: {
  prayerKey: PrayerKey;
  label: string;
  arabic: string;
  time: string;
  state: RowState;
  /** null = no bell (sunrise). */
  alertOn: boolean | null;
  onToggleAlert?: () => void;
}) {
  const { theme } = useTheme();
  const locale = useLocale();
  const v = PRAYER_STYLE[prayerKey];
  const accent = v.grad[0];
  const isNext = state === 'next';
  const isPast = state === 'past';

  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor },
        isNext && { borderColor: `${accent}40` },
      ]}
    >
      <View
        style={[s.main, isPast && s.dim]}
        accessible
        accessibilityLabel={`${label}, ${time}${isNext ? `, ${t('prayer.upNext')}` : ''}`}
      >
        <LinearGradient colors={[...v.grad]} style={s.badge}>
          <Ionicons name={v.icon as any} size={18} color="#FFFFFF" />
        </LinearGradient>

        <View style={s.center}>
          <View style={s.nameRow}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>
              {label}
            </Text>
            {locale !== 'ur' && (
              <Text style={[s.arabic, { color: `${theme.textTertiary}90` }]} numberOfLines={1}>
                {arabic}
              </Text>
            )}
          </View>
          {isNext && (
            <View style={[s.pill, { backgroundColor: `${theme.primary}12` }]}>
              <Ionicons name="time-outline" size={13} color={theme.primary} />
              <Text style={[s.pillText, { color: theme.primary }]}>{t('prayer.upNext')}</Text>
            </View>
          )}
        </View>

        <Text style={[s.time, { color: theme.text }]}>{time}</Text>
      </View>

      {alertOn === null ? (
        // Keep the time column aligned with the cards that have a bell.
        <View style={s.bellSpacer} />
      ) : (
        <TouchableOpacity
          onPress={onToggleAlert}
          style={s.bell}
          activeOpacity={0.6}
          accessibilityRole="switch"
          accessibilityState={{ checked: alertOn }}
          accessibilityLabel={t(alertOn ? 'prayer.alertOn' : 'prayer.alertOff', { name: label })}
        >
          <Ionicons
            name={alertOn ? 'notifications' : 'notifications-off-outline'}
            size={20}
            color={alertOn ? theme.primary : theme.textTertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // Card geometry matches the Tracker's pCard / pBadge / pStatusRow.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    paddingEnd: 4,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dim: { opacity: 0.5 },
  badge: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginStart: 14, marginEnd: 12 },
  center: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  arabic: { flexShrink: 1, fontSize: 15, fontFamily: 'AlQalamQuran', writingDirection: 'rtl' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '600' },
  time: { marginStart: 8, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bell: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', marginStart: 2 },
  bellSpacer: { width: HIT + 2 },
});
