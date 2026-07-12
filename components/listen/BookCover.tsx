/**
 * BookCover — cover art with a designed fallback.
 * Remote covers (archive.org etc.) can be missing/slow; the fallback renders a
 * Sukoon-branded gradient card with the title so shelves never look broken.
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS } from '@/constants/theme';
import { Book } from '@/lib/audiobooks/types';

interface BookCoverProps {
  book: Book;
  size: number;
  /** Height defaults to size (square, like Chaptrs shelf tiles). */
  height?: number;
  borderRadius?: number;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  quran: 'book',
  sirah: 'footsteps',
  hadith: 'chatbubble-ellipses',
  aqidah: 'shield-checkmark',
  spirituality: 'sparkles',
  selfhelp: 'trending-up',
  history: 'time',
  geography: 'earth',
  fiction: 'library',
  kids: 'happy',
};

export default function BookCover({ book, size, height, borderRadius }: BookCoverProps) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const h = height ?? size;
  const radius = borderRadius ?? RADIUS.md;

  if (book.coverUrl && !failed) {
    return (
      <Image
        source={{ uri: book.coverUrl }}
        onError={() => setFailed(true)}
        style={{ width: size, height: h, borderRadius: radius, backgroundColor: theme.surfaceMuted }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <LinearGradient
      colors={theme.headerGradient as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fallback, { width: size, height: h, borderRadius: radius }]}
    >
      <Ionicons
        name={CATEGORY_ICONS[book.category] ?? 'book'}
        size={Math.max(18, size * 0.18)}
        color={theme.goldLight}
        style={{ marginBottom: 6 }}
      />
      <Text
        numberOfLines={3}
        style={[styles.fallbackTitle, { fontSize: Math.max(11, size * 0.085) }]}
      >
        {book.title}
      </Text>
      <Text numberOfLines={1} style={[styles.fallbackAuthor, { fontSize: Math.max(9, size * 0.06) }]}>
        {book.author}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  fallbackAuthor: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 3,
  },
});
