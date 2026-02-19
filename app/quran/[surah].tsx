/**
 * SurahScreen v6 - Premium Quran Reader
 *
 * KEY DESIGN FIXES:
 *  - NO sidebar pill (was stealing page width)
 *  - NO FlatList pagination (was causing jumpy auto-scroll)
 *  - Continuous vertical ScrollView in BOTH modes
 *  - Page frames stack naturally, scroll smoothly
 *  - Tiny floating page indicator (non-intrusive)
 *  - Player has proper paddingBottom so content never hides behind it
 *  - Unified auto-scroll engine (smooth pixels) for both modes
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet,
  ActivityIndicator, Dimensions, StatusBar, Share, Platform,
  Animated, PanResponder, LayoutAnimation, UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSavedVerses } from '@/contexts/SavedVersesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/contexts/FontSizeContext';
import QuranService, { Ayah } from '@/lib/quranService';
import audioPlayer, { PlayerState, RepeatMode } from '@/lib/audioPlayer';
import { ReadingProgress } from '@/lib/readingProgress';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SW } = Dimensions.get('window');

/* ─── Constants ─── */
const TARGET_CHARS_PER_PAGE = 550;
const MIN_AYAHS_PER_PAGE = 2;

const SPEED_MAP: Record<number, { px: number; label: string }> = {
  1: { px: 0.3, label: '0.5×' },
  2: { px: 0.6, label: '1.0×' },
  3: { px: 1.0, label: '1.5×' },
  4: { px: 1.6, label: '2.0×' },
  5: { px: 2.5, label: '2.5×' },
};

const LAYOUT_ANIM = {
  duration: 280,
  update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleY },
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

/* ─── Helpers ─── */
function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
}

function splitIntoPages(ayahs: Ayah[]): Ayah[][] {
  if (!ayahs.length) return [];
  const pages: Ayah[][] = [];
  let page: Ayah[] = [];
  let chars = 0;
  for (const ay of ayahs) {
    const len = ay.text.length;
    if (page.length >= MIN_AYAHS_PER_PAGE && chars + len > TARGET_CHARS_PER_PAGE) {
      pages.push(page);
      page = [ay];
      chars = len;
    } else {
      page.push(ay);
      chars += len;
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

function findPageForIndex(pages: Ayah[][], globalIdx: number): number {
  let count = 0;
  for (let p = 0; p < pages.length; p++) {
    count += pages[p].length;
    if (globalIdx < count) return p;
  }
  return pages.length - 1;
}

function pageGlobalOffset(pages: Ayah[][], pageIdx: number): number {
  let off = 0;
  for (let i = 0; i < pageIdx; i++) off += pages[i].length;
  return off;
}

/* ─── Ornament ─── */
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
  englishName, arabicName, ayahCount, revelationType, onBack,
}: {
  englishName: string; arabicName: string; ayahCount?: number;
  revelationType?: string; onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.header, { paddingTop: insets.top + 6 }]}
    >
      <View style={s.headerPat}>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={[s.patCircle, {
            width: 100 + i * 50, height: 100 + i * 50,
            top: -10 + i * 8, right: -30 + i * 12, opacity: 0.03 + i * 0.008,
          }]} />
        ))}
      </View>
      <View style={s.headerBar}>
        <TouchableOpacity style={s.headerBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>
      <View style={s.headerCenter}>
        <Ornament variant="diamond" />
        <Text style={s.headerArabic}>{arabicName}</Text>
        <Text style={s.headerEnglish}>{englishName}</Text>
        {(ayahCount || revelationType) && (
          <View style={s.headerMeta}>
            {revelationType && (
              <View style={s.metaPill}>
                <Ionicons name={revelationType === 'Meccan' ? 'sunny-outline' : 'moon-outline'} size={11} color="rgba(255,255,255,0.6)" />
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
  showEnglish, showUrdu, showTafseer, onToggle,
}: {
  showEnglish: boolean; showUrdu: boolean; showTafseer: boolean;
  onToggle: (t: 'english' | 'urdu' | 'tafseer') => void;
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
            {i > 0 && <View style={[s.segDiv, { backgroundColor: theme.border }]} />}
            <Pressable
              style={({ pressed }) => [
                s.segBtn, 
                seg.active && [s.segBtnActive, { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadowColor }],
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onToggle(seg.key);
              }}
              delayLongPress={100}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              {seg.active && <View style={[s.segDot, { backgroundColor: theme.primaryMuted }]} />}
              <Text style={[s.segText, { color: theme.textTertiary }, seg.active && { color: theme.primary }]}>{seg.label}</Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   BISMILLAH
   ═══════════════════════════════════════════════ */
function BismillahCard({ isPageMode }: { isPageMode: boolean }) {
  const { theme } = useTheme();
  const { sizes } = useFontSize();

  if (isPageMode) {
    return (
      <View style={s.bisPageWrap}>
        <View style={s.bisPageOrnRow}>
          <View style={[s.bisPageLine, { backgroundColor: `${theme.gold}35` }]} />
          <View style={[s.bisPageDm, { backgroundColor: `${theme.gold}50` }]} />
          <View style={[s.bisPageLine, { backgroundColor: `${theme.gold}35` }]} />
        </View>
        <Text style={[s.bisPageText, { color: theme.primary, fontSize: sizes.arabicLarge }]}>
          بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ
        </Text>
        <View style={s.bisPageOrnRow}>
          <View style={[s.bisPageLine, { backgroundColor: `${theme.gold}35` }]} />
          <View style={[s.bisPageDotSmall, { backgroundColor: `${theme.gold}40` }]} />
          <View style={[s.bisPageLine, { backgroundColor: `${theme.gold}35` }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.bisWrap}>
      <LinearGradient colors={theme.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bisGrad}>
        <View style={[s.bisCr, s.bisCrTL]} /><View style={[s.bisCr, s.bisCrTR]} />
        <View style={[s.bisCr, s.bisCrBL]} /><View style={[s.bisCr, s.bisCrBR]} />
        <Ornament variant="diamond" />
        <Text style={[s.bisArabic, { fontSize: sizes.arabicLarge }]}>بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ</Text>
        <View style={[s.bisDiv, { backgroundColor: `${theme.gold}4D` }]} />
        <Text style={[s.bisTrans, { fontSize: sizes.english, lineHeight: sizes.englishLine }]}>
          In the name of Allah, the Most Gracious, the Most Merciful
        </Text>
        <Ornament variant="dot" />
      </LinearGradient>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   MUSHAF PAGE FRAME
   Just a visual grouping — NOT a paginated view.
   Full width, no sidebar stealing space.
   ═══════════════════════════════════════════════ */
function PageFrame({
  ayahs, globalOffset, currentIndex, surahNumber, pageNumber, totalPages,
  isVerseSaved, onPlayVerse, onBookmark,
}: {
  ayahs: Ayah[]; globalOffset: number;
  currentIndex: number | null; surahNumber: number;
  pageNumber: number; totalPages: number;
  isVerseSaved: (s: number, a: number) => boolean;
  onPlayVerse: (idx: number) => void;
  onBookmark: (ay: Ayah) => void;
}) {
  const { theme } = useTheme();
  const { sizes } = useFontSize();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <View style={s.frameWrap}>
      <View style={[s.pageFrame, { backgroundColor: theme.surfaceElevated, borderColor: `${theme.gold}22`, shadowColor: theme.shadowColor }]}>
        {/* Top edge */}
        <View style={s.pageEdge}>
          <View style={[s.pageEdgeLine, { backgroundColor: `${theme.gold}25` }]} />
          <View style={[s.pageEdgeDm, { backgroundColor: `${theme.gold}40` }]} />
          <View style={[s.pageEdgeLine, { backgroundColor: `${theme.gold}25` }]} />
        </View>

        {/* Flowing Arabic — FULL WIDTH, no sidebar */}
        <View style={s.pageBody}>
          <Text style={[s.pageFlow, { fontSize: sizes.arabic + 3, lineHeight: (sizes.arabicLine || 48) + 14, color: theme.arabicText }]}>
            {ayahs.map((ay, i) => {
              const gIdx = globalOffset + i;
              const playing = currentIndex === gIdx;
              const sel = selected === i;
              const saved = isVerseSaved(surahNumber, ay.numberInSurah);
              return (
                <Text key={ay.numberInSurah}>
                  <Text
                    onPress={() => { setSelected(sel ? null : i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={[
                      playing && { color: theme.primaryMuted, backgroundColor: `${theme.primaryMuted}0C` },
                      sel && { backgroundColor: `${theme.gold}14` },
                      saved && !playing && !sel && { color: theme.primary },
                    ]}
                  >{ay.text}</Text>
                  <Text style={{ color: theme.primaryMuted, fontSize: sizes.arabic - 4 }}>
                    {' ﴿'}{ay.numberInSurah.toLocaleString('ar-SA')}{'﴾ '}
                  </Text>
                </Text>
              );
            })}
          </Text>
        </View>

        {/* Action bar */}
        {selected !== null && ayahs[selected] && (
          <View style={[s.pageActBar, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <View style={s.pageActLeft}>
              <LinearGradient colors={[theme.primaryLight, theme.primary]} style={s.pageActBadge}>
                <Text style={s.pageActBadgeT}>{ayahs[selected].numberInSurah}</Text>
              </LinearGradient>
              <Text style={[s.pageActLabel, { color: theme.textSecondary }]}>Ayah {ayahs[selected].numberInSurah}</Text>
            </View>
            <View style={s.pageActBtns}>
              <TouchableOpacity style={[s.pageActBtn, { backgroundColor: `${theme.primaryMuted}12` }]} onPress={() => onPlayVerse(globalOffset + selected)} activeOpacity={0.7}>
                <Ionicons name="play" size={14} color={theme.primaryMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.pageActBtn, { backgroundColor: `${theme.gold}12` }]} onPress={() => onBookmark(ayahs[selected])} activeOpacity={0.7}>
                <Ionicons name={isVerseSaved(surahNumber, ayahs[selected].numberInSurah) ? 'bookmark' : 'bookmark-outline'} size={14} color={isVerseSaved(surahNumber, ayahs[selected].numberInSurah) ? theme.gold : theme.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.pageActBtn, { backgroundColor: theme.surfaceMuted }]} onPress={() => Share.share({ message: `${ayahs[selected].text}\n— Ayah ${ayahs[selected].numberInSurah}` }).catch(() => {})} activeOpacity={0.7}>
                <Ionicons name="share-outline" size={14} color={theme.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.pageActBtn, { backgroundColor: theme.surfaceMuted }]} onPress={() => setSelected(null)} activeOpacity={0.7}>
                <Ionicons name="close" size={14} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom edge with page number indicator */}
        <View style={s.pageEdge}>
          <View style={[s.pageEdgeLine, { backgroundColor: `${theme.gold}25` }]} />
          <View style={[s.pageNumPill, { backgroundColor: `${theme.gold}10` }]}>
            <Text style={[s.pageEdgeNum, { color: theme.primaryMuted }]}>{pageNumber}</Text>
            <Text style={[s.pageSep, { color: `${theme.gold}40` }]}>/</Text>
            <Text style={[s.pageTotalNum, { color: `${theme.gold}70` }]}>{totalPages}</Text>
          </View>
          <View style={[s.pageEdgeLine, { backgroundColor: `${theme.gold}25` }]} />
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   FLOATING PAGE INDICATOR
   Tiny pill that appears briefly while manual scrolling, then fades
   Hidden during auto-scroll
   ═══════════════════════════════════════════════ */
function FloatingPageIndicator({ current, total, visible, isAutoScrolling }: { current: number; total: number; visible: boolean; isAutoScrolling: boolean }) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Never show during auto-scroll
    if (isAutoScrolling) {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      return;
    }
    
    if (visible && total > 1) {
      // Show immediately
      Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    } else {
      // Hide after 1 second delay
      Animated.timing(opacity, { toValue: 0, duration: 250, delay: 1000, useNativeDriver: true }).start();
    }
  }, [visible, current, isAutoScrolling]);

  if (total <= 1) return null;

  return (
    <Animated.View style={[s.floatIndicator, { opacity, backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
      <Text style={[s.floatText, { color: theme.text }]}>
        <Text style={{ fontWeight: '700' }}>{current}</Text>
        <Text style={{ color: theme.textTertiary }}> / {total}</Text>
      </Text>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════
   VERSE CARD (card mode)
   ═══════════════════════════════════════════════ */
function VerseCard({
  ayahNumber, arabicText, englishText, urduText, tafseerText,
  showEnglish, showUrdu, showTafseer,
  isBookmarked, isPlaying, onBookmark, onPlay, onShare,
}: {
  ayahNumber: number; arabicText: string;
  englishText?: string; urduText?: string; tafseerText?: string;
  showEnglish: boolean; showUrdu: boolean; showTafseer: boolean;
  isBookmarked: boolean; isPlaying: boolean;
  onBookmark: () => void; onPlay: () => void; onShare: () => void;
}) {
  const { theme } = useTheme();
  const { sizes } = useFontSize();
  const hasTrans = (showEnglish && englishText) || (showUrdu && urduText) || (showTafseer && tafseerText);

  return (
    <View style={[s.vCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }, isPlaying && { borderColor: `${theme.primaryMuted}25` }]}>
      <View style={[s.vAccent, { backgroundColor: theme.border }, isPlaying && { backgroundColor: theme.primaryMuted }]} />
      <View style={s.vInner}>
        <View style={s.vTopRow}>
          <LinearGradient colors={isPlaying ? [theme.primaryLight, theme.primary] : [theme.surfaceMuted, theme.surfaceMuted]} style={s.vBadge}>
            <Text style={[s.vBadgeT, { color: theme.textSecondary }, isPlaying && { color: '#fff' }]}>{ayahNumber}</Text>
          </LinearGradient>
          <View style={s.vActions}>
            <TouchableOpacity style={[s.vActBtn, isPlaying && { backgroundColor: theme.primaryMuted }]} onPress={onPlay} activeOpacity={0.7}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={isPlaying ? '#fff' : theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.vActBtn} onPress={onBookmark} activeOpacity={0.7}>
              <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={16} color={isBookmarked ? theme.gold : theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.vActBtn} onPress={onShare} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[s.vArabic, { color: theme.arabicText, fontSize: sizes.arabic, lineHeight: sizes.arabicLine }]}>{arabicText}</Text>
        {hasTrans && (
          <View style={s.vTransWrap}>
            <View style={[s.vGoldLine, { backgroundColor: `${theme.gold}4D` }]} />
            {showEnglish && englishText && <View style={s.vTransBlock}><Text style={[s.vTransLabel, { color: theme.textTertiary }]}>TRANSLATION</Text><Text style={[s.vEnglish, { color: theme.textSecondary, fontSize: sizes.english, lineHeight: sizes.englishLine }]}>{englishText}</Text></View>}
            {showUrdu && urduText && <View style={s.vTransBlock}><Text style={[s.vUrduLabel, { color: theme.textTertiary }]}>اردو ترجمہ</Text><Text style={[s.vUrdu, { color: theme.textSecondary, fontSize: sizes.urdu, lineHeight: sizes.urduLine }]}>{urduText}</Text></View>}
            {showTafseer && tafseerText && <View style={s.vTransBlock}><Text style={[s.vTransLabel, { color: theme.textTertiary }]}>TAFSEER</Text><Text style={[s.vEnglish, { color: theme.textSecondary, fontSize: sizes.english, lineHeight: sizes.englishLine }]}>{tafseerText}</Text></View>}
          </View>
        )}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   PERSISTENT AUDIO PLAYER
   ═══════════════════════════════════════════════ */
function PersistentPlayer({
  surahName, ayahs, currentIndex, playerState,
  onPlayIndex, onTogglePlayPause, onPrev, onNext,
  onSeek, onCycleSpeed, onCycleRepeat, onClose,
}: {
  surahName: string; ayahs: Ayah[];
  currentIndex: number | null; playerState: PlayerState | null;
  onPlayIndex: (i: number) => void; onTogglePlayPause: () => void;
  onPrev: () => void; onNext: () => void;
  onSeek: (p: number) => void; onCycleSpeed: () => void;
  onCycleRepeat: () => void; onClose: () => void;
}) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const trackW = useRef(SW - 80);
  const [seeking, setSeeking] = useState(false);
  const [seekP, setSeekP] = useState(0);

  const isActive = currentIndex !== null && playerState;
  const ps = playerState || { isPlaying: false, isBuffering: false, progress: 0, positionMs: 0, durationMs: 0, speed: 1, repeatMode: 'none' as RepeatMode, isLoaded: false, error: null };
  const dp = seeking ? seekP : ps.progress;

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    setExpanded((e) => !e);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, g) => { setSeeking(true); setSeekP(Math.max(0, Math.min(1, g.x0 / trackW.current))); },
    onPanResponderMove: (_, g) => { setSeekP(Math.max(0, Math.min(1, (g.x0 + g.dx) / trackW.current))); },
    onPanResponderRelease: () => { onSeek(seekP); setSeeking(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  })).current;

  const rIcon = ps.repeatMode === 'one' ? 'repeat' : ps.repeatMode === 'all' ? 'repeat' : 'repeat-outline';
  const rColor = ps.repeatMode !== 'none' ? theme.primaryMuted : theme.textTertiary;

  return (
    <View style={[s.ppOuter, { paddingBottom: insets.bottom + 4 }]}>
      <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={[s.ppBlur, { borderColor: theme.border }]}>
        <View style={s.ppMiniRow}>
          {/* Left: tappable info → expand */}
          <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7} style={s.ppLeft}>
            <LinearGradient colors={[theme.primaryLight, theme.primary]} style={s.ppBadge}>
              <Ionicons name={isActive ? 'musical-notes' : 'book-outline'} size={14} color="#fff" />
            </LinearGradient>
            <View style={s.ppInf}>
              <Text style={[s.ppTitle, { color: theme.text }]} numberOfLines={1}>
                {surahName || 'Quran Reader'}
              </Text>
              <Text style={[s.ppSub, { color: theme.textTertiary }]} numberOfLines={1}>
                {isActive ? `Ayah ${ayahs[currentIndex!]?.numberInSurah || ''} • ${formatMs(ps.positionMs)}` : `${ayahs.length} verses • Tap ▶ to listen`}
              </Text>
            </View>
            <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={16} color={theme.textTertiary} style={{ marginRight: 4 }} />
          </TouchableOpacity>

          {/* Right: transport */}
          <View style={s.ppCtrls}>
            <TouchableOpacity onPress={onPrev} disabled={!isActive || currentIndex === 0} style={s.ppCtrlBtn} activeOpacity={0.7}>
              <Ionicons name="play-skip-back" size={16} color={isActive && currentIndex! > 0 ? theme.textSecondary : `${theme.textTertiary}50`} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { if (!isActive) onPlayIndex(0); else onTogglePlayPause(); }} activeOpacity={0.8}>
              <LinearGradient colors={[theme.primaryLight, theme.primary]} style={s.ppPlayBtn}>
                {ps.isBuffering ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Ionicons name={ps.isPlaying ? 'pause' : 'play'} size={18} color="#fff" style={!ps.isPlaying ? { marginLeft: 2 } : undefined} />
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} disabled={!isActive || currentIndex === ayahs.length - 1} style={s.ppCtrlBtn} activeOpacity={0.7}>
              <Ionicons name="play-skip-forward" size={16} color={isActive && currentIndex! < ayahs.length - 1 ? theme.textSecondary : `${theme.textTertiary}50`} />
            </TouchableOpacity>
          </View>
        </View>

        {isActive && !expanded && (
          <View style={[s.ppThin, { backgroundColor: theme.surfaceMuted }]}>
            <LinearGradient colors={[theme.primaryLight, theme.primaryMuted]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.ppThinFill, { width: `${dp * 100}%` }]} />
          </View>
        )}

        {expanded && (
          <View style={s.ppExp}>
            <View style={s.ppSeekRow}>
              <Text style={[s.ppTime, { color: theme.textTertiary }]}>{formatMs(ps.positionMs)}</Text>
              <View style={s.ppTrack} onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
                <View style={[s.ppTrackBg, { backgroundColor: theme.surfaceMuted }]} />
                <LinearGradient colors={[theme.primaryLight, theme.primaryMuted]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.ppTrackFill, { width: `${dp * 100}%` }]} />
                <View style={[s.ppThumb, { left: `${dp * 100}%`, backgroundColor: theme.primaryLight, shadowColor: theme.shadowColor }, seeking && [s.ppThumbS, { backgroundColor: theme.primary }]]} />
              </View>
              <Text style={[s.ppTime, { color: theme.textTertiary }]}>{formatMs(ps.durationMs)}</Text>
            </View>
            <View style={s.ppExRow}>
              <TouchableOpacity style={s.ppExBtn} onPress={onCycleRepeat} activeOpacity={0.7}>
                <Ionicons name={rIcon as any} size={18} color={rColor} />
                {ps.repeatMode === 'one' && <Text style={[s.ppR1, { color: theme.primaryMuted }]}>1</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.ppChip, { backgroundColor: theme.surfaceMuted }]} onPress={onCycleSpeed} activeOpacity={0.7}>
                <Text style={[s.ppChipT, { color: theme.textSecondary }]}>{ps.speed}× Speed</Text>
              </TouchableOpacity>
              {isActive && (
                <TouchableOpacity style={[s.ppChip, { backgroundColor: '#C0392B12' }]} onPress={onClose} activeOpacity={0.7}>
                  <Ionicons name="stop-circle-outline" size={15} color="#C0392B" />
                  <Text style={[s.ppChipT, { color: '#C0392B' }]}>Stop</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </BlurView>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   AUTO-SCROLL BAR
   Same smooth pixel scroll in both modes.
   ═══════════════════════════════════════════════ */
function AutoScrollBar({
  active, speed, onStart, onStop, onUp, onDown, scaleAnim,
}: {
  active: boolean; speed: number;
  onStart: () => void; onStop: () => void;
  onUp: () => void; onDown: () => void;
  scaleAnim: Animated.Value;
}) {
  const { theme } = useTheme();
  const w = useRef(new Animated.Value(active ? 160 : 44)).current;
  const op = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (active) {
      Animated.parallel([
        Animated.spring(w, { toValue: 160, tension: 65, friction: 10, useNativeDriver: false }),
        Animated.timing(op, { toValue: 1, duration: 180, delay: 80, useNativeDriver: true }),
      ]).start();
    } else {
      op.setValue(0);
      Animated.spring(w, { toValue: 44, tension: 65, friction: 10, useNativeDriver: false }).start();
    }
  }, [active]);

  return (
    <Animated.View style={[s.asBar, { width: w, backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
      {active ? (
        <>
          <Animated.View style={{ opacity: op }}>
            <TouchableOpacity onPress={onDown} disabled={speed <= 1} activeOpacity={0.7} style={[s.asSide, { backgroundColor: speed <= 1 ? theme.surfaceMuted : `${theme.primaryMuted}12` }, speed <= 1 && s.asDis]}>
              <Ionicons name="remove" size={16} color={speed <= 1 ? theme.textTertiary : theme.primaryMuted} />
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity onPress={onStop} activeOpacity={0.8}>
            <LinearGradient colors={[theme.primaryLight, theme.primary]} style={s.asCenter}>
              <Ionicons name="pause" size={13} color="#fff" />
              <Animated.Text style={[s.asLabel, { transform: [{ scale: scaleAnim }] }]}>{SPEED_MAP[speed]?.label || '1.0×'}</Animated.Text>
            </LinearGradient>
          </TouchableOpacity>
          <Animated.View style={{ opacity: op }}>
            <TouchableOpacity onPress={onUp} disabled={speed >= 5} activeOpacity={0.7} style={[s.asSide, { backgroundColor: speed >= 5 ? theme.surfaceMuted : `${theme.primaryMuted}12` }, speed >= 5 && s.asDis]}>
              <Ionicons name="add" size={16} color={speed >= 5 ? theme.textTertiary : theme.primaryMuted} />
            </TouchableOpacity>
          </Animated.View>
        </>
      ) : (
        <TouchableOpacity onPress={onStart} activeOpacity={0.8} style={s.asTrig}>
          <Ionicons name="chevron-down" size={15} color={theme.primaryMuted} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
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
  const [showEnglish, setShowEnglish] = useState(false);
  const [showUrdu, setShowUrdu] = useState(false);
  const [showTafseer, setShowTafseer] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isScrolling, setIsScrolling] = useState(false);
  const [autoScrollActive, setAutoScrollActive] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);

  const scrollRef = useRef<ScrollView>(null);
  const ayahLayouts = useRef<Record<number, { y: number }>>({});
  const pageLayouts = useRef<Record<number, { y: number; h: number }>>({});
  const contentFade = useRef(new Animated.Value(0)).current;
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollPosRef = useRef(0);
  const contentHRef = useRef(0);
  const layoutHRef = useRef(0);
  const touchRef = useRef(false);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spdScale = useRef(new Animated.Value(1)).current;

  const isPageMode = !showEnglish && !showUrdu && !showTafseer;
  const pages = useMemo(() => splitIntoPages(ayahs), [ayahs]);
  const playerBarH = 72 + insets.bottom;

  /* ─── Load ─── */
  useEffect(() => {
    if (!isNaN(surahNumber) && surahNumber > 0) loadSurah();
    return () => { audioPlayer.stop().catch(() => {}); audioPlayer.setStatusCallback(null); audioPlayer.setFinishCallback(null); };
  }, [surahNumber]);

  useEffect(() => {
    audioPlayer.setStatusCallback((st) => setPlayerState(st));
    audioPlayer.setFinishCallback(() => {
      if (currentIndex != null) {
        const next = currentIndex + 1;
        if (next < ayahs.length && ayahs[next]?.audio) playIndex(next);
        else { setCurrentIndex(null); audioPlayer.stop().catch(() => {}); }
      }
    });
    return () => { audioPlayer.setStatusCallback(null); audioPlayer.setFinishCallback(null); };
  }, [currentIndex, ayahs]);

  /* ─── Unified auto-scroll (same smooth engine for both modes) ─── */
  useEffect(() => {
    if (autoScrollActive) {
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
      const px = SPEED_MAP[scrollSpeed]?.px || 0.6;
      scrollTimerRef.current = setInterval(() => {
        if (!touchRef.current) {
          const mx = contentHRef.current - layoutHRef.current - 5;
          if (scrollPosRef.current >= mx) { stopAS(); return; }
          scrollPosRef.current += px;
          scrollRef.current?.scrollTo({ y: scrollPosRef.current, animated: false });
        }
      }, 50);
    }
    return () => { if (scrollTimerRef.current) clearInterval(scrollTimerRef.current); };
  }, [scrollSpeed, autoScrollActive]);

  useEffect(() => { AsyncStorage.getItem('sukoon_autoscroll_speed').then((v) => { if (v) { const n = parseInt(v, 10); if (n >= 1 && n <= 5) setScrollSpeed(n); } }).catch(() => {}); }, []);
  useEffect(() => { if (currentIndex !== null && autoScrollActive) stopAS(); }, [currentIndex]);
  useEffect(() => { return () => { if (scrollTimerRef.current) clearInterval(scrollTimerRef.current); if (resumeRef.current) clearTimeout(resumeRef.current); }; }, []);

  const startAS = useCallback(() => { setAutoScrollActive(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }, []);
  const stopAS = useCallback(() => {
    if (scrollTimerRef.current) { clearInterval(scrollTimerRef.current); scrollTimerRef.current = null; }
    if (resumeRef.current) { clearTimeout(resumeRef.current); resumeRef.current = null; }
    setAutoScrollActive(false);
  }, []);

  const bumpSpd = useCallback(() => { Animated.sequence([Animated.timing(spdScale, { toValue: 1.3, duration: 100, useNativeDriver: true }), Animated.timing(spdScale, { toValue: 1, duration: 100, useNativeDriver: true })]).start(); }, []);
  const spdUp = useCallback(() => { if (scrollSpeed < 5) { const n = scrollSpeed + 1; setScrollSpeed(n); Haptics.selectionAsync().catch(() => {}); AsyncStorage.setItem('sukoon_autoscroll_speed', String(n)).catch(() => {}); bumpSpd(); } }, [scrollSpeed]);
  const spdDown = useCallback(() => { if (scrollSpeed > 1) { const n = scrollSpeed - 1; setScrollSpeed(n); Haptics.selectionAsync().catch(() => {}); AsyncStorage.setItem('sukoon_autoscroll_speed', String(n)).catch(() => {}); bumpSpd(); } }, [scrollSpeed]);

  /* ─── Scroll handler: track position + detect current page ─── */
  const handleScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollPosRef.current = y;

    // Show page indicator briefly while manual scrolling (not during auto-scroll)
    if (isPageMode && pages.length > 1 && !autoScrollActive) {
      setIsScrolling(true);
      if (scrollFadeTimer.current) clearTimeout(scrollFadeTimer.current);
      scrollFadeTimer.current = setTimeout(() => setIsScrolling(false), 1000);

      // Find which page frame is at the center of viewport
      const viewCenter = y + layoutHRef.current / 2;
      for (let i = 0; i < pages.length; i++) {
        const pl = pageLayouts.current[i];
        if (pl && viewCenter >= pl.y && viewCenter < pl.y + pl.h) {
          if (currentPage !== i + 1) setCurrentPage(i + 1);
          break;
        }
      }
    }
  }, [isPageMode, pages.length, currentPage, autoScrollActive]);

  /* ─── Data ─── */
  const loadSurah = async () => {
    setLoading(true);
    try {
      const { meta: m, ayahs: a } = await QuranService.getSurah(surahNumber);
      setMeta(m); setAyahs(a);
      Animated.timing(contentFade, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }).start();
      if (startAyahParam) {
        const idx = a.findIndex((x) => x.numberInSurah === startAyahParam);
        if (idx >= 0) setTimeout(() => scrollToAyah(idx), 600);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const scrollToAyah = useCallback((index: number) => {
    if (isPageMode) {
      // In page mode, ayah layouts are inside page frames
      // Find which page and scroll to that page frame
      const pageIdx = findPageForIndex(pages, index);
      const pl = pageLayouts.current[pageIdx];
      if (pl && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, pl.y - 20), animated: true });
    } else {
      const l = ayahLayouts.current[index];
      if (l && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, l.y - 100), animated: true });
    }
  }, [isPageMode, pages]);

  const playIndex = useCallback(async (index: number) => {
    const ay = ayahs[index]; if (!ay?.audio) return;
    try {
      await audioPlayer.play(ay.audio); setCurrentIndex(index);
      setTimeout(() => scrollToAyah(index), 200);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      ReadingProgress.setLastSeen(surahNumber, ay.numberInSurah).catch(() => {});
      ReadingProgress.incrementStreak().catch(() => {});
    } catch (e) { console.error(e); }
  }, [ayahs, surahNumber, scrollToAyah]);

  const togglePlayPause = useCallback(async () => { if (currentIndex === null) await playIndex(0); else await audioPlayer.togglePlayPause(); }, [currentIndex, playIndex]);
  const playPrev = useCallback(() => { if (currentIndex != null && currentIndex > 0) playIndex(currentIndex - 1); }, [currentIndex, playIndex]);
  const playNext = useCallback(() => { if (currentIndex != null && currentIndex < ayahs.length - 1) playIndex(currentIndex + 1); }, [currentIndex, ayahs.length, playIndex]);
  const handleSeek = useCallback((p: number) => { if (playerState?.durationMs) audioPlayer.seekTo(p * playerState.durationMs); }, [playerState?.durationMs]);

  const toggleBookmark = useCallback((ay: Ayah) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isVerseSaved(surahNumber, ay.numberInSurah)) removeVerse(surahNumber, ay.numberInSurah);
    else saveVerse({ surah: surahNumber, surahName: meta?.englishName, ayah: ay.numberInSurah, arabic: ay.text, english: ay.translation || '', urdu: ay.urduTranslation });
  }, [surahNumber, meta, isVerseSaved, saveVerse, removeVerse]);

  const shareVerse = useCallback(async (ay: Ayah) => {
    try { await Share.share({ message: `${ay.text}\n\n${ay.translation || ''}\n\n— ${meta?.englishName} ${ay.numberInSurah}` }); } catch {}
  }, [meta]);

  const handleToggle = useCallback((t: 'english' | 'urdu' | 'tafseer') => {
    if (autoScrollActive) stopAS();
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    if (t === 'english') setShowEnglish((p) => !p);
    else if (t === 'urdu') setShowUrdu((p) => !p);
    else setShowTafseer((p) => !p);
  }, [autoScrollActive, stopAS]);

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

  return (
    <View style={[s.container, { backgroundColor: theme.surface }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <SurahHeader
        englishName={meta?.englishName || ''} arabicName={meta?.name || ''}
        ayahCount={meta?.numberOfAyahs} revelationType={meta?.revelationType}
        onBack={() => router.back()}
      />

      <SegmentedControl showEnglish={showEnglish} showUrdu={showUrdu} showTafseer={showTafseer} onToggle={handleToggle} />

      <Animated.View style={{ flex: 1, opacity: contentFade }}>
        {/* SINGLE ScrollView for BOTH modes */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: playerBarH + 24 }}
          onScroll={handleScroll}
          onContentSizeChange={(_, h) => { contentHRef.current = h; }}
          onLayout={(e) => { layoutHRef.current = e.nativeEvent.layout.height; }}
          onScrollBeginDrag={() => { touchRef.current = true; if (resumeRef.current) clearTimeout(resumeRef.current); }}
          onScrollEndDrag={() => { touchRef.current = false; if (autoScrollActive) resumeRef.current = setTimeout(() => { touchRef.current = false; }, 2000); }}
          scrollEventThrottle={16}
        >
          {/* ═══ MUSHAF PAGE MODE ═══ */}
          {isPageMode && (
            <>
              {surahNumber !== 9 && <BismillahCard isPageMode />}
              {pages.map((pg, pIdx) => (
                <View
                  key={`page-${pIdx}`}
                  onLayout={(e) => {
                    pageLayouts.current[pIdx] = {
                      y: e.nativeEvent.layout.y,
                      h: e.nativeEvent.layout.height,
                    };
                  }}
                >
                  <PageFrame
                    ayahs={pg}
                    globalOffset={pageGlobalOffset(pages, pIdx)}
                    currentIndex={currentIndex}
                    surahNumber={surahNumber}
                    pageNumber={pIdx + 1}
                    totalPages={pages.length}
                    isVerseSaved={isVerseSaved}
                    onPlayVerse={playIndex}
                    onBookmark={toggleBookmark}
                  />
                </View>
              ))}
              <View style={s.endWrap}>
                <Ornament variant="diamond" />
                <Text style={[s.endVerse, { color: theme.primaryMuted }]}>صَدَقَ اللّٰهُ الْعَظِيْمُ</Text>
                <Text style={[s.endTrans, { color: theme.textTertiary }]}>Allah the Almighty has spoken the truth</Text>
              </View>
            </>
          )}

          {/* ═══ CARD MODE ═══ */}
          {!isPageMode && (
            <>
              {surahNumber !== 9 && <BismillahCard isPageMode={false} />}
              {ayahs.map((ay, i) => (
                <View key={ay.numberInSurah} onLayout={(e) => { ayahLayouts.current[i] = { y: e.nativeEvent.layout.y }; }}>
                  <VerseCard
                    ayahNumber={ay.numberInSurah} arabicText={ay.text}
                    englishText={ay.translation} urduText={ay.urduTranslation} tafseerText={ay.tafseer}
                    showEnglish={showEnglish} showUrdu={showUrdu} showTafseer={showTafseer}
                    isBookmarked={isVerseSaved(surahNumber, ay.numberInSurah)} isPlaying={currentIndex === i}
                    onBookmark={() => toggleBookmark(ay)} onPlay={() => playIndex(i)} onShare={() => shareVerse(ay)}
                  />
                </View>
              ))}
              <View style={s.endWrap}>
                <Ornament variant="diamond" />
                <Text style={[s.endLabel, { color: theme.textTertiary }]}>End of {meta?.englishName}</Text>
                <View style={[s.endDiv, { backgroundColor: theme.border }]} />
                <Text style={[s.endVerse, { color: theme.primaryMuted }]}>صَدَقَ اللّٰهُ الْعَظِيْمُ</Text>
                <Text style={[s.endTrans, { color: theme.textTertiary }]}>Allah the Almighty has spoken the truth</Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* Floating page indicator (page mode only, shows briefly while manual scrolling) */}
        {isPageMode && (
          <FloatingPageIndicator 
            current={currentPage} 
            total={pages.length} 
            visible={isScrolling} 
            isAutoScrolling={autoScrollActive} 
          />
        )}
      </Animated.View>

      {/* Auto-scroll (both modes) */}
      <View style={{ position: 'absolute', right: 16, bottom: playerBarH + 14, zIndex: 15 }}>
        <AutoScrollBar active={autoScrollActive} speed={scrollSpeed} onStart={startAS} onStop={stopAS} onUp={spdUp} onDown={spdDown} scaleAnim={spdScale} />
      </View>

      {/* PERSISTENT PLAYER */}
      <PersistentPlayer
        surahName={meta?.englishName || ''} ayahs={ayahs}
        currentIndex={currentIndex} playerState={playerState}
        onPlayIndex={playIndex} onTogglePlayPause={togglePlayPause}
        onPrev={playPrev} onNext={playNext} onSeek={handleSeek}
        onCycleSpeed={() => audioPlayer.cycleSpeed()}
        onCycleRepeat={() => audioPlayer.cycleRepeatMode()}
        onClose={async () => { await audioPlayer.stop(); setCurrentIndex(null); }}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1 },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadInner: { alignItems: 'center', gap: 12 },
  loadIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loadText: { fontSize: 16, fontWeight: '500' },

  ornRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  ornLine: { width: 28, height: 1 },
  ornDiamond: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  ornDot: { width: 4, height: 4, borderRadius: 2 },

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

  segOuter: { paddingHorizontal: 20, paddingVertical: 10 },
  segTrack: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 12, gap: 5 },
  segBtnActive: { ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 }, android: { elevation: 2 } }) },
  segDot: { width: 5, height: 5, borderRadius: 2.5 },
  segText: { fontSize: 13, fontWeight: '600' },
  segDiv: { width: 1, height: 14, alignSelf: 'center' },

  bisWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  bisGrad: { borderRadius: 22, padding: 28, alignItems: 'center', overflow: 'hidden' },
  bisCr: { position: 'absolute', width: 24, height: 24, borderColor: 'rgba(212,163,115,0.2)' },
  bisCrTL: { top: 12, left: 12, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 6 },
  bisCrTR: { top: 12, right: 12, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 6 },
  bisCrBL: { bottom: 12, left: 12, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 6 },
  bisCrBR: { bottom: 12, right: 12, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 6 },
  bisArabic: { fontSize: 28, color: 'rgba(255,255,255,0.95)', marginVertical: 12 },
  bisDiv: { width: 32, height: 1.5, marginVertical: 8 },
  bisTrans: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },

  bisPageWrap: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  bisPageOrnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bisPageLine: { width: 48, height: 1.5, borderRadius: 1 },
  bisPageDm: { width: 6, height: 6, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  bisPageDotSmall: { width: 4, height: 4, borderRadius: 2 },
  bisPageText: { fontSize: 28, textAlign: 'center', marginVertical: 12 },

  /* Page frame — FULL WIDTH */
  frameWrap: { paddingHorizontal: 12, marginBottom: 16 },
  pageFrame: { borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16 }, android: { elevation: 2 } }) },
  pageEdge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 12 },
  pageEdgeLine: { width: 48, height: 1.5, borderRadius: 1 },
  pageEdgeDm: { width: 6, height: 6, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  pageNumPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 2 },
  pageEdgeNum: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pageSep: { fontSize: 11, fontWeight: '500' },
  pageTotalNum: { fontSize: 11, fontWeight: '500', fontVariant: ['tabular-nums'] },
  pageBody: { paddingHorizontal: 20, paddingVertical: 18 },
  pageFlow: { textAlign: 'center', writingDirection: 'rtl' },

  pageActBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }) },
  pageActLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageActBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pageActBadgeT: { fontSize: 11, fontWeight: '700', color: '#fff' },
  pageActLabel: { fontSize: 13, fontWeight: '500' },
  pageActBtns: { flexDirection: 'row', gap: 6 },
  pageActBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* Floating page indicator - top center, minimal and quick fade */
  floatIndicator: {
    position: 'absolute', top: 8, alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10 }, android: { elevation: 4 } }),
  },
  floatText: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: 0.5 },

  endWrap: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  endLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  endDiv: { width: 40, height: 1, marginVertical: 8 },
  endVerse: { fontSize: 20, opacity: 0.6 },
  endTrans: { fontSize: 12, fontStyle: 'italic' },

  /* Verse card */
  vCard: { flexDirection: 'row', marginHorizontal: 14, marginBottom: 10, borderRadius: 18, borderWidth: 1, overflow: 'hidden', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 }, android: { elevation: 1 } }) },
  vAccent: { width: 3 },
  vInner: { flex: 1, padding: 16 },
  vTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  vBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  vBadgeT: { fontSize: 12, fontWeight: '700' },
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

  /* Player */
  ppOuter: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 },
  ppBlur: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderTopWidth: 1 },
  ppMiniRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  ppLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  ppBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ppInf: { flex: 1 },
  ppTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  ppSub: { fontSize: 11, marginTop: 2 },
  ppCtrls: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8 },
  ppCtrlBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ppPlayBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ppThin: { height: 2, marginHorizontal: 14, borderRadius: 1, overflow: 'hidden' },
  ppThinFill: { height: 2, borderRadius: 1 },
  ppExp: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
  ppSeekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  ppTime: { fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'], width: 32, textAlign: 'center' },
  ppTrack: { flex: 1, height: 24, justifyContent: 'center' },
  ppTrackBg: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
  ppTrackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  ppThumb: { position: 'absolute', top: 6, width: 12, height: 12, borderRadius: 6, marginLeft: -6, borderWidth: 2, borderColor: '#fff', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4 }, android: { elevation: 3 } }) },
  ppThumbS: { width: 16, height: 16, borderRadius: 8, top: 4, marginLeft: -8 },
  ppExRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 4, paddingBottom: 2 },
  ppExBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ppR1: { position: 'absolute', bottom: 4, right: 6, fontSize: 8, fontWeight: '800' },
  ppChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  ppChipT: { fontSize: 12, fontWeight: '600' },

  /* Auto-scroll */
  asBar: { height: 44, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, gap: 4, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 4 } }) },
  asTrig: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  asCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, width: 62, height: 36, borderRadius: 18 },
  asSide: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  asDis: { opacity: 0.35 },
  asLabel: { fontSize: 10, fontWeight: '700', color: '#fff' },
});