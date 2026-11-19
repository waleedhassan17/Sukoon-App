/**
 * ToolStateCard — the single, calm card used when a tool can't show its content
 * (location permission denied, GPS off, sensor missing, …): an icon, a headline,
 * one sentence of help and one or two clear actions.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { MIN_TOUCH, SHADOWS } from '@/constants/theme';

export default function ToolStateCard({
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: string;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={[s.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, SHADOWS.sm]}>
      <View style={[s.icon, { backgroundColor: `${theme.primary}14` }]}>
        <Ionicons name={icon as any} size={30} color={theme.primary} />
      </View>
      <Text style={[s.title, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[s.body, { color: theme.textSecondary }]}>{body}</Text>

      <TouchableOpacity
        onPress={onPrimary}
        activeOpacity={0.85}
        style={[s.primary, { backgroundColor: theme.primary }]}
        accessibilityRole="button"
      >
        <Text style={s.primaryText}>{primaryLabel}</Text>
      </TouchableOpacity>

      {!!secondaryLabel && !!onSecondary && (
        <TouchableOpacity onPress={onSecondary} style={s.secondary} accessibilityRole="button">
          <Text style={[s.secondaryText, { color: theme.primary }]}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  primary: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondary: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { fontSize: 15, fontWeight: '600' },
});
