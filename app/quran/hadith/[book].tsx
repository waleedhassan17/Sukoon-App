/**
 * HadithChaptersScreen — chapters (sections) of one Hadith collection.
 * Route: /quran/hadith/[edition]?name=<book name>
 *
 * Tapping a chapter opens the reader for that section. Design matches the
 * Settings / More Tools header style with gradient + icon + back button.
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { HadithService, HadithSection } from '@/lib/hadithService';

export default function HadithChaptersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ book: string; name?: string }>();
  const bookId = (Array.isArray(params.book) ? params.book[0] : params.book) ?? '';
  const initialName = (Array.isArray(params.name) ? params.name[0] : params.name) ?? '';

  // Header title: seeded from the passed name, then confirmed from the resolved
  // book so it's never empty even if the route param is missing.
  // Fallback: derive a title-cased name from the bookId (e.g. 'bukhari' → 'Bukhari').
  const fallbackName = bookId ? bookId.charAt(0).toUpperCase() + bookId.slice(1) : 'Hadith';
  const [bookName, setBookName] = useState(initialName || fallbackName);
  const [sections, setSections] = useState<HadithSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Resolve the book so we can read its chapter list from the English edition.
      const books = await HadithService.getBooks();
      const book = books.find((b) => b.id === bookId);
      if (book?.name) setBookName(book.name);
      const edition = book?.editions?.english ?? book?.edition;
      if (!edition) throw new Error('BOOK_NOT_FOUND');
      const data = await HadithService.getSections(edition);
      setSections(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.name.toLowerCase().includes(q) || String(s.number).includes(q));
  }, [sections, search]);

  const openSection = useCallback((section: HadithSection) => {
    router.push(
      `/quran/hadith/reader?book=${encodeURIComponent(bookId)}&num=${section.number}`
      + `&first=${section.first}&last=${section.last}`
      + `&sname=${encodeURIComponent(section.name)}&bookname=${encodeURIComponent(bookName)}` as any,
    );
  }, [router, bookId, bookName]);

  const renderItem = useCallback(({ item }: { item: HadithSection }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
      activeOpacity={0.7}
      onPress={() => openSection(item)}
    >
      <LinearGradient colors={theme.headerGradient} style={styles.badge}>
        <Text style={styles.badgeText}>{item.number}</Text>
      </LinearGradient>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
        {item.count > 0 && (
          <Text style={[styles.sub, { color: theme.textSecondary }]}>{item.count} Ahadees</Text>
        )}
      </View>
      <View style={[styles.arrow, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
      </View>
    </TouchableOpacity>
  ), [theme, openSection]);

  const listHeader = (
    <>
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
          {/* Back button row */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Icon badge */}
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="library-outline" size={18} color="#fff" />
            </View>
          </View>

          {/* Title & subtitle */}
          <Text style={styles.headerTitle} numberOfLines={1}>{bookName}</Text>
          <Text style={styles.headerSub}>
            {sections.length > 0 ? `${sections.length} Chapters` : 'Hadith Collection'}
          </Text>
        </Animated.View>
      </LinearGradient>

      {/* ═══════════════ SEARCH BAR — below header, controlled width ═══════════════ */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
          <Ionicons name="search-outline" size={16} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search chapters"
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.6}>
              <View style={[styles.clearBtn, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="close" size={12} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );

  // Single FlatList return — the header is ALWAYS inside ListHeaderComponent,
  // preventing unmount/remount that kills the fade-in animation on web.
  const emptyBody = loading ? (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.primaryMuted} />
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>Loading chapters…</Text>
    </View>
  ) : error ? (
    <View style={styles.center}>
      <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={theme.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn't load chapters</Text>
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>Check your connection and try again.</Text>
      <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: theme.primary }]} activeOpacity={0.85}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.center}>
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>No chapters match "{search}".</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={(!loading && !error) ? filtered : []}
        keyExtractor={(item) => String(item.number)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={emptyBody}
      />
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

  /* ─── Search bar — outside gradient, controlled width ─── */
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    gap: 10, borderWidth: 1,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '400' },
  clearBtn: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  /* ─── Empty / Loading / Error states ─── */
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, paddingTop: 80 },
  centerText: { fontSize: 14, textAlign: 'center' },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* ─── Chapter cards — elevated with border ─── */
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  badge: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, marginBottom: 3 },
  sub: { fontSize: 12 },
  arrow: {
    width: 28, height: 28, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
});
