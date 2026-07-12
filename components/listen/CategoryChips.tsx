/**
 * CategoryChips — "Browse by category" chip cloud (Chaptrs pattern, Sukoon skin).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SPACING } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { BookCategory, CATEGORY_LABEL_KEYS } from '@/lib/audiobooks/types';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL_KEYS) as BookCategory[];

interface CategoryChipsProps {
  /** Only render categories that actually have books. */
  availableCategories?: Set<BookCategory>;
  selected?: BookCategory | null;
  onSelect?: (cat: BookCategory) => void;
}

export default function CategoryChips({
  availableCategories,
  selected,
  onSelect,
}: CategoryChipsProps) {
  const { theme, mode } = useTheme();
  const router = useRouter();
  const isDark = mode === 'dark';

  const cats = availableCategories
    ? ALL_CATEGORIES.filter((c) => availableCategories.has(c))
    : ALL_CATEGORIES;

  return (
    <View style={styles.cloud}>
      {cats.map((cat) => {
        const isSelected = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => (onSelect ? onSelect(cat) : router.push(`/listen/category/${cat}`))}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected
                  ? theme.primary
                  : isDark
                  ? 'rgba(116,198,157,0.12)'
                  : 'rgba(27,67,50,0.07)',
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? theme.textOnPrimary : theme.primaryMuted },
              ]}
            >
              {t(CATEGORY_LABEL_KEYS[cat])}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
