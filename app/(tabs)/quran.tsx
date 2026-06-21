/**
 * LibraryScreen — the "Quran" tab landing.
 *
 * Offers the library collections as a 2-column grid of cards (the SAME card
 * UI/UX used by the Ahadees books screen): a decorative corner-framed card with
 * a large Arabic title, an English name and a short status line.
 *   • Holy Quran       → /quran/surahs
 *   • Ahadees          → /quran/hadith
 *   • 15 Lines Quran   → /quran/parahs?lines=15
 *   • 16 Lines Quran   → /quran/parahs?lines=16
 */

import React, { useEffect, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';

interface LibraryCard {
  key: string;
  arabic: string;
  title: string;
  status: string;
  route: string;
}

const CARDS: LibraryCard[] = [
  { key: 'quran',    arabic: 'القرآن الكریم', title: 'Holy Quran',     status: '114 Surahs',         route: '/quran/surahs' },
  { key: 'hadith',   arabic: 'الأحادیث',      title: 'Ahadees',        status: 'Hadith Collections', route: '/quran/hadith' },
  { key: 'mushaf15', arabic: '۱۵ سطری',       title: '15 Lines Quran', status: 'Read by Parah',      route: '/quran/parahs?lines=15' },
  { key: 'mushaf16', arabic: '۱۶ سطری',       title: '16 Lines Quran', status: 'Read by Parah',      route: '/quran/parahs?lines=16' },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { theme, mode, toggleTheme } = useTheme();
  const router = useRouter();

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const renderItem = ({ item }: { item: LibraryCard }) => (
    <TouchableOpacity
      style={[styles.bookCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
      activeOpacity={0.7}
      onPress={() => router.push(item.route as any)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {/* Decorative corner accents — matches the Ahadees book cards */}
      <View style={[styles.corner, styles.topLeft, { borderTopColor: theme.textTertiary, borderLeftColor: theme.textTertiary }]} />
      <View style={[styles.corner, styles.topRight, { borderTopColor: theme.textTertiary, borderRightColor: theme.textTertiary }]} />
      <View style={[styles.corner, styles.bottomLeft, { borderBottomColor: theme.textTertiary, borderLeftColor: theme.textTertiary }]} />
      <View style={[styles.corner, styles.bottomRight, { borderBottomColor: theme.textTertiary, borderRightColor: theme.textTertiary }]} />

      <View style={styles.bookInfo}>
        <Text style={[styles.bookArabic, { color: theme.text }]} numberOfLines={2}>{item.arabic}</Text>
        <Text style={[styles.bookName, { color: theme.textSecondary }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.bookStatus, { color: theme.primaryMuted }]}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  const listHeader = (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.headerPattern}>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={[styles.patternCircle, { width: 100 + i * 50, height: 100 + i * 50, top: -10 + i * 8, right: -30 + i * 12, opacity: 0.03 + i * 0.008 }]} />
        ))}
      </View>
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
        <View style={styles.headerTopRow}>
          <View>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="library-outline" size={18} color="#fff" />
              </View>
            </View>
            <Text style={styles.headerTitle}>Library</Text>
            <Text style={styles.headerSub}>The Quran & authentic Ahadees</Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn} activeOpacity={0.7}>
            <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </LinearGradient>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={CARDS}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        numColumns={2}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.rowWrapper}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ─── Header ─── */
  header: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    marginBottom: 16,
  },
  headerPattern: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  patternCircle: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerIconRow: { marginBottom: 14 },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.2 },
  themeBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* ─── Grid (matches Ahadees books) ─── */
  rowWrapper: { paddingHorizontal: 12, justifyContent: 'space-between' },
  bookCard: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  corner: { position: 'absolute', width: 16, height: 16, borderWidth: 0, opacity: 0.3 },
  topLeft: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  topRight: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  bottomLeft: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },
  bookInfo: { alignItems: 'center', justifyContent: 'center' },
  bookArabic: { fontSize: 26, fontWeight: '500', textAlign: 'center', marginBottom: 10, lineHeight: 40, fontFamily: 'AlQalamQuran' },
  bookName: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 8, letterSpacing: -0.2 },
  bookStatus: { fontSize: 11, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
});
