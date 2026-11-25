/**
 * PrayerHeader — the Salah family's header, for Prayer Times.
 *
 * Mirrors the Salah Tracker header exactly (flat gradient, 36 pt rounded-square
 * buttons, 18/700 title, gold ornament), so moving between Prayer Times, the
 * Tracker and Tracker Settings feels like one product. The buttons draw at
 * 36 pt but take touches across 44 pt via hitSlop.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { MIN_TOUCH } from '@/constants/theme';
import { t } from '@/lib/i18n';

const BTN = 36;
const SLOP = (MIN_TOUCH - BTN) / 2;
const HIT_SLOP = { top: SLOP, bottom: SLOP, left: SLOP, right: SLOP };

/** Gold hairline · diamond · hairline — the Salah screens' ornament. */
export function Ornament() {
  const { theme } = useTheme();
  return (
    <View style={s.ornRow} importantForAccessibility="no-hide-descendants">
      <View style={[s.ornLine, { backgroundColor: `${theme.gold}4D` }]} />
      <View style={[s.ornDiamond, { backgroundColor: `${theme.gold}80` }]} />
      <View style={[s.ornLine, { backgroundColor: `${theme.gold}4D` }]} />
    </View>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
  size = 20,
  color = '#FFFFFF',
}: {
  icon: string;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={HIT_SLOP}
      style={s.btn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon as any} size={size} color={color} />
    </TouchableOpacity>
  );
}

export default function PrayerHeader({
  title,
  onBack,
  right,
  children,
}: {
  title: string;
  onBack: () => void;
  right?: { icon: string; label: string; onPress: () => void };
  children?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.header, { paddingTop: insets.top + 6 }]}
    >
      <View style={s.bar}>
        <HeaderButton
          icon={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
          label={t('common.back')}
          onPress={onBack}
        />
        <Text style={s.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {right ? (
          <HeaderButton icon={right.icon} label={right.label} onPress={right.onPress} size={18} color="rgba(255,255,255,0.85)" />
        ) : (
          <View style={s.btnSpacer} />
        )}
      </View>
      <Ornament />
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 22, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSpacer: { width: BTN },
  title: { flex: 1, marginHorizontal: 12, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },

  ornRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 4 },
  ornLine: { width: 28, height: 1 },
  ornDiamond: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },
});
