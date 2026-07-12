/**
 * Book detail — cover, author/narrator, duration, description, chapter list,
 * play / download / library actions, attribution + narration badge.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SPACING } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { Book, Chapter, isDownloadable } from '@/lib/audiobooks/types';
import { getBundledSource } from '@/lib/audiobooks/bundledAudio';
import { CatalogService } from '@/lib/audiobooks/catalog';
import { ChapterResolver } from '@/lib/audiobooks/chapterResolver';
import { ListenProgress } from '@/lib/audiobooks/progress';
import { DownloadManager } from '@/lib/audiobooks/downloads';
import { ListenAnalytics } from '@/lib/audiobooks/analytics';
import { audiobookControls, useAudiobookPlayer } from '@/contexts/AudiobookPlayerContext';
import { formatPlayerTime } from '@/lib/audiobooks/player';
import BookCover from '@/components/listen/BookCover';
import NarrationBadge from '@/components/listen/NarrationBadge';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const playerState = useAudiobookPlayer();
  useLocale();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [resumeChapterId, setResumeChapterId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(false);
    const b = await CatalogService.getBook(id);
    setBook(b);
    if (!b) {
      setChapters([]); // resolves the loading state so "not found" can render
      return;
    }
    setInLibrary(await ListenProgress.isInLibrary(b.id));
    const progress = await ListenProgress.get(b.id);
    setResumeChapterId(progress && !progress.completed ? progress.chapterId : null);
    setDownloaded(await DownloadManager.getDownloadedChapterIds(b.id));
    if (b.status !== 'ready' && b.chapterSource.kind === 'static' && !(b.chapters?.length)) {
      setChapters([]);
      return;
    }
    try {
      setChapters(await ChapterResolver.getChapters(b));
    } catch {
      setLoadError(true);
      setChapters([]);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const totalDurationSec = useMemo(
    () => (chapters ?? []).reduce((s, c) => s + (c.durationSec || 0), 0),
    [chapters]
  );

  const isPending = book ? book.status !== 'ready' : false;
  const canDownload = book ? isDownloadable(book) : false;
  const isCurrentBook = playerState.book?.id === book?.id;

  const playFrom = useCallback(
    async (chapterIndex?: number) => {
      if (!book || !chapters || chapters.length === 0) return;
      await audiobookControls.playBook(book, chapters, chapterIndex);
      router.push('/listen/player');
    },
    [book, chapters, router]
  );

  const toggleLibrary = useCallback(async () => {
    if (!book) return;
    if (inLibrary) {
      await ListenProgress.removeFromLibrary(book.id);
      setInLibrary(false);
    } else {
      await ListenProgress.addToLibrary(book.id);
      setInLibrary(true);
    }
  }, [book, inLibrary]);

  const downloadChapter = useCallback(
    async (chapter: Chapter) => {
      if (!book) return;
      setDownloading((d) => ({ ...d, [chapter.id]: 0 }));
      try {
        await DownloadManager.downloadChapter(book, chapter, (f) =>
          setDownloading((d) => ({ ...d, [chapter.id]: f }))
        );
        setDownloaded((s) => new Set([...s, chapter.id]));
        ListenAnalytics.track({ name: 'listen_download', bookId: book.id });
      } catch {
        Alert.alert(t('listen.download.failedTitle'), t('listen.download.failedBody'));
      } finally {
        setDownloading((d) => {
          const next = { ...d };
          delete next[chapter.id];
          return next;
        });
      }
    },
    [book]
  );

  const downloadAll = useCallback(async () => {
    if (!book || !chapters) return;
    for (const ch of chapters) {
      if (downloaded.has(ch.id)) continue;
      // Sequential on purpose — kind to the free archives we stream from.
      // eslint-disable-next-line no-await-in-loop
      await downloadChapter(ch);
    }
  }, [book, chapters, downloaded, downloadChapter]);

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {chapters === null ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <Text style={{ color: theme.textSecondary }}>{t('listen.bookNotFound')}</Text>
        )}
      </View>
    );
  }

  const header = (
    <View>
      <LinearGradient
        colors={theme.headerGradient as unknown as [string, string, ...string[]]}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.heroContent}>
          <BookCover book={book} size={132} height={176} borderRadius={RADIUS.lg} />
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{book.author}</Text>
          <View style={styles.metaRow}>
            <NarrationBadge type={book.narrationType} />
            {totalDurationSec > 0 && (
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaPillText}>{formatPlayerTime(totalDurationSec * 1000)}</Text>
              </View>
            )}
            {chapters && chapters.length > 0 && (
              <View style={styles.metaPill}>
                <Ionicons name="list-outline" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaPillText}>
                  {t('listen.chapterCount', { count: chapters.length })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Action row */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => playFrom(resumeChapterId || isCurrentBook ? undefined : 0)}
          disabled={isPending || !chapters || chapters.length === 0}
          style={[
            styles.playButton,
            { backgroundColor: isPending ? theme.surfaceMuted : theme.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('listen.playBook')}
        >
          <Ionicons
            name={isPending ? 'hourglass-outline' : 'play'}
            size={18}
            color={isPending ? theme.textTertiary : theme.textOnPrimary}
          />
          <Text
            style={[
              styles.playButtonText,
              { color: isPending ? theme.textTertiary : theme.textOnPrimary },
            ]}
          >
            {isPending
              ? t('listen.preparingAudio')
              : resumeChapterId
              ? t('listen.resume')
              : t('listen.playBook')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleLibrary}
          style={[styles.iconAction, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={inLibrary ? t('listen.removeFromLibrary') : t('listen.addToLibrary')}
        >
          <Ionicons
            name={inLibrary ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={inLibrary ? theme.gold : theme.textSecondary}
          />
        </TouchableOpacity>
        {canDownload && !isPending && (
          <TouchableOpacity
            onPress={downloadAll}
            style={[styles.iconAction, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('listen.downloadAll')}
          >
            <Ionicons name="download-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Description + attribution */}
      <View style={styles.section}>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{book.description}</Text>
        {book.attribution && (
          <Text style={[styles.attribution, { color: theme.textTertiary }]}>{book.attribution}</Text>
        )}
        {!canDownload && !isPending && (
          <Text style={[styles.attribution, { color: theme.textTertiary }]}>
            {t('listen.streamOnly')}
          </Text>
        )}
      </View>

      {loadError && (
        <TouchableOpacity
          onPress={load}
          style={[styles.errorBox, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
          accessibilityRole="button"
        >
          <Ionicons name="cloud-offline-outline" size={18} color={theme.warning} />
          <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
            {t('listen.error.chapters')}
          </Text>
          <Text style={{ color: theme.primaryMuted, fontWeight: '600', fontSize: 13 }}>
            {t('listen.retry')}
          </Text>
        </TouchableOpacity>
      )}

      {chapters === null && !loadError && (
        <ActivityIndicator style={{ marginTop: SPACING['2xl'] }} color={theme.primary} />
      )}

      {isPending && (
        <View style={[styles.pendingBox, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="sparkles-outline" size={16} color={theme.gold} />
          <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
            {t('listen.pendingExplainer')}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
      data={chapters ?? []}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => {
        const isCurrent = isCurrentBook && playerState.chapterIndex === index;
        const isResume = item.id === resumeChapterId;
        const dlProgress = downloading[item.id];
        const isOnDevice = downloaded.has(item.id) || getBundledSource(item.id) !== null;
        return (
          <TouchableOpacity
            onPress={() => playFrom(index)}
            style={[styles.chapterRow, { borderBottomColor: theme.borderLight }]}
            accessibilityRole="button"
            accessibilityLabel={`${t('listen.chapterN', { n: index + 1 })}: ${item.title}`}
          >
            <Text style={[styles.chapterIndex, { color: isCurrent ? theme.primary : theme.textTertiary }]}>
              {index + 1}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={[
                  styles.chapterTitle,
                  { color: isCurrent ? theme.primary : theme.text },
                  isCurrent && { fontWeight: '700' },
                ]}
              >
                {item.title}
              </Text>
              <Text style={[styles.chapterMeta, { color: theme.textTertiary }]}>
                {item.durationSec > 0 ? formatPlayerTime(item.durationSec * 1000) : ''}
                {isResume ? `  ·  ${t('listen.resumePoint')}` : ''}
              </Text>
            </View>
            {canDownload &&
              (dlProgress !== undefined ? (
                <Text style={[styles.dlProgress, { color: theme.primaryMuted }]}>
                  {Math.round(dlProgress * 100)}%
                </Text>
              ) : isOnDevice ? (
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
              ) : (
                <TouchableOpacity
                  onPress={() => downloadChapter(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('listen.downloadChapter')}
                >
                  <Ionicons name="download-outline" size={20} color={theme.textTertiary} />
                </TouchableOpacity>
              ))}
            {isCurrent && playerState.isPlaying && (
              <Ionicons name="volume-high" size={16} color={theme.primary} />
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    paddingBottom: SPACING['2xl'],
    borderBottomLeftRadius: RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  author: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  metaPillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: RADIUS.full,
  },
  playButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  iconAction: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  attribution: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  chapterIndex: {
    width: 26,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  chapterMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  dlProgress: {
    fontSize: 11,
    fontWeight: '600',
    width: 34,
    textAlign: 'right',
  },
});
