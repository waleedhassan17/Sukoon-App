/**
 * Shelf — horizontal row of book tiles with a section header ("Browse shelves"
 * pattern). Also exports BookTile for grids/lists.
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { Book } from '@/lib/audiobooks/types';
import BookCover from './BookCover';
import NarrationBadge from './NarrationBadge';

export function BookTile({ book, width = 128 }: { book: Book; width?: number }) {
  const { theme } = useTheme();
  const router = useRouter();
  const pendingAudio = book.status !== 'ready';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/listen/book/${book.id}`)}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}, ${book.author}`}
    >
      <View>
        <BookCover book={book} size={width} />
        {pendingAudio && (
          <View style={[styles.pendingOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <Ionicons name="hourglass-outline" size={14} color="#FFF" />
            <Text style={styles.pendingText}>{t('listen.comingSoon')}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={[styles.tileTitle, { color: theme.text }]}>
        {book.title}
      </Text>
      <Text numberOfLines={1} style={[styles.tileAuthor, { color: theme.textTertiary }]}>
        {book.author}
      </Text>
      <View style={{ marginTop: 4 }}>
        <NarrationBadge type={book.narrationType} compact />
      </View>
    </TouchableOpacity>
  );
}

interface ShelfProps {
  title: string;
  books: Book[];
  onSeeAll?: () => void;
}

export default function Shelf({ title, books, onSeeAll }: ShelfProps) {
  const { theme } = useTheme();
  if (books.length === 0) return null;

  return (
    <View style={styles.shelf}>
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.headlineMedium, { color: theme.text }]}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity
            onPress={onSeeAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('listen.seeAll')}
          >
            <Text style={[styles.seeAll, { color: theme.primaryMuted }]}>{t('listen.seeAll')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        data={books}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BookTile book={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.md }}
        initialNumToRender={4}
        windowSize={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: {
    marginBottom: SPACING['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 17,
  },
  tileAuthor: {
    fontSize: 11,
    marginTop: 2,
  },
  pendingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  pendingText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
