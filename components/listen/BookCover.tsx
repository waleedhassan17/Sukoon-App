/**
 * BookCover — real cover art with a designed fallback.
 * Every catalog entry that has a legal cover image (archive.org scan,
 * Gutenberg cover, official podcast artwork) sets `coverUrl`. Titles without
 * one (Quran recitations, hadith-api compilations, Sukoon Originals) get a
 * typographic cover in Sukoon's design language — no placeholder icons.
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

  // Typographic cover: gold-framed gradient, serif-feel title block —
  // reads as a designed book cover, not an empty state.
  const isRecitation = book.narrationType === 'recitation';
  const frameInset = Math.max(4, size * 0.045);

  return (
    <LinearGradient
      colors={
        isRecitation
          ? ([theme.primary, theme.primaryLight] as [string, string])
          : (theme.headerGradient as unknown as [string, string, ...string[]])
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fallback, { width: size, height: h, borderRadius: radius }]}
    >
      <View
        style={[
          styles.frame,
          {
            top: frameInset,
            bottom: frameInset,
            left: frameInset,
            right: frameInset,
            borderColor: `${theme.goldLight}66`,
            borderRadius: Math.max(4, radius - frameInset),
          },
        ]}
      />
      <View style={[styles.rule, { backgroundColor: theme.goldLight, width: size * 0.22 }]} />
      <Text
        numberOfLines={3}
        style={[styles.fallbackTitle, { fontSize: Math.max(11, size * 0.095) }]}
      >
        {book.title}
      </Text>
      <View style={[styles.rule, { backgroundColor: theme.goldLight, width: size * 0.22 }]} />
      <Text
        numberOfLines={1}
        style={[
          styles.fallbackAuthor,
          { fontSize: Math.max(9, size * 0.062), color: `${theme.goldLight}CC` },
        ]}
      >
        {book.author}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    borderWidth: 1,
  },
  rule: {
    height: 1.5,
    borderRadius: 1,
    marginVertical: 7,
    opacity: 0.85,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 4,
  },
  fallbackAuthor: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.4,
  },
});
