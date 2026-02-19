/**
 * QuranListScreen - Premium Surah browser
 * Refined design matching Sukoon aesthetic system
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { QuranService, SurahMeta } from '@/lib/quranService';
import { ReadingProgress } from '@/lib/readingProgress';
import { RADIUS } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function QuranListScreen() {
  const insets = useSafeAreaInsets();
  const { theme, mode, toggleTheme } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();

  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lastSeen, setLastSeen] = useState<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();

    loadData();
    const unsub = navigation.addListener('focus', () => {
      ReadingProgress.getLastSeen().then(setLastSeen).catch(() => {});
    });
    return unsub;
  }, []);

  const loadData = async () => {
    try {
      const [data, ls] = await Promise.all([
        QuranService.getAllSurahs(),
        ReadingProgress.getLastSeen(),
      ]);
      setSurahs(data);
      setLastSeen(ls);
    } catch (e) {
      Alert.alert('Error', 'Failed to load Surahs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = surahs.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.englishName.toLowerCase().includes(q) ||
      s.name.includes(q) ||
      String(s.number).includes(q)
    );
  });

  const handleSurahPress = useCallback(
    (surah: SurahMeta) => {
      router.push(
        `/quran/${surah.number}?surahName=${encodeURIComponent(surah.englishName)}&ayahCount=${surah.numberOfAyahs}`
      );
    },
    [router]
  );

  const handleResume = useCallback(() => {
    if (!lastSeen) return;
    const surah = surahs.find((s) => s.number === lastSeen.surah);
    if (surah) {
      router.push(
        `/quran/${surah.number}?surahName=${encodeURIComponent(surah.englishName)}&ayahCount=${surah.numberOfAyahs}&startAyah=${lastSeen.ayah}`
      );
    }
  }, [lastSeen, surahs, router]);

  const lastSeenSurah = lastSeen ? surahs.find((s) => s.number === lastSeen.surah) : null;

  /* ─── Surah Row ─── */
  const renderSurahItem = useCallback(
    ({ item }: { item: SurahMeta }) => {
      const isLastSeen = lastSeen?.surah === item.number;
      const isMeccan = item.revelationType === 'Meccan';

      return (
        <TouchableOpacity
          style={styles.surahCard}
          onPress={() => handleSurahPress(item)}
          activeOpacity={0.7}
        >
          {/* Number badge */}
          <View style={styles.surahNumWrap}>
            <LinearGradient
              colors={theme.headerGradient}
              style={styles.surahNumBadge}
            >
              <Text style={styles.surahNumText}>{item.number}</Text>
            </LinearGradient>
          </View>

          {/* Info */}
          <View style={styles.surahInfo}>
            <View style={styles.surahNameRow}>
              <Text style={[styles.surahEngName, { color: theme.text }]}>{item.englishName}</Text>
              <Text style={[styles.surahArabicInline, { color: theme.text }]}>{item.name}</Text>
            </View>
            <View style={styles.surahMetaRow}>
              <Text style={[styles.surahTrans, { color: theme.textSecondary }]}>{item.englishNameTranslation}</Text>
              <View style={[styles.metaDot, { backgroundColor: theme.border }]} />
              <Text style={[styles.surahAyahCount, { color: theme.textSecondary }]}>{item.numberOfAyahs} Ayahs</Text>
              <View style={[styles.metaDot, { backgroundColor: theme.border }]} />
              <Text
                style={[
                  styles.surahType,
                  { color: isMeccan ? theme.primaryMuted : '#7B6AAE' },
                ]}
              >
                {item.revelationType}
              </Text>
            </View>

            {/* Resume hint */}
            {isLastSeen && (
              <TouchableOpacity
                onPress={handleResume}
                style={[styles.inlineResume, { backgroundColor: theme.primaryMuted + '10' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="play-circle" size={13} color={theme.primaryMuted} />
                <Text style={[styles.inlineResumeText, { color: theme.primaryMuted }]}>
                  Resume Ayah {lastSeen.ayah}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Arrow */}
          <View style={[styles.surahArrow, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
          </View>
        </TouchableOpacity>
      );
    },
    [lastSeen, handleSurahPress, handleResume, theme]
  );

  /* ─── Loading ─── */
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primaryMuted} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading the Holy Quran…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* ═══════════════ HEADER ═══════════════ */}
      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
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
          {/* Top row */}
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>Holy Quran</Text>
              <Text style={styles.headerSub}>
                Read and reflect upon the words of Allah
              </Text>
            </View>
            <TouchableOpacity
              onPress={toggleTheme}
              style={styles.themeBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color="rgba(255,255,255,0.85)"
              />
            </TouchableOpacity>
          </View>

          {/* Resume card */}
          {lastSeen && lastSeenSurah && (
            <TouchableOpacity
              onPress={handleResume}
              activeOpacity={0.85}
              style={styles.resumeCard}
            >
              <View style={styles.resumeLeft}>
                <View style={styles.resumeIconWrap}>
                  <Ionicons name="bookmark" size={16} color="#fff" />
                </View>
                <View style={styles.resumeTextWrap}>
                  <Text style={styles.resumeTitle}>Continue Reading</Text>
                  <Text style={styles.resumeSub}>
                    {lastSeenSurah.englishName} · Ayah {lastSeen.ayah}
                  </Text>
                </View>
              </View>
              <View style={styles.resumeArrow}>
                <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.6)" />
              </View>
            </TouchableOpacity>
          )}

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: theme.surfaceElevated }, searchFocused && { shadowColor: theme.gold }]}>
            <Ionicons name="search-outline" size={16} color={theme.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search surah by name, number or Arabic"
              placeholderTextColor={theme.textTertiary}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.6}>
                <View style={[styles.clearBtn, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="close" size={12} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </LinearGradient>

      {/* ═══════════════ SURAH COUNTER ═══════════════ */}
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderText, { color: theme.textTertiary }]}>
          {filtered.length} {filtered.length === 1 ? 'Surah' : 'Surahs'}
        </Text>
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.6}>
            <Text style={[styles.clearSearch, { color: theme.primaryMuted }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ═══════════════ SURAH LIST ═══════════════ */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.number)}
        renderItem={renderSurahItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="search" size={28} color={theme.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Surahs Found</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Try a different search term</Text>
          </View>
        }
      />
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

  /* ─── Loading ─── */
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },

  /* ─── Header ─── */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── Resume Card ─── */
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resumeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resumeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resumeTextWrap: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  resumeSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  },
  resumeArrow: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* ─── Search ─── */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  searchBarFocused: {
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── List Header ─── */
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  clearSearch: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ─── Surah Card ─── */
  surahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  surahNumWrap: {
    marginRight: 14,
  },
  surahNumBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahNumText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  surahInfo: {
    flex: 1,
  },
  surahNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  surahEngName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  surahArabicInline: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
  surahMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  surahTrans: {
    fontSize: 12,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  surahAyahCount: {
    fontSize: 12,
  },
  surahType: {
    fontSize: 11,
    fontWeight: '600',
  },
  surahArrow: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  /* ─── Inline Resume ─── */
  inlineResume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inlineResumeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* ─── Separator ─── */
  separator: {
    height: 1,
    marginLeft: 74,
    marginRight: 20,
  },

  /* ─── List ─── */
  listContent: {
    paddingTop: 4,
  },

  /* ─── Empty ─── */
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
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
  },
});