/**
 * HadithBooksScreen — list of available Hadith collections (Ahadees card target).
 * Reached from the Library landing → "Ahadees".
 *
 * Design matches the Settings / More Tools header style: gradient header with
 * icon badge, large title and subtitle, and consistent border radius.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { HadithService, HadithBook } from '@/lib/hadithService';

const { width } = Dimensions.get('window');

const ARABIC_NAMES: Record<string, string> = {
  'bukhari': 'صَحِيحُ البُخَارِي',
  'muslim': 'صَحِيحُ مُسْلِم',
  'tirmidzi': 'جَامِعُ التِّرْمِذِي',
  'tirmizi': 'جَامِعُ التِّرْمِذِي',
  'abudawud': 'سُنَنُ أَبِي دَاوُد',
  'nasai': 'سُنَنُ النَّسَائِي',
  'ibnmajah': 'سُنَنُ ابْنِ مَاجَه',
  'malik': 'مُوَطَّأ مَالِك',
  'ahmed': 'مُسْنَد أَحْمَد',
  'musnadahmed': 'مُسْنَد أَحْمَد',
  'silsila': 'السِّلْسِلَةُ الصَّحِيحَة',
  'mishkat': 'مِشْكَاةُ المَصَابِيح',
  'dehlawi': 'مُسْنَدُ الدِّهْلَوِي',
};

export default function HadithBooksScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const router = useRouter();

  const [books, setBooks] = useState<HadithBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const headerFade = React.useRef(new Animated.Value(0)).current;
  const headerSlide = React.useRef(new Animated.Value(24)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await HadithService.getBooks();
      setBooks(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
    load();
  }, [load]);

  const openBook = useCallback((book: HadithBook) => {
    router.push(`/quran/hadith/${book.id}?name=${encodeURIComponent(book.name)}` as any);
  }, [router]);

  const renderItem = useCallback(({ item: book }: { item: HadithBook }) => {
    const arabicName = ARABIC_NAMES[book.id] || book.name;
    return (
      <TouchableOpacity
        style={[styles.bookCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
        activeOpacity={0.7}
        onPress={() => openBook(book)}
      >
        {/* Decorative corner accents */}
        <View style={[styles.corner, styles.topLeft, { borderTopColor: theme.textTertiary, borderLeftColor: theme.textTertiary }]} />
        <View style={[styles.corner, styles.topRight, { borderTopColor: theme.textTertiary, borderRightColor: theme.textTertiary }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderBottomColor: theme.textTertiary, borderLeftColor: theme.textTertiary }]} />
        <View style={[styles.corner, styles.bottomRight, { borderBottomColor: theme.textTertiary, borderRightColor: theme.textTertiary }]} />

        <View style={styles.bookInfo}>
          <Text style={[styles.bookArabic, { color: theme.text }]} numberOfLines={2}>
            {arabicName}
          </Text>
          <Text style={[styles.bookName, { color: theme.textSecondary }]} numberOfLines={1}>
            {book.name}
          </Text>
          <Text style={[styles.bookStatus, { color: theme.primaryMuted }]}>
            Open Collection
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [theme, openBook]);

  const listHeader = (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.headerPattern}>
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.patternCircle,
              { width: 100 + i * 50, height: 100 + i * 50, top: -10 + i * 8, right: -30 + i * 12, opacity: 0.03 + i * 0.008 },
            ]}
          />
        ))}
      </View>
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerIconRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="book-outline" size={18} color="#fff" />
          </View>
        </View>

        <Text style={styles.headerTitle}>Ahadees</Text>
        <Text style={styles.headerSub}>Authentic Hadith collections</Text>
      </Animated.View>
    </LinearGradient>
  );

  const emptyBody = loading ? (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.primaryMuted} />
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>Loading collections…</Text>
    </View>
  ) : error ? (
    <View style={styles.center}>
      <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={theme.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn't load collections</Text>
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>Check your connection and try again.</Text>
      <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: theme.primary }]} activeOpacity={0.85}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={(!loading && !error) ? books : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={emptyBody}
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

  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  headerIconRow: { marginBottom: 14 },
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
    fontSize: 15, color: 'rgba(255,255,255,0.7)',
    fontWeight: '400', letterSpacing: 0.2,
  },

  /* ─── Grid ─── */
  rowWrapper: {
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  
  /* ─── Cards ─── */
  bookCard: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderWidth: 0,
    opacity: 0.3,
  },
  topLeft: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  topRight: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  bottomLeft: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },

  bookInfo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookArabic: {
    fontSize: 26,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 40,
    fontFamily: 'AlQalamQuran',
  },
  bookName: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  bookStatus: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ─── States ─── */
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, marginTop: 60 },
  centerText: { fontSize: 14, textAlign: 'center' },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
