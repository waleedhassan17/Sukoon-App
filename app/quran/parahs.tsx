/**
 * ParahListScreen — the 30 Juz (Parahs), shown when the reader opens a line-based
 * Quran from the Library. Tapping a parah deep-links the Mushaf reader to that
 * juz's starting page in the chosen line mode.
 * Route: /quran/parahs?lines=15|16
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { QuranService, SurahMeta } from '@/lib/quranService';
import { JUZ_LIST, Juz } from '@/lib/juzData';
import { getLayout } from '@/lib/mushafService';

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default function ParahListScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const linesPerPage = one(params.lines) === '16' ? 16 : 15;
  // Each bundled layout (610 / 548 pages) has its own juz start pages.
  const juzPages = getLayout(linesPerPage).juzPages;

  const [surahMap, setSurahMap] = useState<Map<number, SurahMeta>>(new Map());
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
    QuranService.getAllSurahs()
      .then((list) => setSurahMap(new Map(list.map((s) => [s.number, s]))))
      .catch(() => {});
  }, []);

  const openJuz = (j: Juz) => {
    const page = juzPages[j.number - 1] || j.page;
    router.push(`/quran/mushaf?lines=${linesPerPage}&startPage=${page}&juz=${j.number}` as any);
  };

  const renderItem = ({ item }: { item: Juz }) => {
    const meta = surahMap.get(item.startSurah);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openJuz(item)}
        style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Para ${item.number}`}
      >
        <LinearGradient colors={theme.headerGradient} style={styles.numBadge}>
          <Text style={styles.numBadgeText}>{item.number}</Text>
        </LinearGradient>
        <View style={styles.cardBody}>
          <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
            Para {item.number} · Starts {meta?.englishName || `Surah ${item.startSurah}`} {item.startAyah}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.pageLabel, { color: theme.textTertiary }]}>p.{item.page}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 14 }]}
    >
      <View style={styles.headerPattern}>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={[styles.patternCircle, { width: 100 + i * 50, height: 100 + i * 50, top: -10 + i * 8, right: -30 + i * 12, opacity: 0.03 + i * 0.008 }]} />
        ))}
      </View>
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIconRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="layers-outline" size={18} color="#fff" />
          </View>
        </View>
        <Text style={styles.headerTitle}>Parahs</Text>
        <Text style={styles.headerSub}>{linesPerPage} Lines Quran · 30 Juz</Text>
      </Animated.View>
    </LinearGradient>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={JUZ_LIST}
        keyExtractor={(item) => String(item.number)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: 22, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  headerPattern: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  patternCircle: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  headerIconRow: { marginBottom: 14 },
  headerIconWrap: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  numBadge: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  numBadgeText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardName: { fontFamily: 'AlQalamQuran', fontSize: 20, fontWeight: '600', writingDirection: 'rtl', textAlign: 'left', marginBottom: 2 },
  cardSub: { fontSize: 12, lineHeight: 17 },
  cardRight: { alignItems: 'center', flexDirection: 'row', gap: 4, marginLeft: 8 },
  pageLabel: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
