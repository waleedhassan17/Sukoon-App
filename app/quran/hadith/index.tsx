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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { HadithService, HadithBook } from '@/lib/hadithService';

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

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* ═══════════════ HEADER — matches Settings / More Tools ═══════════════ */}
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
          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Icon badge */}
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="book-outline" size={18} color="#fff" />
            </View>
          </View>

          {/* Title & subtitle */}
          <Text style={styles.headerTitle}>Ahadees</Text>
          <Text style={styles.headerSub}>Authentic Hadith collections</Text>
        </Animated.View>
      </LinearGradient>

      {loading ? (
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
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        >
          <Text style={[styles.countText, { color: theme.textTertiary }]}>{books.length} Collections</Text>
          {books.map((book, idx) => (
            <TouchableOpacity
              key={book.id}
              style={[styles.bookCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
              activeOpacity={0.7}
              onPress={() => openBook(book)}
            >
              <LinearGradient colors={theme.headerGradient} style={styles.bookBadge}>
                <Text style={styles.bookBadgeText}>{idx + 1}</Text>
              </LinearGradient>
              <View style={styles.bookInfo}>
                <Text style={[styles.bookName, { color: theme.text }]} numberOfLines={1}>{book.name}</Text>
                <Text style={[styles.bookSub, { color: theme.textSecondary }]}>{book.language} • Hadith collection</Text>
              </View>
              <View style={[styles.bookArrow, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ─── Header — consistent with Settings / More Tools ─── */
  header: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
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

  /* ─── Content ─── */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  centerText: { fontSize: 14, textAlign: 'center' },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  listContent: { paddingTop: 20, paddingHorizontal: 16 },
  countText: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },

  /* ─── Book cards — elevated with border ─── */
  bookCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 10, borderRadius: 16, borderWidth: 1,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  bookBadge: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  bookBadgeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bookInfo: { flex: 1 },
  bookName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, marginBottom: 3 },
  bookSub: { fontSize: 12 },
  bookArrow: {
    width: 28, height: 28, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
});
