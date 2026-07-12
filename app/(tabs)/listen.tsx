/**
 * Listen home — Islamic audiobook library.
 * Hero carousel · Jump back in · Browse by category · curated shelves · Kids.
 * Chaptrs-inspired information architecture rendered in Sukoon's design system.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useLocale } from '@/lib/i18n';
import { Book, BookCategory, BookProgress, CATEGORY_LABEL_KEYS } from '@/lib/audiobooks/types';
import { CatalogService } from '@/lib/audiobooks/catalog';
import { ChapterResolver } from '@/lib/audiobooks/chapterResolver';
import { ListenProgress } from '@/lib/audiobooks/progress';
import { formatRemaining } from '@/lib/audiobooks/streaks';
import { audiobookControls } from '@/contexts/AudiobookPlayerContext';
import HeroCarousel from '@/components/listen/HeroCarousel';
import Shelf from '@/components/listen/Shelf';
import CategoryChips from '@/components/listen/CategoryChips';
import BookCover from '@/components/listen/BookCover';

interface ResumeItem {
  book: Book;
  progress: BookProgress;
  remainingLabel: string;
}

export default function ListenScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocale(); // re-render on language change

  const [books, setBooks] = useState<Book[] | null>(null);
  const [resume, setResume] = useState<ResumeItem[]>([]);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const all = await CatalogService.getBooks();
      setBooks(all);

      // "Jump back in" — recent in-progress books with remaining-time labels.
      const recents = await ListenProgress.getRecent(6);
      const items: ResumeItem[] = [];
      for (const p of recents) {
        const book = all.find((b) => b.id === p.bookId);
        if (!book) continue;
        let remainingLabel = '';
        try {
          // Cached for any book the user has played — no network on the hot path.
          const chapters = await ChapterResolver.getChapters(book);
          const total = chapters.reduce((s, c) => s + (c.durationSec || 0), 0);
          remainingLabel = formatRemaining(total, p.secondsListened);
        } catch {}
        items.push({ book, progress: p, remainingLabel });
      }
      setResume(items);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh "Jump back in" whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      if (books) load();
    }, [books, load]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    CatalogService.invalidate();
    await CatalogService.refreshRemote().catch(() => {});
    await load();
    setRefreshing(false);
  }, [load]);

  const featured = useMemo(
    () => (books ?? []).filter((b) => b.featured && b.status === 'ready'),
    [books]
  );
  const kidsBooks = useMemo(() => (books ?? []).filter((b) => b.isKids), [books]);
  const availableCategories = useMemo(() => {
    const set = new Set<BookCategory>();
    for (const b of books ?? []) set.add(b.isKids ? 'kids' : b.category);
    return set;
  }, [books]);
  const shelves = useMemo(() => {
    const grouped = new Map<BookCategory, Book[]>();
    for (const b of books ?? []) {
      if (b.isKids) continue;
      const list = grouped.get(b.category) ?? [];
      list.push(b);
      grouped.set(b.category, list);
    }
    return [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [books]);

  const resumePlay = useCallback(async (item: ResumeItem) => {
    try {
      const chapters = await ChapterResolver.getChapters(item.book);
      await audiobookControls.playBook(item.book, chapters);
    } catch {
      router.push(`/listen/book/${item.book.id}`);
    }
  }, [router]);

  if (!books) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={theme.headerGradient as unknown as [string, string, ...string[]]}
        style={[styles.header, { paddingTop: insets.top + SPACING.lg }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('listen.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('listen.subtitle')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/listen/search')}
            style={styles.searchBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.search.title')}
          >
            <Ionicons name="search" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {error && (
        <TouchableOpacity
          onPress={load}
          style={[styles.errorBanner, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          accessibilityRole="button"
        >
          <Ionicons name="cloud-offline-outline" size={16} color={theme.warning} />
          <Text style={{ color: theme.textSecondary, fontSize: 12, flex: 1 }}>
            {t('listen.error.offline')}
          </Text>
          <Text style={{ color: theme.primaryMuted, fontSize: 12, fontWeight: '600' }}>
            {t('listen.retry')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Hero — handpicked */}
      <View style={{ marginTop: SPACING.xl }}>
        <HeroCarousel books={featured} />
      </View>

      {/* Jump back in */}
      {resume.length > 0 && (
        <View style={{ marginTop: SPACING['2xl'] }}>
          <Text style={[TYPOGRAPHY.headlineMedium, styles.sectionTitle, { color: theme.text }]}>
            {t('listen.jumpBackIn')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.md }}
          >
            {resume.map((item) => (
              <TouchableOpacity
                key={item.book.id}
                activeOpacity={0.85}
                onPress={() => resumePlay(item)}
                style={[
                  styles.resumeCard,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${t('listen.jumpBackIn')}: ${item.book.title}`}
              >
                <BookCover book={item.book} size={52} borderRadius={RADIUS.sm} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.resumeTitle, { color: theme.text }]}>
                    {item.book.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.resumeMeta, { color: theme.textTertiary }]}>
                    {t('listen.chapterN', { n: item.progress.chapterIndex + 1 })}
                    {item.remainingLabel ? ` · ${item.remainingLabel}` : ''}
                  </Text>
                </View>
                <View style={[styles.resumePlay, { backgroundColor: theme.primary }]}>
                  <Ionicons name="play" size={14} color={theme.textOnPrimary} style={{ marginLeft: 1 }} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Browse by category */}
      <View style={{ marginTop: SPACING['2xl'], marginBottom: SPACING['2xl'] }}>
        <Text style={[TYPOGRAPHY.headlineMedium, styles.sectionTitle, { color: theme.text }]}>
          {t('listen.browseCategories')}
        </Text>
        <CategoryChips availableCategories={availableCategories} />
      </View>

      {/* Kids shelf first (colorful but on-brand), then topic shelves */}
      {kidsBooks.length > 0 && (
        <Shelf
          title={`🧒 ${t('listen.cat.kids')}`}
          books={kidsBooks}
          onSeeAll={() => router.push('/listen/category/kids')}
        />
      )}
      {shelves.map(([cat, catBooks]) => (
        <Shelf
          key={cat}
          title={t(CATEGORY_LABEL_KEYS[cat])}
          books={catBooks}
          onSeeAll={() => router.push(`/listen/category/${cat}`)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['2xl'],
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginTop: 3,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    width: 270,
  },
  resumeTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  resumeMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  resumePlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
