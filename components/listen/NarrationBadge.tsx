/**
 * NarrationBadge — every book is labelled Human narration / AI narration /
 * Recitation (Play-policy transparency + brief requirement).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { NarrationType } from '@/lib/audiobooks/types';

export default function NarrationBadge({ type, compact }: { type: NarrationType; compact?: boolean }) {
  const { theme } = useTheme();

  const config = {
    human: { icon: 'person' as const, label: t('listen.badge.human'), color: theme.primary },
    ai: { icon: 'hardware-chip-outline' as const, label: t('listen.badge.ai'), color: theme.gold },
    recitation: { icon: 'musical-note' as const, label: t('listen.badge.recitation'), color: theme.accent },
  }[type];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${config.color}22`,
          paddingHorizontal: compact ? 6 : 10,
          paddingVertical: compact ? 2 : 4,
        },
      ]}
      accessibilityLabel={config.label}
    >
      <Ionicons name={config.icon} size={compact ? 9 : 11} color={config.color} />
      <Text style={[styles.label, { color: config.color, fontSize: compact ? 9 : 11 }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    gap: 4,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
