/**
 * HadithReaderScreen — the hadiths within one chapter, shown in Arabic with a
 * Urdu / English translation (default Urdu when the book has it).
 * Route: /quran/hadith/reader?book=&num=&first=&last=&sname=&bookname=
 *
 * The header carries a back button, the chapter title and the book name. A small
 * translation toggle lets the reader switch between Urdu and English, mirroring
 * the language controls used on the Quran reading screen. Design stays
 * consistent with the rest of the app.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Animated,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/contexts/FontSizeContext';
import { useSavedHadiths } from '@/contexts/SavedHadithsContext';
import { HadithService, MergedHadith, HadithSection } from '@/lib/hadithService';

/** Build a nicely formatted share message for a hadith. */
function buildHadithShareMessage(item: MergedHadith, bookName: string, sectionNumber: number): string {
  let msg = `📖 ${bookName}\n\n`;
  if (item.arabic) msg += `${item.arabic}\n\n`;
  const translation = item.english || item.urdu;
  if (translation) msg += `"${translation}"\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📍 ${bookName} • Book ${item.reference?.book ?? sectionNumber}, Hadith ${item.reference?.hadith ?? item.hadithnumber}\n`;
  if (item.grades?.length) msg += `✓ ${item.grades[0].grade}\n`;
  msg += `\n🌙 Shared via Sukoon App`;
  return msg;
}

type Translation = 'urdu' | 'english';

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default function HadithReaderScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { sizes } = useFontSize();
  const { saveHadith, removeHadith, isHadithSaved } = useSavedHadiths();
  const router = useRouter();
  const params = useLocalSearchParams();

  const bookId = one(params.book);
  // Derive a title-cased fallback from bookId (e.g. 'bukhari' → 'Bukhari')
  const bookIdFallback = bookId ? bookId.charAt(0).toUpperCase() + bookId.slice(1) : 'Hadith';
  const [bookName, setBookName] = useState(one(params.bookname) || bookIdFallback);
  const [sectionName, setSectionName] = useState(one(params.sname));
  const sectionNumber = Number(one(params.num)) || 0;
  const section: HadithSection = {
    number: sectionNumber,
    name: sectionName,
    first: Number(one(params.first)) || 0,
    last: Number(one(params.last)) || 0,
    count: 0,
  };

  const [hadiths, setHadiths] = useState<MergedHadith[]>([]);
  const [hasUrdu, setHasUrdu] = useState(false);
  const [translation, setTranslation] = useState<Translation>('urdu');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  const arabicSize = Math.round(sizes.arabic * 0.72);
  const arabicLine = Math.round(arabicSize * 1.85);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const books = await HadithService.getBooks();
      const book = books.find((b) => b.id === bookId);
      if (!book) throw new Error('BOOK_NOT_FOUND');
      if (book.name) setBookName(book.name);
      const urduAvailable = !!book.editions?.urdu;
      setHasUrdu(urduAvailable);
      setTranslation(urduAvailable ? 'urdu' : 'english');

      // If sectionName is empty (route param was missing), resolve it from the TOC.
      if (!sectionName) {
        try {
          const edition = book.editions?.english ?? book.edition;
          if (edition) {
            const toc = await HadithService.getSections(edition);
            const match = toc.find((s) => s.number === sectionNumber);
            if (match?.name) setSectionName(match.name);
          }
        } catch { /* non-critical — header will just show book name */ }
      }

      const data = await HadithService.getMergedSection(book, section);
      setHadiths(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, section.number, sectionName, sectionNumber]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
    load();
  }, [load]);

  const handleShare = useCallback((item: MergedHadith) => {
    Share.share({ message: buildHadithShareMessage(item, bookName, section.number) }).catch(() => {});
  }, [bookName, section.number]);

  const handleToggleSave = useCallback((item: MergedHadith) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isHadithSaved(bookId, item.hadithnumber)) {
      removeHadith(bookId, item.hadithnumber);
    } else {
      saveHadith({
        book: bookId,
        bookName,
        hadithNumber: item.hadithnumber,
        arabic: item.arabic,
        english: item.english,
        urdu: item.urdu,
        grade: item.grades?.[0]?.grade,
        refBook: item.reference?.book ?? section.number,
        refHadith: item.reference?.hadith ?? item.hadithnumber,
      });
    }
  }, [bookId, bookName, section.number, isHadithSaved, saveHadith, removeHadith]);

  const renderItem = useCallback(({ item }: { item: MergedHadith }) => {
    const showUrdu = translation === 'urdu' && !!item.urdu;
    const translationText = showUrdu ? item.urdu : item.english;
    const saved = isHadithSaved(bookId, item.hadithnumber);

    return (
      <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={styles.cardTop}>
          <View style={[styles.numPill, { backgroundColor: theme.primaryMuted + '18' }]}>
            <Ionicons name="bookmark" size={12} color={theme.primaryMuted} />
            <Text style={[styles.numPillText, { color: theme.primaryMuted }]}>Hadith {item.hadithnumber}</Text>
          </View>
          {item.grades?.length > 0 && (
            <View style={styles.gradesRow}>
              {item.grades.slice(0, 2).map((g, i) => (
                <View key={i} style={[styles.gradeChip, { backgroundColor: theme.surfaceMuted }]}>
                  <Text style={[styles.gradeText, { color: theme.textSecondary }]} numberOfLines={1}>{g.grade}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {!!item.arabic && (
          <Text style={[styles.arabic, { color: theme.text, fontSize: arabicSize, lineHeight: arabicLine }]}>
            {item.arabic}
          </Text>
        )}

        {!!translationText && (
          <>
            {!!item.arabic && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            <Text
              style={[
                styles.translation,
                showUrdu
                  ? { color: theme.textSecondary, fontSize: sizes.urdu, lineHeight: sizes.urduLine, textAlign: 'right', writingDirection: 'rtl', fontFamily: 'JameelNooriNastaleeq' }
                  : { color: theme.textSecondary, fontSize: sizes.english, lineHeight: sizes.englishLine },
              ]}
            >
              {translationText}
            </Text>
          </>
        )}

        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.reference, { color: theme.textTertiary }]} numberOfLines={1}>
            {bookName} • Book {item.reference?.book ?? section.number}, Hadith {item.reference?.hadith ?? item.hadithnumber}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => handleToggleSave(item)}
              style={[styles.actionBtn, { backgroundColor: saved ? theme.primaryMuted + '18' : theme.surfaceMuted }]}
              activeOpacity={0.7}
              accessibilityLabel={saved ? 'Remove from saved' : 'Save hadith'}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? theme.primaryMuted : theme.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleShare(item)}
              style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
              activeOpacity={0.7}
              accessibilityLabel="Share hadith"
            >
              <Ionicons name="share-outline" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [theme, sizes, translation, arabicSize, arabicLine, bookName, section.number, bookId, isHadithSaved, handleShare, handleToggleSave]);

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
          <Text style={styles.headerTitle} numberOfLines={2}>{sectionName || bookName}</Text>
          {!!sectionName && (
            <Text style={styles.headerSub} numberOfLines={1}>{bookName}</Text>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Translation toggle (Arabic is always shown above the translation) */}
      {!loading && !error && hadiths.length > 0 && (
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: theme.textTertiary }]}>Translation</Text>
          <View style={[styles.segment, { backgroundColor: theme.surfaceMuted }]}>
            {hasUrdu && (
              <TouchableOpacity
                onPress={() => setTranslation('urdu')}
                activeOpacity={0.85}
                style={[styles.segmentBtn, translation === 'urdu' && { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.segmentText, { color: translation === 'urdu' ? '#fff' : theme.textSecondary }]}>Urdu</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setTranslation('english')}
              activeOpacity={0.85}
              style={[styles.segmentBtn, translation === 'english' && { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.segmentText, { color: translation === 'english' ? '#fff' : theme.textSecondary }]}>English</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );

  // Single FlatList return — prevents header unmount/remount that kills animation on web.
  const emptyBody = loading ? (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.primaryMuted} />
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>Loading ahadees…</Text>
    </View>
  ) : error ? (
    <View style={styles.center}>
      <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={theme.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn't load ahadees</Text>
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>Check your connection and try again.</Text>
      <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: theme.primary }]} activeOpacity={0.85}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.center}>
      <Text style={[styles.centerText, { color: theme.textSecondary }]}>No ahadees found in this chapter.</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={(!loading && !error) ? hadiths : []}
        keyExtractor={(item) => String(item.hadithnumber)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
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

  /* Translation toggle */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 2,
  },
  toggleLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2 },
  segmentBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 9 },
  segmentText: { fontSize: 13, fontWeight: '700' },

  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, paddingTop: 80 },
  centerText: { fontSize: 14, textAlign: 'center' },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  card: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  numPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  numPillText: { fontSize: 12, fontWeight: '700' },
  gradesRow: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  gradeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: 130 },
  gradeText: { fontSize: 11, fontWeight: '600' },

  arabic: { fontWeight: '500', textAlign: 'right', writingDirection: 'rtl', fontFamily: 'AlQalamQuran' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  translation: { fontWeight: '400' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reference: { fontSize: 11, fontWeight: '500', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
