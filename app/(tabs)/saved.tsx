/**
 * SavedScreen - Bookmarked Verses Collection
 * Refined design matching Sukoon aesthetic system
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/contexts/FontSizeContext';
import { useSavedVerses } from '@/contexts/SavedVersesContext';
import { useSavedHadiths } from '@/contexts/SavedHadithsContext';

type Tab = 'verses' | 'hadees';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { sizes } = useFontSize();
  const { savedVerses, removeVerse, clearAllVerses } = useSavedVerses();
  const { savedHadiths, removeHadith, clearAllHadiths } = useSavedHadiths();
  const [tab, setTab] = useState<Tab>('verses');

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(contentFade, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true }),
      Animated.timing(contentSlide, { toValue: 0, duration: 500, delay: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleShare = async (verse: any) => {
    try {
      // Build beautifully formatted share card
      let shareMessage = `┌─────────────────────────┐\n`;
      shareMessage += `│  📖 ${verse.surahName || 'Quran'}  │\n`;
      shareMessage += `└─────────────────────────┘\n\n`;
      
      // Arabic text with proper alignment indicator
      shareMessage += `﴿ ${verse.arabic} ﴾\n\n`;
      
      // English translation
      if (verse.english) {
        shareMessage += `"${verse.english}"\n\n`;
      }
      
      // Reference footer
      shareMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      shareMessage += `📍 Surah ${verse.surahName || verse.surah} • Ayah ${verse.ayah}\n`;
      shareMessage += `\n🌙 Shared via Sukoon App`;
      
      await Share.share({ message: shareMessage });
    } catch {}
  };

  const handleRemove = (verse: any) => {
    Alert.alert('Remove Verse', 'Remove this verse from your collection?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeVerse(verse.surah, verse.ayah) },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All', 'Remove all saved verses? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearAllVerses },
    ]);
  };

  const handleShareHadith = async (hadith: any) => {
    try {
      let msg = `📖 ${hadith.bookName || 'Hadith'}\n\n`;
      if (hadith.arabic) msg += `${hadith.arabic}\n\n`;
      const translation = hadith.english || hadith.urdu;
      if (translation) msg += `"${translation}"\n\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📍 ${hadith.bookName || 'Hadith'} • Book ${hadith.refBook ?? ''}, Hadith ${hadith.refHadith ?? hadith.hadithNumber}\n`;
      if (hadith.grade) msg += `✓ ${hadith.grade}\n`;
      msg += `\n🌙 Shared via Sukoon App`;
      await Share.share({ message: msg });
    } catch {}
  };

  const handleRemoveHadith = (hadith: any) => {
    Alert.alert('Remove Hadith', 'Remove this hadith from your collection?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeHadith(hadith.book, hadith.hadithNumber) },
    ]);
  };

  const handleClearAllHadiths = () => {
    Alert.alert('Clear All', 'Remove all saved hadees? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearAllHadiths },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ═══════════════ HEADER ═══════════════ */}
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          {/* Decorative circles */}
          <View style={styles.headerPattern}>
            {[...Array(5)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.patternCircle,
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

          <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="bookmark" size={18} color="#fff" />
              </View>
            </View>
            <Text style={styles.headerTitle}>Saved</Text>
            <Text style={styles.headerSub}>Your personal Quran & Hadith collection</Text>

            {/* Stats pill */}
            <View style={styles.headerStats}>
              <View style={styles.statPill}>
                <Ionicons name="layers-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statPillText}>
                  {savedVerses.length} {savedVerses.length === 1 ? 'verse' : 'verses'} · {savedHadiths.length} {savedHadiths.length === 1 ? 'hadith' : 'hadees'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ═══════════════ TAB TOGGLE ═══════════════ */}
        <View style={styles.tabRow}>
          <View style={[styles.tabSegment, { backgroundColor: theme.surfaceMuted }]}>
            <TouchableOpacity
              onPress={() => setTab('verses')}
              activeOpacity={0.85}
              style={[styles.tabBtn, tab === 'verses' && { backgroundColor: theme.primary }]}
            >
              <Ionicons name="book-outline" size={15} color={tab === 'verses' ? '#fff' : theme.textSecondary} />
              <Text style={[styles.tabText, { color: tab === 'verses' ? '#fff' : theme.textSecondary }]}>Verses</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab('hadees')}
              activeOpacity={0.85}
              style={[styles.tabBtn, tab === 'hadees' && { backgroundColor: theme.primary }]}
            >
              <Ionicons name="bookmarks-outline" size={15} color={tab === 'hadees' ? '#fff' : theme.textSecondary} />
              <Text style={[styles.tabText, { color: tab === 'hadees' ? '#fff' : theme.textSecondary }]}>Hadees</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══════════════ CONTENT ═══════════════ */}
        <Animated.View
          style={[
            styles.body,
            { opacity: contentFade, transform: [{ translateY: contentSlide }] },
          ]}
        >
          {tab === 'verses' && (savedVerses.length === 0 ? (
            /* ─── Empty State ─── */
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.primaryMuted + '12' }]}>
                <Ionicons name="bookmark-outline" size={32} color={theme.primaryMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Saved Verses Yet</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Tap the bookmark icon on any verse{'\n'}to add it to your collection
              </Text>

              {/* Decorative hint card */}
              <View style={[styles.emptyHintCard, { backgroundColor: theme.surfaceWarm }]}>
                <View style={styles.emptyHintIcon}>
                  <Ionicons name="bulb-outline" size={16} color={theme.gold} />
                </View>
                <Text style={[styles.emptyHintText, { color: theme.textSecondary }]}>
                  Save verses that comfort you during difficult times so you can revisit them easily.
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* ─── Action Bar ─── */}
              <View style={styles.actionBar}>
                <Text style={[styles.actionBarLabel, { color: theme.textTertiary }]}>
                  {savedVerses.length} {savedVerses.length === 1 ? 'VERSE' : 'VERSES'}
                </Text>
                <TouchableOpacity
                  onPress={handleClearAll}
                  style={[styles.clearAllBtn, { backgroundColor: theme.error + '14' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color={theme.error} />
                  <Text style={[styles.clearAllText, { color: theme.error }]}>Clear All</Text>
                </TouchableOpacity>
              </View>

              {/* ─── Verse Cards ─── */}
              {savedVerses.map((verse, index) => (
                <View
                  key={`${verse.surah}-${verse.ayah}`}
                  style={[styles.verseCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
                >
                  {/* Card Header */}
                  <View style={styles.verseHeader}>
                    <View style={styles.verseRefRow}>
                      <LinearGradient
                        colors={[theme.primaryLight, theme.primary]}
                        style={styles.verseRefBadge}
                      >
                        <Text style={styles.verseRefBadgeText}>
                          {verse.surah}:{verse.ayah}
                        </Text>
                      </LinearGradient>
                      <Text style={[styles.verseRefName, { color: theme.text }]}>
                        {verse.surahName || 'Surah'}
                      </Text>
                    </View>
                    <View style={styles.verseActions}>
                      <TouchableOpacity
                        onPress={() => handleShare(verse)}
                        style={[styles.verseActionBtn, { backgroundColor: theme.surfaceMuted }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="share-outline" size={16} color={theme.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemove(verse)}
                        style={[styles.verseActionBtn, { backgroundColor: theme.error + '14' }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={15} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Arabic Text */}
                  <View style={[styles.arabicWrap, { backgroundColor: theme.primaryMuted + '08' }]}>
                    <Text style={[styles.arabicText, { color: theme.arabicText, fontSize: sizes.arabic, lineHeight: sizes.arabicLine }]}>{(verse.arabic || '').replace(/[\u06DF\u06E0]/g, '')}</Text>
                  </View>

                  {/* Divider accent */}
                  <View style={[styles.verseDivider, { backgroundColor: theme.gold + '30' }]} />

                  {/* English */}
                  <Text style={[styles.englishText, { color: theme.text, fontSize: sizes.english, lineHeight: sizes.englishLine }]}>{verse.english}</Text>

                  {/* Urdu */}
                  {verse.urdu && (
                    <Text style={[styles.urduText, { color: theme.textSecondary, fontSize: sizes.urdu, lineHeight: sizes.urduLine }]}>{verse.urdu}</Text>
                  )}

                  {/* Footer */}
                  {verse.savedAt && (
                    <View style={[styles.verseFooter, { borderTopColor: theme.border }]}>
                      <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
                      <Text style={[styles.verseDate, { color: theme.textTertiary }]}>
                        Saved {new Date(verse.savedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {/* ─── Bottom Verse ─── */}
              <View style={styles.bottomCard}>
                <LinearGradient
                  colors={theme.headerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bottomGradient}
                >
                  <View style={styles.bottomDecoTop}>
                    <Text style={[styles.bottomDecoChar, { color: theme.gold }]}>﷽</Text>
                  </View>
                  <Text style={styles.bottomArabic}>
                    فَاذْكُرُونِي أَذْكُرْكُمْ
                  </Text>
                  <View style={styles.bottomDividerLine} />
                  <Text style={styles.bottomEnglish}>
                    "So remember Me; I will remember you."
                  </Text>
                  <Text style={styles.bottomRef}>Surah Al-Baqarah · 2:152</Text>
                </LinearGradient>
              </View>
            </>
          ))}

          {/* ═══════════════ HADEES TAB ═══════════════ */}
          {tab === 'hadees' && (savedHadiths.length === 0 ? (
            /* ─── Empty State ─── */
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.primaryMuted + '12' }]}>
                <Ionicons name="bookmarks-outline" size={32} color={theme.primaryMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Saved Hadees Yet</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Tap the bookmark icon on any hadith{'\n'}to add it to your collection
              </Text>

              <View style={[styles.emptyHintCard, { backgroundColor: theme.surfaceWarm }]}>
                <View style={styles.emptyHintIcon}>
                  <Ionicons name="bulb-outline" size={16} color={theme.gold} />
                </View>
                <Text style={[styles.emptyHintText, { color: theme.textSecondary }]}>
                  Save the sayings of the Prophet ﷺ that inspire you so you can revisit them anytime.
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* ─── Action Bar ─── */}
              <View style={styles.actionBar}>
                <Text style={[styles.actionBarLabel, { color: theme.textTertiary }]}>
                  {savedHadiths.length} {savedHadiths.length === 1 ? 'HADITH' : 'HADEES'}
                </Text>
                <TouchableOpacity
                  onPress={handleClearAllHadiths}
                  style={[styles.clearAllBtn, { backgroundColor: theme.error + '14' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color={theme.error} />
                  <Text style={[styles.clearAllText, { color: theme.error }]}>Clear All</Text>
                </TouchableOpacity>
              </View>

              {/* ─── Hadith Cards ─── */}
              {savedHadiths.map((hadith) => (
                <View
                  key={`${hadith.book}-${hadith.hadithNumber}`}
                  style={[styles.verseCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
                >
                  {/* Card Header */}
                  <View style={styles.verseHeader}>
                    <View style={styles.verseRefRow}>
                      <LinearGradient
                        colors={[theme.primaryLight, theme.primary]}
                        style={styles.verseRefBadge}
                      >
                        <Text style={styles.verseRefBadgeText}>#{hadith.hadithNumber}</Text>
                      </LinearGradient>
                      <Text style={[styles.verseRefName, { color: theme.text }]} numberOfLines={1}>
                        {hadith.bookName || 'Hadith'}
                      </Text>
                    </View>
                    <View style={styles.verseActions}>
                      <TouchableOpacity
                        onPress={() => handleShareHadith(hadith)}
                        style={[styles.verseActionBtn, { backgroundColor: theme.surfaceMuted }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="share-outline" size={16} color={theme.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveHadith(hadith)}
                        style={[styles.verseActionBtn, { backgroundColor: theme.error + '14' }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={15} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Arabic Text */}
                  {!!hadith.arabic && (
                    <View style={[styles.arabicWrap, { backgroundColor: theme.primaryMuted + '08' }]}>
                      <Text style={[styles.arabicText, { color: theme.arabicText, fontSize: sizes.arabic, lineHeight: sizes.arabicLine }]}>{hadith.arabic}</Text>
                    </View>
                  )}

                  {/* Divider accent */}
                  <View style={[styles.verseDivider, { backgroundColor: theme.gold + '30' }]} />

                  {/* English */}
                  {!!hadith.english && (
                    <Text style={[styles.englishText, { color: theme.text, fontSize: sizes.english, lineHeight: sizes.englishLine }]}>{hadith.english}</Text>
                  )}

                  {/* Urdu */}
                  {!!hadith.urdu && (
                    <Text style={[styles.urduText, { color: theme.textSecondary, fontSize: sizes.urdu, lineHeight: sizes.urduLine }]}>{hadith.urdu}</Text>
                  )}

                  {/* Footer */}
                  <View style={[styles.verseFooter, { borderTopColor: theme.border }]}>
                    <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
                    <Text style={[styles.verseDate, { color: theme.textTertiary }]}>
                      Saved {new Date(hadith.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {hadith.grade ? `  ·  ${hadith.grade}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* ─── Header ─── */
  header: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  headerPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fff',
  },
  headerIconRow: {
    marginBottom: 14,
  },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28, fontWeight: '700', color: '#fff',
    letterSpacing: -0.5, marginBottom: 6,
  },
  headerSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    letterSpacing: 0.2,
    marginBottom: 16,
  },
  headerStats: {
    flexDirection: 'row',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statPillText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  /* ─── Tab toggle ─── */
  tabRow: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  tabSegment: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabText: { fontSize: 14, fontWeight: '700' },

  /* ─── Body ─── */
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  /* ─── Empty State ─── */
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,163,115,0.15)',
    marginHorizontal: 10,
  },
  emptyHintIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(212,163,115,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  emptyHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  /* ─── Action Bar ─── */
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* ─── Verse Card ─── */
  verseCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 12,
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
  verseActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── Arabic ─── */
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

  /* ─── Divider ─── */
  verseDivider: {
    width: 32,
    height: 1.5,
    marginBottom: 12,
  },

  /* ─── Translation ─── */
  englishText: {
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  urduText: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: 'JameelNooriNastaleeq',
    marginBottom: 6,
  },

  /* ─── Footer ─── */
  verseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  verseDate: {
    fontSize: 11,
    fontWeight: '500',
  },

  /* ─── Bottom Verse ─── */
  bottomCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
  },
  bottomGradient: {
    padding: 28,
    alignItems: 'center',
  },
  bottomDecoTop: {
    marginBottom: 16,
    opacity: 0.4,
  },
  bottomDecoChar: {
    fontSize: 28,
  },
  bottomArabic: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 40,
    marginBottom: 14,
    fontWeight: '500',
    fontFamily: 'AlQalamQuran',
  },
  bottomDividerLine: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(212,163,115,0.35)',
    borderRadius: 1,
    marginBottom: 14,
  },
  bottomEnglish: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 10,
  },
  bottomRef: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});