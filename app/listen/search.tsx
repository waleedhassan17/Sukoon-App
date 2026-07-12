/**
 * Listen search — instant client-side search over the catalog
 * (title / author / narrator / category).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SPACING } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { Book } from '@/lib/audiobooks/types';
import { CatalogService } from '@/lib/audiobooks/catalog';
import BookCover from '@/components/listen/BookCover';
import NarrationBadge from '@/components/listen/NarrationBadge';

export default function ListenSearchScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocale();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);

  useEffect(() => {
    let cancelled = false;
    CatalogService.search(query).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 8 }}>
      <View style={styles.searchRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="search" size={16} color={theme.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('listen.search.placeholder')}
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { color: theme.text }]}
            autoFocus
            returnKeyType="search"
            accessibilityLabel={t('listen.search.placeholder')}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('common.clear')}>
              <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length > 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={36} color={theme.textTertiary} />
              <Text style={{ color: theme.textSecondary, marginTop: 10 }}>{t('listen.search.noResults')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/listen/book/${item.id}`)}
            style={[styles.row, { borderBottomColor: theme.borderLight }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.author}`}
          >
            <BookCover book={item} size={48} height={64} borderRadius={RADIUS.sm} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text numberOfLines={1} style={[styles.author, { color: theme.textTertiary }]}>{item.author}</Text>
              <View style={{ marginTop: 4 }}>
                <NarrationBadge type={item.narrationType} compact />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.lg,
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  author: {
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    marginTop: SPACING['5xl'],
  },
});
