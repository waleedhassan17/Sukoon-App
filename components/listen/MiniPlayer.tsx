/**
 * MiniPlayer — global playback dock, rendered once in the root layout so it
 * persists above the bottom navigation across the whole app (Chaptrs pattern,
 * Sukoon skin). Hidden when nothing is loaded, on the full player screen, and
 * on the Quran reader (which has its own floating player).
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SHADOWS } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { audiobookControls, useAudiobookPlayer } from '@/contexts/AudiobookPlayerContext';
import BookCover from './BookCover';

const TAB_BAR_HEIGHT = 60; // keep in sync with app/(tabs)/_layout.tsx
const TAB_ROUTES = new Set(['/', '/listen', '/quran', '/saved', '/others', '/settings']);

export default function MiniPlayer() {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const state = useAudiobookPlayer();

  const { book, chapters, chapterIndex, isPlaying, isBuffering, positionMs, durationMs } = state;

  if (!book) return null;
  // Full player has its own controls; Quran reader has its own floating player.
  if (pathname.startsWith('/listen/player') || pathname.startsWith('/quran/')) return null;

  const chapter = chapters[chapterIndex];
  const onTabScreen = TAB_ROUTES.has(pathname);
  const bottom = onTabScreen ? TAB_BAR_HEIGHT + insets.bottom + 8 : insets.bottom + 12;
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push('/listen/player')}
        accessibilityRole="button"
        accessibilityLabel={t('listen.miniplayer.open')}
        style={[
          styles.card,
          SHADOWS.lg,
          { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        ]}
      >
        <BookCover book={book} size={40} borderRadius={RADIUS.sm} />
        <View style={styles.info}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {book.title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: theme.textSecondary }]}>
            {chapter?.title ?? ''}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => audiobookControls.skipBack()}
          style={styles.controlBtn}
          accessibilityRole="button"
          accessibilityLabel={t('listen.player.back15')}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons name="play-back" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => audiobookControls.togglePlayPause()}
          style={[styles.playBtn, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('listen.player.pause') : t('listen.player.play')}
        >
          {isBuffering ? (
            <ActivityIndicator size="small" color={theme.textOnPrimary} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={theme.textOnPrimary}
              style={!isPlaying ? { marginLeft: 2 } : undefined}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => audiobookControls.stop()}
          style={styles.controlBtn}
          accessibilityRole="button"
          accessibilityLabel={t('listen.miniplayer.close')}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Ionicons name="close" size={18} color={theme.textTertiary} />
        </TouchableOpacity>

        {/* progress hairline along the bottom edge */}
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.primaryLight, width: `${progress * 100}%` },
            ]}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    marginRight: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  controlBtn: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
  },
  progressFill: {
    height: 2,
  },
});
