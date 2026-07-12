/**
 * Full-screen audiobook player.
 * Cover · chapter title · scrubber · ±15/30s · speed · sleep timer · chapters.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS, SPACING } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { audiobookControls, useAudiobookPlayer } from '@/contexts/AudiobookPlayerContext';
import { formatPlayerTime } from '@/lib/audiobooks/player';
import BookCover from '@/components/listen/BookCover';
import NarrationBadge from '@/components/listen/NarrationBadge';

const SLEEP_PRESETS = [10, 20, 30, 45, 60];

export default function FullPlayerScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useAudiobookPlayer();
  useLocale();

  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  // Scrub preview: while dragging we show the target position without seeking.
  const [scrubFraction, setScrubFraction] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(1);

  const { book, chapters, chapterIndex, isPlaying, isBuffering, positionMs, durationMs, speed, sleepTimer, sleepRemainingMs, error } = state;
  const chapter = chapters[chapterIndex];

  const progress = useMemo(() => {
    if (scrubFraction !== null) return scrubFraction;
    return durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  }, [scrubFraction, positionMs, durationMs]);

  const seekToFraction = useCallback(
    (fraction: number) => {
      if (durationMs > 0) audiobookControls.seekTo(fraction * durationMs);
    },
    [durationMs]
  );

  if (!book) {
    // Player opened with nothing loaded (e.g. after stop) — return to Listen.
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={{ color: theme.primaryMuted, fontWeight: '600' }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sleepLabel =
    sleepTimer.kind === 'minutes'
      ? formatPlayerTime(sleepRemainingMs)
      : sleepTimer.kind === 'endOfChapter'
      ? t('listen.sleep.endOfChapter.short')
      : '';

  return (
    <LinearGradient
      colors={theme.headerGradient as unknown as [string, string, ...string[]]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + SPACING['3xl'],
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.topBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.minimize')}
          >
            <Ionicons name="chevron-down" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text numberOfLines={1} style={styles.topTitle}>
            {book.title}
          </Text>
          <TouchableOpacity
            onPress={() => setChaptersOpen(true)}
            style={styles.topBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.chapters')}
          >
            <Ionicons name="list" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Artwork */}
        <View style={styles.artWrap}>
          <BookCover book={book} size={230} height={230} borderRadius={RADIUS['2xl']} />
        </View>

        {/* Titles */}
        <View style={styles.titles}>
          <Text numberOfLines={2} style={styles.chapterTitle}>
            {chapter?.title ?? ''}
          </Text>
          <Text numberOfLines={1} style={styles.bookMeta}>
            {t('listen.chapterOf', { n: chapterIndex + 1, total: chapters.length })} · {book.narrator}
          </Text>
          <View style={{ marginTop: 8, alignItems: 'center' }}>
            <NarrationBadge type={book.narrationType} />
          </View>
        </View>

        {error && (
          <TouchableOpacity
            onPress={() => audiobookControls.playBook(book, chapters, chapterIndex)}
            style={styles.errorRow}
            accessibilityRole="button"
          >
            <Ionicons name="warning-outline" size={14} color="#FFD7A0" />
            <Text style={styles.errorText}>
              {t('listen.error.playback')} — {t('listen.retry')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Scrubber */}
        <View style={styles.scrubberWrap}>
          <View
            style={styles.track}
            onLayout={(e) => setTrackWidth(Math.max(1, e.nativeEvent.layout.width))}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) =>
              setScrubFraction(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth)))
            }
            onResponderMove={(e) =>
              setScrubFraction(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth)))
            }
            onResponderRelease={() => {
              if (scrubFraction !== null) seekToFraction(scrubFraction);
              setScrubFraction(null);
            }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('listen.player.seekbar')}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          >
            <View style={styles.trackBg} />
            <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {formatPlayerTime(scrubFraction !== null ? scrubFraction * durationMs : positionMs)}
            </Text>
            <Text style={styles.timeText}>{formatPlayerTime(durationMs)}</Text>
          </View>
        </View>

        {/* Transport controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => audiobookControls.previousChapter()}
            style={styles.ctrlBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.prevChapter')}
          >
            <Ionicons name="play-skip-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => audiobookControls.skipBack()}
            style={styles.ctrlBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.back15')}
          >
            <View style={styles.skipWrap}>
              <Ionicons name="refresh" size={30} color="#FFF" style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.skipLabel}>15</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => audiobookControls.togglePlayPause()}
            style={styles.playBtn}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t('listen.player.pause') : t('listen.player.play')}
          >
            {isBuffering ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={38}
                color={theme.primary}
                style={!isPlaying ? { marginLeft: 4 } : undefined}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => audiobookControls.skipForward()}
            style={styles.ctrlBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.forward30')}
          >
            <View style={styles.skipWrap}>
              <Ionicons name="refresh" size={30} color="#FFF" />
              <Text style={styles.skipLabel}>30</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => audiobookControls.nextChapter()}
            style={styles.ctrlBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.nextChapter')}
          >
            <Ionicons name="play-skip-forward" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Secondary row: speed + sleep */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            onPress={() => audiobookControls.cycleSpeed()}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.speed')}
          >
            <Ionicons name="speedometer-outline" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.secondaryText}>{speed}x</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSleepOpen(true)}
            style={[styles.secondaryBtn, sleepTimer.kind !== 'off' && styles.secondaryBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={t('listen.player.sleepTimer')}
          >
            <Ionicons name="moon-outline" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.secondaryText}>
              {sleepTimer.kind === 'off' ? t('listen.player.sleepTimer') : sleepLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {book.attribution && <Text style={styles.attribution}>{book.attribution}</Text>}
      </ScrollView>

      {/* Chapters sheet */}
      <Modal visible={chaptersOpen} animationType="slide" transparent onRequestClose={() => setChaptersOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setChaptersOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.surfaceElevated, paddingBottom: insets.bottom + 8 }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('listen.player.chapters')}</Text>
            <FlatList
              data={chapters}
              keyExtractor={(c) => c.id}
              initialScrollIndex={Math.min(chapterIndex, Math.max(0, chapters.length - 1))}
              getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => {
                    setChaptersOpen(false);
                    audiobookControls.skipToChapter(index);
                  }}
                  style={[styles.sheetRow, { borderBottomColor: theme.borderLight }]}
                  accessibilityRole="button"
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: index === chapterIndex ? theme.primary : theme.text,
                      fontWeight: index === chapterIndex ? '700' : '400',
                      fontSize: 14,
                    }}
                  >
                    {index + 1}. {item.title}
                  </Text>
                  {item.durationSec > 0 && (
                    <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                      {formatPlayerTime(item.durationSec * 1000)}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 420 }}
            />
          </View>
        </View>
      </Modal>

      {/* Sleep timer sheet */}
      <Modal visible={sleepOpen} animationType="slide" transparent onRequestClose={() => setSleepOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetBackdrop}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSleepOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.surfaceElevated, paddingBottom: insets.bottom + 16 }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('listen.player.sleepTimer')}</Text>
            <View style={styles.sleepGrid}>
              {SLEEP_PRESETS.map((min) => (
                <TouchableOpacity
                  key={min}
                  onPress={() => {
                    audiobookControls.setSleepTimerMinutes(min);
                    setSleepOpen(false);
                  }}
                  style={[styles.sleepChip, { backgroundColor: theme.surfaceMuted }]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: theme.text, fontWeight: '600' }}>
                    {t('listen.sleep.minutes', { n: min })}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => {
                  audiobookControls.setSleepEndOfChapter();
                  setSleepOpen(false);
                }}
                style={[styles.sleepChip, { backgroundColor: theme.surfaceMuted }]}
                accessibilityRole="button"
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>
                  {t('listen.sleep.endOfChapter')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.customRow}>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                keyboardType="number-pad"
                placeholder={t('listen.sleep.customPlaceholder')}
                placeholderTextColor={theme.textTertiary}
                style={[styles.customInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
                accessibilityLabel={t('listen.sleep.customPlaceholder')}
              />
              <TouchableOpacity
                onPress={() => {
                  const mins = parseInt(customMinutes, 10);
                  if (mins > 0) {
                    audiobookControls.setSleepTimerMinutes(mins);
                    setCustomMinutes('');
                    setSleepOpen(false);
                  }
                }}
                style={[styles.customSet, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
              >
                <Text style={{ color: theme.textOnPrimary, fontWeight: '700' }}>{t('listen.sleep.set')}</Text>
              </TouchableOpacity>
            </View>
            {sleepTimer.kind !== 'off' && (
              <TouchableOpacity
                onPress={() => {
                  audiobookControls.cancelSleepTimer();
                  setSleepOpen(false);
                }}
                style={{ marginTop: 14, alignItems: 'center' }}
                accessibilityRole="button"
              >
                <Text style={{ color: theme.error, fontWeight: '600' }}>{t('listen.sleep.cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  topBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  artWrap: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  titles: {
    alignItems: 'center',
    paddingHorizontal: SPACING['3xl'],
    marginTop: SPACING['2xl'],
  },
  chapterTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  bookMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  errorText: {
    color: '#FFD7A0',
    fontSize: 12,
    fontWeight: '600',
  },
  scrubberWrap: {
    paddingHorizontal: SPACING['2xl'],
    marginTop: SPACING['3xl'],
  },
  track: {
    height: 28,
    justifyContent: 'center',
  },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginLeft: -7,
    top: 7,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  ctrlBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    position: 'absolute',
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    top: 12,
  },
  playBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING['2xl'],
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    minHeight: 40,
  },
  secondaryBtnActive: {
    backgroundColor: 'rgba(212,175,55,0.35)',
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
  },
  attribution: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: SPACING['2xl'],
    paddingHorizontal: SPACING['3xl'],
    fontStyle: 'italic',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sleepGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sleepChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    minHeight: 40,
    justifyContent: 'center',
  },
  customRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  customInput: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  customSet: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
