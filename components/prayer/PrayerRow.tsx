/**
 * PrayerRow — one line of the prayer list: icon, name, time, and a bell.
 *
 * Past prayers are dimmed; the next one gets a soft tint and accent edge. The
 * bell toggles the azan alert for that prayer; sunrise passes `alertOn={null}`
 * because it is not a prayer and has no alert.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { t } from '@/lib/i18n';
import { PrayerKey } from '@/lib/prayerEngine';
import { PRAYER_STYLE, HIT } from './prayerStyle';

export type RowState = 'past' | 'next' | 'upcoming';

export default function PrayerRow({
  prayerKey,
  label,
  time,
  state,
  alertOn,
  onToggleAlert,
  last,
}: {
  prayerKey: PrayerKey;
  label: string;
  time: string;
  state: RowState;
  /** null = no bell (sunrise). */
  alertOn: boolean | null;
  onToggleAlert?: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const v = PRAYER_STYLE[prayerKey];
  const accent = v.grad[0];
  const isNext = state === 'next';

  return (
    <View
      style={[
        s.row,
        isNext && { backgroundColor: `${accent}14` },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      {isNext && <View style={[s.accentBar, { backgroundColor: accent }]} />}

      <View style={[s.main, state === 'past' && s.dim]} accessible accessibilityLabel={`${label}, ${time}`}>
        <LinearGradient colors={[...v.grad]} style={s.badge}>
          <Ionicons name={v.icon as any} size={18} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[s.label, { color: theme.text }, isNext && s.labelNext]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[s.time, { color: theme.text }]}>{time}</Text>
      </View>

      {alertOn === null ? (
        // Keep the time column aligned with the rows that have a bell.
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
            size={21}
            color={alertOn ? theme.primary : theme.textTertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingStart: 16, paddingEnd: 4, minHeight: 62 },
  accentBar: { position: 'absolute', start: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dim: { opacity: 0.5 },
  badge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, marginStart: 14, fontSize: 17, fontWeight: '600' },
  labelNext: { fontWeight: '700' },
  time: { marginStart: 8, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bell: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', marginStart: 2 },
  bellSpacer: { width: HIT + 2 },
});
