/**
 * HeroCarousel — "Handpicked for you" top shelf on the Listen home.
 * Full-width paged cards on the Sukoon header gradient with a play affordance
 * (Chaptrs top-shelf pattern, Sukoon design language).
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { Book } from '@/lib/audiobooks/types';
import BookCover from './BookCover';
import NarrationBadge from './NarrationBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;

export default function HeroCarousel({ books }: { books: Book[] }) {
  const { theme } = useTheme();
  const router = useRouter();
  if (books.length === 0) return null;

  return (
    <FlatList
      horizontal
      pagingEnabled={false}
      snapToInterval={CARD_WIDTH + SPACING.md}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      data={books}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.md }}
      renderItem={({ item }) => (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push(`/listen/book/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${t('listen.hero.badge')}: ${item.title}`}
        >
          <LinearGradient
            colors={theme.headerGradient as unknown as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, SHADOWS.lg, { width: CARD_WIDTH }]}
          >
            <BookCover book={item} size={96} height={130} borderRadius={RADIUS.md} />
            <View style={styles.cardInfo}>
              <View style={[styles.heroBadge, { backgroundColor: 'rgba(212,175,55,0.25)' }]}>
                <Ionicons name="star" size={10} color={theme.goldLight} />
                <Text style={[styles.heroBadgeText, { color: theme.goldLight }]}>
                  {t('listen.hero.badge')}
                </Text>
              </View>
              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={styles.cardAuthor}>
                {item.author}
              </Text>
              <View style={styles.cardFooter}>
                <NarrationBadge type={item.narrationType} compact />
                <View style={[styles.playPill, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
                  <Ionicons name="play" size={12} color="#FFF" />
                  <Text style={styles.playPillText}>{t('listen.hero.listen')}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: RADIUS['2xl'],
    padding: SPACING.lg,
    gap: SPACING.lg,
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginBottom: 8,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardAuthor: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  playPillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
