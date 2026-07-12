/**
 * Category listing — grid of books for one category.
 * The Kids category doubles as the Kids section: brighter on-brand header,
 * only isKids content (no ads/tracking — Play Families friendly).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SPACING } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { Book, BookCategory, CATEGORY_LABEL_KEYS } from '@/lib/audiobooks/types';
import { CatalogService } from '@/lib/audiobooks/catalog';
import { BookTile } from '@/components/listen/Shelf';

export default function CategoryScreen() {
  const { cat } = useLocalSearchParams<{ cat: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useLocale();

  const [books, setBooks] = useState<Book[] | null>(null);
  const category = (cat ?? 'spirituality') as BookCategory;
  const isKidsSection = category === 'kids';

  useEffect(() => {
    CatalogService.getByCategory(category).then(setBooks).catch(() => setBooks([]));
  }, [category]);

  const tileWidth = useMemo(() => (width - SPACING.lg * 2 - SPACING.md) / 2, [width]);

  const gradientColors = isKidsSection
    ? ([theme.primaryLight, theme.primary] as [string, string])
    : (theme.headerGradient as unknown as [string, string, ...string[]]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <LinearGradient colors={gradientColors} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isKidsSection && <Ionicons name="happy" size={24} color={theme.goldLight} />}
          <Text style={styles.headerTitle}>{t(CATEGORY_LABEL_KEYS[category] ?? 'listen.title')}</Text>
        </View>
        {isKidsSection && <Text style={styles.kidsSubtitle}>{t('listen.kids.subtitle')}</Text>}
      </LinearGradient>

      {books === null ? (
        <ActivityIndicator style={{ marginTop: SPACING['3xl'] }} size="large" color={theme.primary} />
      ) : books.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="library-outline" size={40} color={theme.textTertiary} />
          <Text style={{ color: theme.textSecondary, marginTop: 10 }}>{t('listen.empty.category')}</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.id}
          numColumns={2}
          columnWrapperStyle={{ gap: SPACING.md, paddingHorizontal: SPACING.lg }}
          contentContainerStyle={{ paddingTop: SPACING.xl, paddingBottom: 140 + insets.bottom, gap: SPACING.xl }}
          renderItem={({ item }) => <BookTile book={item} width={tileWidth} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: SPACING.sm,
  },
  kidsSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    paddingHorizontal: SPACING.md,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    marginTop: SPACING['5xl'],
    paddingHorizontal: SPACING['3xl'],
  },
});
