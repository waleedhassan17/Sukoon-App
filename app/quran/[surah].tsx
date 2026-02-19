/**
 * SurahScreen - Premium Quran Reader
 * Luxury spiritual reading experience with refined aesthetics
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Share,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSavedVerses } from '@/contexts/SavedVersesContext';
import { useTheme } from '@/contexts/ThemeContext';
import QuranService, { Ayah } from '@/lib/quranService';
import audioPlayer, { PlayerState, RepeatMode } from '@/lib/audioPlayer';
import { ReadingProgress } from '@/lib/readingProgress';

const { width: SW } = Dimensions.get('window');

/* ─── Shared ornament ─── */
function Ornament({ variant = 'diamond' }: { variant?: 'diamond' | 'dot' }) {
  const { theme } = useTheme();
  return (
    <View style={s.ornRow}>
      <View style={[s.ornLine, { backgroundColor: `${theme.gold}4D` }]} />
      {variant === 'diamond' ? (
        <View style={[s.ornDiamond, { backgroundColor: `${theme.gold}80` }]} />
      ) : (
        <View style={[s.ornDot, { backgroundColor: `${theme.gold}66` }]} />
      )}
      <View style={[s.ornLine, { backgroundColor: `${theme.gold}4D` }]} />
    </View>
  );
}

/* ═══════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════ */
function SurahHeader({
  englishName,
  arabicName,
  ayahCount,
  revelationType,
  onBack,
}: {
  englishName: string;
  arabicName: string;
  ayahCount?: number;
  revelationType?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.header, { paddingTop: insets.top + 6 }]}
    >
      {/* Pattern */}
      <View style={s.headerPat}>
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            style={[
              s.patCircle,
              {
                width: 100 + i * 50,
                height: 100 + i * 50,
                top: -10 + i * 8,
                right: -30 + i * 12,
                opacity: 0.03 + i * 0.008,
              },
            ]}
          />
        ))}
      </View>

      {/* Top bar */}
      <View style={s.headerBar}>
        <TouchableOpacity style={s.headerBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {/* Center content — always visible, not scroll-dependent */}
      <View style={s.headerCenter}>
        <Ornament variant="diamond" />

        <Text style={s.headerArabic}>{arabicName}</Text>
        <Text style={s.headerEnglish}>{englishName}</Text>

        {(ayahCount || revelationType) && (
          <View style={s.headerMeta}>
            {revelationType && (
              <View style={s.metaPill}>
                <Ionicons
                  name={revelationType === 'Meccan' ? 'sunny-outline' : 'moon-outline'}
                  size={11}
                  color="rgba(255,255,255,0.6)"
                />
                <Text style={s.metaPillText}>{revelationType}</Text>
              </View>
            )}
            {ayahCount && (
              <View style={s.metaPill}>
                <Ionicons name="layers-outline" size={11} color="rgba(255,255,255,0.6)" />
                <Text style={s.metaPillText}>{ayahCount} Verses</Text>
              </View>
            )}
          </View>
        )}

        <Ornament variant="dot" />
      </View>
    </LinearGradient>
  );
}

/* ═══════════════════════════════════════════════
   SEGMENTED CONTROL
   ═══════════════════════════════════════════════ */
function SegmentedControl({
  showEnglish,
  showUrdu,
  showTafseer,
  onToggle,
}: {
  showEnglish: boolean;
  showUrdu: boolean;
  showTafseer: boolean;
  onToggle: (type: 'english' | 'urdu' | 'tafseer') => void;
}) {
  const { theme } = useTheme();
  const segs = [
    { key: 'english' as const, label: 'English', active: showEnglish },
    { key: 'urdu' as const, label: 'اردو', active: showUrdu },
    { key: 'tafseer' as const, label: 'Tafseer', active: showTafseer },
  ];

  return (
    <View style={[s.segOuter, { backgroundColor: theme.surface }]}>
      <View style={[s.segTrack, { backgroundColor: theme.surfaceMuted }]}>
        {segs.map((seg, i) => (
          <React.Fragment key={seg.key}>
            {i > 0 && <View style={s.segDiv} />}
            <TouchableOpacity
              style={[s.segBtn, seg.active && [s.segBtnActive, { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadowColor }]]}
              onPress={() => onToggle(seg.key)}
              activeOpacity={0.7}
            >
              {seg.active && <View style={[s.segDot, { backgroundColor: theme.primaryMuted }]} />}
              <Text style={[s.segText, { color: theme.textTertiary }, seg.active && { color: theme.primary }]}>
                {seg.label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   BISMILLAH
   ═══════════════════════════════════════════════ */
function BismillahFrame() {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[s.bisWrap, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.bisGradient}
      >
        {/* Corner decorations */}
        <View style={[s.bisCorner, s.bisCornerTL]} />
        <View style={[s.bisCorner, s.bisCornerTR]} />
        <View style={[s.bisCorner, s.bisCornerBL]} />
        <View style={[s.bisCorner, s.bisCornerBR]} />

        <Ornament variant="diamond" />

        <Text style={s.bisArabic}>
          بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ
        </Text>

        <View style={[s.bisDivider, { backgroundColor: `${theme.gold}4D` }]} />

        <Text style={s.bisTrans}>
          In the name of Allah, the Most Gracious, the Most Merciful
        </Text>

        <Ornament variant="dot" />
      </LinearGradient>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════
   VERSE CARD
   ═══════════════════════════════════════════════ */
function VerseCard({
  ayahNumber,
  arabicText,
  englishText,
  urduText,
  showEnglish,
  showUrdu,
  isBookmarked,
  isPlaying,
  onBookmark,
  onPlay,
  onShare,
}: {
  ayahNumber: number;
  arabicText: string;
  englishText?: string;
  urduText?: string;
  showEnglish: boolean;
  showUrdu: boolean;
  isBookmarked: boolean;
  isPlaying: boolean;
  onBookmark: () => void;
  onPlay: () => void;
  onShare: () => void;
}) {
  const { theme } = useTheme();
  const hasTranslation = (showEnglish && englishText) || (showUrdu && urduText);

  return (
    <View style={[s.vCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }, isPlaying && { borderColor: `${theme.primaryMuted}25` }]}>
      {/* Accent bar */}
      <View style={[s.vAccent, { backgroundColor: theme.border }, isPlaying && { backgroundColor: theme.primaryMuted }]} />

      <View style={s.vInner}>
        {/* Top row: number + actions */}
        <View style={s.vTopRow}>
          <LinearGradient
            colors={isPlaying ? [theme.primaryLight, theme.primary] : [theme.surfaceMuted, theme.surfaceMuted]}
            style={s.vNumBadge}
          >
            <Text style={[s.vNumText, { color: theme.textSecondary }, isPlaying && s.vNumTextActive]}>
              {ayahNumber}
            </Text>
          </LinearGradient>

          <View style={s.vActions}>
            <TouchableOpacity
              style={[s.vActBtn, isPlaying && { backgroundColor: theme.primaryMuted }]}
              onPress={onPlay}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={14}
                color={isPlaying ? '#fff' : theme.textTertiary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={s.vActBtn} onPress={onBookmark} activeOpacity={0.7}>
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={isBookmarked ? theme.gold : theme.textTertiary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={s.vActBtn} onPress={onShare} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Arabic */}
        <Text style={[s.vArabic, { color: theme.arabicText }]}>{arabicText}</Text>

        {/* Translations */}
        {hasTranslation && (
          <View style={s.vTransWrap}>
            <View style={[s.vGoldLine, { backgroundColor: `${theme.gold}4D` }]} />

            {showEnglish && englishText && (
              <View style={s.vTransBlock}>
                <Text style={[s.vTransLabel, { color: theme.textTertiary }]}>TRANSLATION</Text>
                <Text style={[s.vEnglish, { color: theme.textSecondary }]}>{englishText}</Text>
              </View>
            )}

            {showUrdu && urduText && (
              <View style={s.vTransBlock}>
                <Text style={[s.vUrduLabel, { color: theme.textTertiary }]}>اردو ترجمہ</Text>
                <Text style={[s.vUrdu, { color: theme.textSecondary }]}>{urduText}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   AUDIO PLAYER
   ═══════════════════════════════════════════════ */
function PlayerBar({
  state,
  surahName,
  currentAyah,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onCycleSpeed,
  onCycleRepeat,
  onClose,
}: {
  state: PlayerState;
  surahName: string;
  currentAyah: number | null;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (progress: number) => void;
  onCycleSpeed: () => void;
  onCycleRepeat: () => void;
  onClose: () => void;
}) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const insets = useSafeAreaInsets();
  const trackWidth = useRef(SW - 40);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekProgress, setSeekProgress] = useState(0);

  const displayProgress = isSeeking ? seekProgress : state.progress;

  const repeatIcon = state.repeatMode === 'one' ? 'repeat' : state.repeatMode === 'all' ? 'repeat' : 'repeat-outline';
  const repeatColor = state.repeatMode !== 'none' ? theme.primaryMuted : theme.textTertiary;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => {
        setIsSeeking(true);
        const prog = Math.max(0, Math.min(1, gs.x0 / trackWidth.current));
        setSeekProgress(prog);
      },
      onPanResponderMove: (_, gs) => {
        const prog = Math.max(0, Math.min(1, (gs.x0 + gs.dx) / trackWidth.current));
        setSeekProgress(prog);
      },
      onPanResponderRelease: () => {
        onSeek(seekProgress);
        setIsSeeking(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      },
    })
  ).current;

  return (
    <View style={[s.plOuter, { paddingBottom: insets.bottom + 10 }]}>
      <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={[s.plBlur, { borderColor: theme.border }]}>
        <View style={s.plInner}>

          {/* Info row */}
          <View style={s.plInfoRow}>
            <View style={s.plInfoLeft}>
              <LinearGradient colors={[theme.primaryLight, theme.primary]} style={s.plBadge}>
                <Ionicons name="musical-notes" size={12} color="#fff" />
              </LinearGradient>
              <View style={s.plInfoText}>
                <Text style={[s.plSurah, { color: theme.text }]} numberOfLines={1}>{surahName}</Text>
                {currentAyah && <Text style={[s.plAyah, { color: theme.textTertiary }]}>Ayah {currentAyah}</Text>}
              </View>
            </View>

            {/* Close */}
            <TouchableOpacity style={[s.plCloseBtn, { backgroundColor: theme.surfaceMuted }]} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Progress bar with seek */}
          <View style={s.plProgressRow}>
            <Text style={[s.plTime, { color: theme.textTertiary }]}>{formatMs(state.positionMs)}</Text>
            <View
              style={s.plTrack}
              onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
              {...panResponder.panHandlers}
            >
              <View style={[s.plTrackBg, { backgroundColor: theme.surfaceMuted }]} />
              <LinearGradient
                colors={[theme.primaryLight, theme.primaryMuted]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.plTrackFill, { width: `${displayProgress * 100}%` }]}
              />
              <View
                style={[
                  s.plThumb,
                  { left: `${displayProgress * 100}%`, backgroundColor: theme.primaryLight, shadowColor: theme.shadowColor },
                  isSeeking && [s.plThumbSeeking, { backgroundColor: theme.primary }],
                ]}
              />
            </View>
            <Text style={[s.plTime, { color: theme.textTertiary }]}>{formatMs(state.durationMs)}</Text>
          </View>

          {/* Controls */}
          <View style={s.plControls}>
            {/* Repeat */}
            <TouchableOpacity style={s.plMiniBtn} onPress={onCycleRepeat} activeOpacity={0.7}>
              <Ionicons name={repeatIcon as any} size={18} color={repeatColor} />
              {state.repeatMode === 'one' && <Text style={[s.plRepeatOne, { color: theme.primaryMuted }]}>1</Text>}
            </TouchableOpacity>

            {/* Prev */}
            <TouchableOpacity style={[s.plSideBtn, { backgroundColor: theme.surfaceMuted }]} onPress={onPrev} activeOpacity={0.7}>
              <Ionicons name="play-skip-back" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity style={s.plMainBtn} onPress={onPlayPause} activeOpacity={0.8}>
              <LinearGradient colors={[theme.primaryLight, theme.primary]} style={s.plMainGrad}>
                {state.isBuffering ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name={state.isPlaying ? 'pause' : 'play'}
                    size={22}
                    color="#fff"
                    style={!state.isPlaying ? { marginLeft: 2 } : undefined}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Next */}
            <TouchableOpacity style={[s.plSideBtn, { backgroundColor: theme.surfaceMuted }]} onPress={onNext} activeOpacity={0.7}>
              <Ionicons name="play-skip-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Speed */}
            <TouchableOpacity style={[s.plSpeedBtn, { backgroundColor: theme.surfaceMuted }]} onPress={onCycleSpeed} activeOpacity={0.7}>
              <Text style={[s.plSpeedText, { color: theme.textSecondary }]}>{state.speed}×</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

/* ─── Util ─── */
function formatMs(ms: number): string {
  if (!ms || ms < 0) return '00:00';
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════ */
export default function SurahScreen() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const { saveVerse, removeVerse, isVerseSaved } = useSavedVerses();
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const surahNumber = Number(params.surah);
  const startAyahParam = params.startAyah ? Number(params.startAyah) : undefined;

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<any>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [showEnglish, setShowEnglish] = useState(true);
  const [showUrdu, setShowUrdu] = useState(false);
  const [showTafseer, setShowTafseer] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const ayahLayouts = useRef<Record<number, { y: number }>>({});
  const contentFade = useRef(new Animated.Value(0)).current;

  /* ─── Load ─── */
  useEffect(() => {
    if (!isNaN(surahNumber) && surahNumber > 0) loadSurah();
    return () => {
      audioPlayer.stop().catch(() => {});
      audioPlayer.setStatusCallback(null);
      audioPlayer.setFinishCallback(null);
    };
  }, [surahNumber]);

  /* ─── Audio callbacks ─── */
  useEffect(() => {
    audioPlayer.setStatusCallback((state) => {
      setPlayerState(state);
    });

    audioPlayer.setFinishCallback(() => {
      // Auto-advance
      if (currentIndex != null) {
        const next = currentIndex + 1;
        if (next < ayahs.length && ayahs[next]?.audio) {
          playIndex(next);
        } else {
          setCurrentIndex(null);
          audioPlayer.stop().catch(() => {});
        }
      }
    });

    return () => {
      audioPlayer.setStatusCallback(null);
      audioPlayer.setFinishCallback(null);
    };
  }, [currentIndex, ayahs]);

  const loadSurah = async () => {
    setLoading(true);
    try {
      const { meta: m, ayahs: a } = await QuranService.getSurah(surahNumber);
      setMeta(m);
      setAyahs(a);
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }).start();
      if (startAyahParam) {
        const idx = a.findIndex((x) => x.numberInSurah === startAyahParam);
        if (idx >= 0) setTimeout(() => scrollToAyah(idx), 600);
      }
    } catch (e) {
      console.error('Error loading surah:', e);
    } finally {
      setLoading(false);
    }
  };

  const scrollToAyah = useCallback((index: number) => {
    const layout = ayahLayouts.current[index];
    if (layout && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, layout.y - 100), animated: true });
    }
  }, []);

  const playIndex = useCallback(async (index: number) => {
    const ay = ayahs[index];
    if (!ay?.audio) return;
    try {
      await audioPlayer.play(ay.audio);
      setCurrentIndex(index);
      setTimeout(() => scrollToAyah(index), 200);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      ReadingProgress.setLastSeen(surahNumber, ay.numberInSurah).catch(() => {});
      ReadingProgress.incrementStreak().catch(() => {});
    } catch (e) {
      console.error('Play error:', e);
    }
  }, [ayahs, surahNumber, scrollToAyah]);

  const togglePlayPause = useCallback(async () => {
    if (currentIndex === null) {
      await playIndex(0);
      return;
    }
    await audioPlayer.togglePlayPause();
  }, [currentIndex, playIndex]);

  const playPrev = useCallback(() => {
    if (currentIndex != null && currentIndex > 0) playIndex(currentIndex - 1);
  }, [currentIndex, playIndex]);

  const playNext = useCallback(() => {
    if (currentIndex != null && currentIndex < ayahs.length - 1) playIndex(currentIndex + 1);
  }, [currentIndex, ayahs.length, playIndex]);

  const handleSeek = useCallback((progress: number) => {
    if (playerState?.durationMs) {
      audioPlayer.seekTo(progress * playerState.durationMs);
    }
  }, [playerState?.durationMs]);

  const handleCycleSpeed = useCallback(() => {
    audioPlayer.cycleSpeed();
  }, []);

  const handleCycleRepeat = useCallback(() => {
    audioPlayer.cycleRepeatMode();
  }, []);

  const handleClosePlayer = useCallback(async () => {
    await audioPlayer.stop();
    setCurrentIndex(null);
  }, []);

  const toggleBookmark = useCallback((ay: Ayah) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isVerseSaved(surahNumber, ay.numberInSurah)) {
      removeVerse(surahNumber, ay.numberInSurah);
    } else {
      saveVerse({
        surah: surahNumber,
        surahName: meta?.englishName,
        ayah: ay.numberInSurah,
        arabic: ay.text,
        english: ay.translation || '',
        urdu: ay.urduTranslation,
      });
    }
  }, [surahNumber, meta, isVerseSaved, saveVerse, removeVerse]);

  const shareVerse = useCallback(async (ay: Ayah) => {
    try {
      await Share.share({
        message: `${ay.text}\n\n${ay.translation || ''}\n\n— ${meta?.englishName} ${ay.numberInSurah}`,
      });
    } catch {}
  }, [meta]);

  const handleToggle = useCallback((type: 'english' | 'urdu' | 'tafseer') => {
    if (type === 'english') setShowEnglish((p) => !p);
    else if (type === 'urdu') setShowUrdu((p) => !p);
    else setShowTafseer((p) => !p);
  }, []);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <View style={[s.loadWrap, { backgroundColor: theme.surface }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />
        <View style={s.loadInner}>
          <LinearGradient colors={[theme.primaryLight, theme.primary]} style={s.loadIcon}>
            <Ionicons name="book-outline" size={24} color="#fff" />
          </LinearGradient>
          <Text style={[s.loadText, { color: theme.textSecondary }]}>Loading Surah…</Text>
          <ActivityIndicator size="small" color={theme.primaryMuted} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  const isPlayerVisible = currentIndex !== null && playerState;

  return (
    <View style={[s.container, { backgroundColor: theme.surface }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <SurahHeader
        englishName={meta?.englishName || ''}
        arabicName={meta?.name || ''}
        ayahCount={meta?.numberOfAyahs}
        revelationType={meta?.revelationType}
        onBack={() => router.back()}
      />

      <SegmentedControl
        showEnglish={showEnglish}
        showUrdu={showUrdu}
        showTafseer={showTafseer}
        onToggle={handleToggle}
      />

      <Animated.View style={{ flex: 1, opacity: contentFade }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: isPlayerVisible ? 200 : insets.bottom + 40 },
          ]}
        >
          {/* Bismillah (skip for Surah At-Tawbah) */}
          {surahNumber !== 9 && <BismillahFrame />}

          {/* Verses */}
          {ayahs.map((ay, index) => (
            <View
              key={ay.numberInSurah}
              onLayout={(e) => {
                ayahLayouts.current[index] = { y: e.nativeEvent.layout.y };
              }}
            >
              <VerseCard
                ayahNumber={ay.numberInSurah}
                arabicText={ay.text}
                englishText={ay.translation}
                urduText={ay.urduTranslation}
                showEnglish={showEnglish}
                showUrdu={showUrdu}
                isBookmarked={isVerseSaved(surahNumber, ay.numberInSurah)}
                isPlaying={currentIndex === index}
                onBookmark={() => toggleBookmark(ay)}
                onPlay={() => playIndex(index)}
                onShare={() => shareVerse(ay)}
              />
            </View>
          ))}

          {/* End */}
          <View style={s.endWrap}>
            <Ornament variant="diamond" />
            <Text style={[s.endLabel, { color: theme.textTertiary }]}>End of {meta?.englishName}</Text>
            <Text style={[s.endArabic, { color: theme.textTertiary }]}>{meta?.name}</Text>
            <View style={[s.endDivider, { backgroundColor: theme.border }]} />
            <Text style={[s.endVerse, { color: theme.primaryMuted }]}>صَدَقَ اللّٰهُ الْعَظِيْمُ</Text>
            <Text style={[s.endTrans, { color: theme.textTertiary }]}>Allah the Almighty has spoken the truth</Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Player */}
      {isPlayerVisible && playerState && (
        <PlayerBar
          state={playerState}
          surahName={meta?.englishName || ''}
          currentAyah={ayahs[currentIndex!]?.numberInSurah ?? null}
          onPlayPause={togglePlayPause}
          onPrev={playPrev}
          onNext={playNext}
          onSeek={handleSeek}
          onCycleSpeed={handleCycleSpeed}
          onCycleRepeat={handleCycleRepeat}
          onClose={handleClosePlayer}
        />
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1 },

  /* ─── Loading ─── */
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadInner: { alignItems: 'center', gap: 12 },
  loadIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loadText: { fontSize: 16, fontWeight: '500' },

  /* ─── Ornament ─── */
  ornRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  ornLine: { width: 28, height: 1 },
  ornDiamond: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  ornDot: { width: 4, height: 4, borderRadius: 2 },

  /* ─── Header ─── */
  header: { paddingHorizontal: 20, paddingBottom: 14, overflow: 'hidden' },
  headerPat: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  patCircle: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  headerBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerArabic: { fontSize: 30, color: '#fff', marginBottom: 4 },
  headerEnglish: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.9)', letterSpacing: -0.2, marginBottom: 10 },
  headerMeta: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  metaPillText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  /* ─── Segment ─── */
  segOuter: { paddingHorizontal: 20, paddingVertical: 10 },
  segTrack: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 12, gap: 5 },
  segBtnActive: {
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  segDot: { width: 5, height: 5, borderRadius: 2.5 },
  segText: { fontSize: 13, fontWeight: '600' },
  segDiv: { width: 1, height: 14, alignSelf: 'center' },

  /* ─── Bismillah ─── */
  bisWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  bisGradient: { borderRadius: 22, padding: 28, alignItems: 'center', overflow: 'hidden' },
  bisCorner: { position: 'absolute', width: 24, height: 24, borderColor: 'rgba(212,163,115,0.2)' },
  bisCornerTL: { top: 12, left: 12, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 6 },
  bisCornerTR: { top: 12, right: 12, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 6 },
  bisCornerBL: { bottom: 12, left: 12, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 6 },
  bisCornerBR: { bottom: 12, right: 12, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 6 },
  bisArabic: { fontSize: 28, color: 'rgba(255,255,255,0.95)', marginVertical: 12 },
  bisDivider: { width: 32, height: 1.5, marginVertical: 8 },
  bisTrans: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },

  /* ─── Scroll ─── */
  scrollContent: { paddingTop: 4 },

  /* ─── Verse Card ─── */
  vCard: {
    flexDirection: 'row', marginHorizontal: 14, marginBottom: 10,
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  vAccent: { width: 3 },
  vInner: { flex: 1, padding: 16 },

  vTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  vNumBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  vNumText: { fontSize: 12, fontWeight: '700' },
  vNumTextActive: { color: '#fff' },

  vActions: { flexDirection: 'row', gap: 2 },
  vActBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  vArabic: { fontSize: 24, lineHeight: 48, textAlign: 'right', marginBottom: 4 },

  vTransWrap: { marginTop: 8 },
  vGoldLine: { width: 28, height: 1.5, marginBottom: 12 },
  vTransBlock: { marginBottom: 10 },
  vTransLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  vEnglish: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  vUrduLabel: { fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 4 },
  vUrdu: { fontSize: 16, lineHeight: 28, textAlign: 'right', fontStyle: 'italic' },

  /* ─── End Marker ─── */
  endWrap: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  endLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  endArabic: { fontSize: 18, opacity: 0.5 },
  endDivider: { width: 40, height: 1, marginVertical: 8 },
  endVerse: { fontSize: 20, opacity: 0.6 },
  endTrans: { fontSize: 12, fontStyle: 'italic' },

  /* ─── Player ─── */
  plOuter: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  plBlur: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderTopWidth: 1 },
  plInner: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },

  plInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  plInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  plBadge: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  plInfoText: { flex: 1 },
  plSurah: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  plAyah: { fontSize: 11, marginTop: 1 },
  plCloseBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  plProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  plTime: { fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'], width: 36, textAlign: 'center' },
  plTrack: { flex: 1, height: 24, justifyContent: 'center' },
  plTrackBg: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
  plTrackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  plThumb: {
    position: 'absolute', top: 6, width: 12, height: 12, borderRadius: 6,
    marginLeft: -6, borderWidth: 2, borderColor: '#fff',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  plThumbSeeking: { width: 16, height: 16, borderRadius: 8, top: 4, marginLeft: -8 },

  plControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  plMiniBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  plRepeatOne: { position: 'absolute', bottom: 4, right: 6, fontSize: 8, fontWeight: '800' },
  plSideBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  plMainBtn: { borderRadius: 22, overflow: 'hidden' },
  plMainGrad: { width: 48, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  plSpeedBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  plSpeedText: { fontSize: 11, fontWeight: '700' },
});