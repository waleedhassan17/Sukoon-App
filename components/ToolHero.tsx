/**
 * ToolHero — the one header every tool screen shares (Prayer Times, Qibla,
 * Tasbeeh). A quiet gradient with rounded bottom corners, a 44 pt back button, a
 * centred title and an optional right-hand action; anything the screen wants to
 * lead with (location, status, the dhikr) goes in as children.
 *
 * Keeping it in one place is what makes the tools feel like one product.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { MIN_TOUCH } from '@/constants/theme';
import { t } from '@/lib/i18n';

/** Round translucent icon button for use on the hero gradient. */
export function HeroIconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[s.iconBtn, disabled && s.iconBtnDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={icon as any} size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

export default function ToolHero({
  title,
  onBack,
  right,
  children,
}: {
  title: string;
  onBack: () => void;
  /** Usually a <HeroIconButton/>. Omit to keep the title centred. */
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.hero, { paddingTop: insets.top + 8 }]}
    >
      <View style={s.bar}>
        <HeroIconButton
          icon={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
          label={t('common.back')}
          onPress={onBack}
        />
        <Text style={s.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {right ?? <View style={s.spacer} />}
      </View>
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomStartRadius: 28,
    borderBottomEndRadius: 28,
  },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  iconBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  iconBtnDisabled: { opacity: 0.45 },
  spacer: { width: MIN_TOUCH },
});
