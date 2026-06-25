/**
 * EmotionResultScreen - Detected Emotions & Quranic Guidance
 * Refined design matching Sukoon aesthetic system
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/contexts/FontSizeContext';
import { useSavedVerses } from '@/contexts/SavedVersesContext';
import { EmotionService } from '@/lib/emotionService';
import type { EmotionResult, VerseRecommendation, AnalysisResult } from '@/lib/emotionService';
import { getStaticEmotionData } from '@/lib/staticVerses';
import { buildAyahShareMessage } from '@/lib/shareFormat';
import { EMOTION_MAP } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');

interface ThemeInterface {
  border: string;
  [key: string]: any;
}

/* ─── Staggered entry hook ─── */
function useStagger(count: number, delay = 80) {
  const ops = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  const sls = useRef(Array.from({ length: count }, () => new Animated.Value(18))).current;

  useEffect(() => {
    ops.forEach((op, i) => {
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 450, delay: i * delay + 200, useNativeDriver: true }),
        Animated.timing(sls[i], { toValue: 0, duration: 450, delay: i * delay + 200, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  return ops.map((o, i) => ({ opacity: o, transform: [{ translateY: sls[i] }] }));
}

/* ─── Ornament ─── */
function Ornament({ theme }: { theme: ThemeInterface }) {
  return (
    <View style={s.ornRow}>
      <View style={[s.ornLine, { backgroundColor: theme.border }]} />
      <View style={[s.ornDot, { backgroundColor: theme.border }]} />
      <View style={[s.ornLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

export default function EmotionResultScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { sizes } = useFontSize();
  const { saveVerse, removeVerse, isVerseSaved } = useSavedVerses();
  const params = useLocalSearchParams();
  const router = useRouter();
  const text = (params.text as string) || '';
  const staticEmotion = (params.staticEmotion as string) || '';

  const [loading, setLoading] = useState(true);
  const [emotions, setEmotions] = useState<EmotionResult[]>([]);
  const [verses, setVerses] = useState<VerseRecommendation[]>([]);
  const [analysisSource, setAnalysisSource] = useState<'api' | 'fallback'>('api');
  const [modelVersion, setModelVersion] = useState('');
  const [languageDetected, setLanguageDetected] = useState('');

  // We'll create stagger anims after loading
  // For now, use a simple content fade
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    analyzeAndFetch();
  }, [text, staticEmotion]);

  const analyzeAndFetch = async () => {
    setLoading(true);
    try {
      // ── Static emotion card path: skip API entirely ──
      // Show the splash/loading screen for a minimum duration so the
      // transition feels intentional and calming, matching the "Find Guidance"
      // UX. Without this, the screen flashes briefly since curated data
      // loads instantly (no network call).
      if (staticEmotion) {
        const SPLASH_MIN_MS = 1800; // 1.8s — enough to read the calming message
        const splashTimer = new Promise(r => setTimeout(r, SPLASH_MIN_MS));

        const staticData = getStaticEmotionData(staticEmotion);
        if (staticData) {
          // Wait for the minimum splash duration before revealing results
          await splashTimer;
          setEmotions(staticData.emotions);
          setVerses(staticData.verses);
          setAnalysisSource('api'); // show as confident
          setModelVersion('static-curated');
          setLanguageDetected('en');
          Animated.parallel([
            Animated.timing(contentFade, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }),
            Animated.timing(contentSlide, { toValue: 0, duration: 500, delay: 150, useNativeDriver: true }),
          ]).start();
          return;
        }
      }
      // ── Normal path: call the ML emotion API ──
      const result: AnalysisResult = await EmotionService.analyze(text, 5, 5);
      setEmotions(result.emotions);
      setVerses(result.verses);
      setAnalysisSource(result.source);
      setModelVersion(result.modelVersion);
      setLanguageDetected(result.languageDetected);
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }),
        Animated.timing(contentSlide, { toValue: 0, duration: 500, delay: 150, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      if (__DEV__) console.error('Analysis error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (verse: VerseRecommendation) => {
    try {
      await Share.share({
        message: buildAyahShareMessage({
          surahName: verse.surahName,
          surahNumber: verse.surah,
          ayahNumber: verse.ayah,
          arabic: verse.arabic,
          english: verse.english,
          urdu: verse.urdu,
        }),
      });
    } catch {}
  };

  const toggleBookmark = (verse: VerseRecommendation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isVerseSaved(verse.surah, verse.ayah)) {
      removeVerse(verse.surah, verse.ayah);
    } else {
      saveVerse({
        surah: verse.surah,
        ayah: verse.ayah,
        arabic: verse.arabic,
        english: verse.english,
        urdu: verse.urdu,
        surahName: verse.surahName,
        emotions: verse.matchedEmotion ? [verse.matchedEmotion] : [],
      });
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: theme.surface }]}>
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.loadingGradient, { paddingTop: insets.top + 40 }]}
        >
          <View style={s.loadingContent}>
            <View style={s.loadingPulse}>
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                style={s.loadingCircle}
              >
                <Ionicons name="heart-outline" size={32} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            </View>
            <Text style={s.loadingTitle}>Analyzing your feelings…</Text>
            <Text style={s.loadingSub}>Finding Quranic guidance for you</Text>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{ marginTop: 20 }} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.surface }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ═══════════════ HEADER ═══════════════ */}
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.header, { paddingTop: insets.top + 10 }]}
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

          {/* Back row */}
          <View style={s.headerBar}>
            <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={s.headerBarTitle}>Guidance</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Quote card inside header */}
          <View style={s.quoteCard}>
            <View style={s.quoteIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.accent} />
            </View>
            <View style={s.quoteContent}>
              <Text style={s.quoteLabel}>You expressed</Text>
              <Text style={s.quoteText}>"{text}"</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ═══════════════ BODY ═══════════════ */}
        <Animated.View
          style={[
            s.body,
            { opacity: contentFade, transform: [{ translateY: contentSlide }] },
          ]}
        >
          {/* ═══════════════ EMOTIONS ═══════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>Detected Emotions</Text>
                {analysisSource === 'api' && (
                  <View style={{ backgroundColor: '#2D6A4F18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#2D6A4F' }}>AI</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[s.emotionsCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
              {emotions.map((em, i) => {
                const info = EMOTION_MAP[em.emotion] || {
                  icon: 'ellipse',
                  color: theme.primaryMuted,
                  label: em.emotion,
                };
                const pct = Math.round(em.confidence * 100);
                return (
                  <View key={i} style={s.emotionRow}>
                    <View style={[s.emotionIconWrap, { backgroundColor: info.color + '12' }]}>
                      <Ionicons name={info.icon as any} size={16} color={info.color} />
                    </View>
                    <Text numberOfLines={1} style={[s.emotionLabel, { color: theme.text }]}>{info.label}</Text>
                    <View style={[s.emotionBarTrack, { backgroundColor: theme.surfaceMuted }]}>
                      <View
                        style={[
                          s.emotionBarFill,
                          { backgroundColor: info.color, width: `${pct}%` },
                        ]}
                      />
                    </View>
                    <Text style={[s.emotionPct, { color: theme.textTertiary }]}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ─── Divider ─── */}
          <Ornament theme={theme} />

          {/* ═══════════════ VERSES ═══════════════ */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Quranic Guidance</Text>
              <Text style={[s.sectionSub, { color: theme.textSecondary }]}>
                {verses.length} verse{verses.length !== 1 ? 's' : ''} recommended
              </Text>
            </View>

            {verses.map((verse, i) => {
              const saved = isVerseSaved(verse.surah, verse.ayah);
              return (
                <View key={i} style={[s.verseCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
                  {/* Accent bar */}
                  <View style={[s.verseAccent, { backgroundColor: theme.primaryMuted + '40' }]} />

                  <View style={s.verseInner}>
                    {/* Header */}
                    <View style={s.verseTopRow}>
                      <View style={s.verseRefRow}>
                        <LinearGradient
                          colors={['#143D2B', '#2D6A4F']}
                          style={s.verseRefBadge}
                        >
                          <Text style={s.verseRefBadgeText}>
                            {verse.surah}:{verse.ayah}
                          </Text>
                        </LinearGradient>
                        <Text style={[s.verseRefName, { color: theme.text }]}>{verse.surahName}</Text>
                      </View>
                      <View style={s.verseActions}>
                        <TouchableOpacity
                          style={[s.verseActBtn, { backgroundColor: theme.surfaceMuted }]}
                          onPress={() => toggleBookmark(verse)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={saved ? 'bookmark' : 'bookmark-outline'}
                            size={17}
                            color={saved ? theme.accent : theme.textTertiary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.verseActBtn, { backgroundColor: theme.surfaceMuted }]}
                          onPress={() => handleShare(verse)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="share-outline" size={17} color={theme.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Arabic */}
                    <View style={[s.arabicWrap, { backgroundColor: theme.primaryMuted + '08' }]}>
                      <Text style={[s.arabicText, { color: theme.arabicText, fontSize: sizes.arabic, lineHeight: sizes.arabicLine }]}>{(verse.arabic || '').replace(/[\u06DF\u06E0]/g, '')}</Text>
                    </View>

                    {/* Gold divider */}
                    <View style={[s.goldLine, { backgroundColor: theme.goldLight }]} />

                    {/* English */}
                    <Text style={[s.englishText, { color: theme.textSecondary, fontSize: sizes.english, lineHeight: sizes.englishLine }]}>{verse.english}</Text>

                    {/* Urdu */}
                    {verse.urdu && (
                      <Text style={[s.urduText, { color: theme.textSecondary, fontSize: sizes.urdu, lineHeight: sizes.urduLine }]}>{verse.urdu}</Text>
                    )}

                    {/* Matched emotion tag */}
                    {verse.matchedEmotion && (
                      <View style={[s.tagsRow, { borderTopColor: theme.border }]}>
                        <View style={[s.tag, { backgroundColor: (EMOTION_MAP[verse.matchedEmotion]?.color || theme.accent) + '14' }]}>
                          <Text style={[s.tagText, { color: EMOTION_MAP[verse.matchedEmotion]?.color || theme.accent }]}>{verse.matchedEmotion}</Text>
                        </View>
                        {verse.relevanceScore > 0 && (
                          <View style={[s.tag, { backgroundColor: theme.surfaceMuted }]}>
                            <Text style={[s.tagText, { color: theme.textTertiary }]}>{Math.round(verse.relevanceScore * 100)}% match</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Empty */}
            {verses.length === 0 && (
              <View style={s.emptyWrap}>
                <View style={[s.emptyIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="cloud-outline" size={28} color={theme.textTertiary} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.text }]}>No Verses Found</Text>
                <Text style={[s.emptySub, { color: theme.textSecondary }]}>
                  Try expressing your feelings differently
                </Text>
              </View>
            )}
          </View>

          {/* ─── Divider ─── */}
          <Ornament theme={theme} />

          {/* ═══════════════ NEW SEARCH ═══════════════ */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={s.newSearchWrap}
          >
            <LinearGradient
              colors={['#143D2B', '#2D6A4F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.newSearchBtn}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={s.newSearchText}>Express New Feeling</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ═══════════════ FOOTER ═══════════════ */}
          <View style={s.footer}>
            <View style={s.footerCard}>
              <LinearGradient
                colors={theme.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.footerGradient}
              >
                <Ionicons name="heart" size={16} color={theme.accent} style={{ opacity: 0.7 }} />
                <Text style={s.footerText}>
                  May these verses bring peace to your heart
                </Text>
              </LinearGradient>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1 },

  /* ─── Loading ─── */
  loadingGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingPulse: {
    marginBottom: 24,
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  loadingSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },

  /* ─── Header ─── */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  headerPat: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fff',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },

  /* Quote card */
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  quoteIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  quoteContent: {
    flex: 1,
  },
  quoteLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
    lineHeight: 22,
  },

  /* ─── Body ─── */
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  /* ─── Ornament ─── */
  ornRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 8,
  },
  ornLine: {
    width: 40,
    height: 1,
  },
  ornDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  /* ─── Section ─── */
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 13,
  },

  /* ─── Emotions ─── */
  emotionsCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emotionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
    minWidth: 80,
    maxWidth: 110,
  },
  emotionBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  emotionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emotionPct: {
    fontSize: 12,
    fontWeight: '700',
    width: 34,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  /* ─── Verse Card ─── */
  verseCard: {
    flexDirection: 'row',
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  verseAccent: {
    width: 3,
  },
  verseInner: {
    flex: 1,
    padding: 16,
  },

  /* Verse top row */
  verseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  verseRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verseRefBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  verseRefBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  verseRefName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  verseActions: {
    flexDirection: 'row',
    gap: 4,
  },
  verseActBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Arabic */
  arabicWrap: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  arabicText: {
    fontSize: 22,
    lineHeight: 40,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '500',
    fontFamily: 'AlQalamQuran',
  },

  /* Gold divider */
  goldLine: {
    width: 28,
    height: 1.5,
    marginBottom: 12,
  },

  /* Translations */
  englishText: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  urduText: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: 'JameelNooriNastaleeq',
    marginBottom: 8,
  },

  /* Tags */
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  /* ─── Empty ─── */
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },

  /* ─── New Search ─── */
  newSearchWrap: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  newSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
    borderRadius: 16,
  },
  newSearchText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* ─── Footer ─── */
  footer: {
    marginTop: 20,
  },
  footerCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  footerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 10,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
  },
});