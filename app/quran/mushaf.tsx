/**
 * MushafScreen — 15-line & 16-line Quran readers (Arabic only), served from the
 * BUNDLED layout JSON (assets/mushaf/*.json, built from the QUL databases).
 * Route: /quran/mushaf?lines=15|16&startPage=<n>&juz=<n>
 *
 * Each Quran page fills the FULL screen and is framed by a proper ornamental
 * border (like a printed Mushaf). The list is paged so exactly ONE page shows at
 * a time. Lines use one uniform font size (the Holy Quran reader's size) with
 * normal word spacing, distributed over the full page height.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/contexts/FontSizeContext';
import { QuranService, SurahMeta } from '@/lib/quranService';
import {
  getLayout,
  getPageRows,
  buildPageSurahMap,
  juzForPage,
  isAyahNumber,
  MushafLayout,
  MushafRow,
} from '@/lib/mushafService';

const { width: SW, height: SH } = Dimensions.get('window');
const BISMILLAH = 'بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِیۡمِ';

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/** Add the "سورة" prefix only when the name doesn't already include it. */
function surahTitle(name: string | undefined, num: number): string {
  if (!name) return `سُورَة ${num}`;
  const bare = name.replace(/[ً-ْٰٓ-ٕـ]/g, '');
  return bare.includes('سور') ? name : `سُورَةُ ${name}`;
}

/** Render one line's tokens (words + ﴿N﴾ markers) inside a single Text. */
function lineChildren(w: string, markerColor: string) {
  const tokens = w.split(' ').filter(Boolean);
  return tokens.map((tok, i) =>
    isAyahNumber(tok) ? (
      <Text key={i} style={{ color: markerColor }}>{` ﴿${tok}﴾ `}</Text>
    ) : (
      <Text key={i}>{(i > 0 ? ' ' : '') + tok}</Text>
    )
  );
}

export default function MushafScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { sizes } = useFontSize();
  const router = useRouter();
  const params = useLocalSearchParams();

  const linesPerPage = one(params.lines) === '16' ? 16 : 15;
  const layout: MushafLayout = useMemo(() => getLayout(linesPerPage), [linesPerPage]);
  const startPage = Math.min(Math.max(1, Number(one(params.startPage)) || 1), layout.totalPages);
  const juzLabel = one(params.juz);
  const title = `${linesPerPage} Lines Quran`;

  const [surahMap, setSurahMap] = useState<Map<number, SurahMeta>>(new Map());
  const pageSurahMap = useMemo(() => buildPageSurahMap(layout), [layout]);
  const mountedRef = useRef(true);

  // The page height = the measured height of the list viewport, so exactly one
  // page fills the screen (paging snaps to it). Estimate until measured.
  const [pageHeight, setPageHeight] = useState(SH - insets.top - 64 - insets.bottom);

  // Exactly the Holy Quran reader's default Arabic size — same for both readers.
  const fs = sizes.arabic;

  const pageNumbers = useMemo(() => {
    const arr: number[] = [];
    for (let p = startPage; p <= layout.totalPages; p++) arr.push(p);
    return arr;
  }, [startPage, layout.totalPages]);

  useEffect(() => {
    mountedRef.current = true;
    QuranService.getAllSurahs()
      .then((list) => { if (mountedRef.current) setSurahMap(new Map(list.map((s) => [s.number, s]))); })
      .catch(() => {});
    return () => { mountedRef.current = false; };
  }, []);

  /* ── One line (banner / bismillah / ayah), full width ── */
  const renderRow = useCallback((row: MushafRow, key: string) => {
    if (row.t === 's') {
      const meta = surahMap.get(row.n || 0);
      return (
        <View key={key} style={styles.bannerWrap}>
          <LinearGradient colors={theme.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, { borderColor: theme.gold + '66' }]}>
            <View style={[styles.bannerOrn, { backgroundColor: theme.gold + '88' }]} />
            <Text style={styles.bannerArabic} numberOfLines={1}>{surahTitle(meta?.name, row.n || 0)}</Text>
            <View style={[styles.bannerOrn, { backgroundColor: theme.gold + '88' }]} />
          </LinearGradient>
        </View>
      );
    }
    if (row.t === 'b') {
      return (
        <View key={key} style={styles.lineWrap}>
          <Text style={[styles.bismillah, { color: theme.primary, fontSize: fs * 1.05 }]} numberOfLines={1} adjustsFontSizeToFit>
            {BISMILLAH}
          </Text>
        </View>
      );
    }
    return (
      <View key={key} style={styles.lineWrap}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.4}
          style={[styles.lineText, { fontSize: fs, color: theme.arabicText }]}
        >
          {lineChildren(row.w || '', theme.primaryMuted)}
        </Text>
      </View>
    );
  }, [surahMap, theme, fs]);

  const renderPage = useCallback(({ item: pageNumber }: { item: number }) => {
    const rows = getPageRows(layout, pageNumber);
    const surahName = surahMap.get(pageSurahMap[pageNumber])?.englishName || '';
    const juz = juzForPage(layout, pageNumber);
    const isShort = rows.length < linesPerPage;

    // ── Ornate opening pages: Al-Fatiha (1) & Al-Baqarah (2) ──
    if (pageNumber <= 2) {
      const sNum = rows.find((r) => r.t === 's')?.n || pageSurahMap[pageNumber];
      const meta = surahMap.get(sNum);
      const contentRows = rows.filter((r) => r.t !== 's');
      return (
        <View style={[styles.page, { height: pageHeight }]}>
          <View style={[styles.pageBorder, styles.openBorder, { borderColor: theme.gold, backgroundColor: theme.surfaceElevated }]}>
            <View style={[styles.pageBorderInner, { borderColor: theme.gold + '66' }]}>
              <Corners gold={theme.gold} />
              <LinearGradient colors={theme.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.openCrown, { borderColor: theme.gold + '88' }]}>
                <Text style={[styles.openCrownDeco, { color: theme.gold }]}>۞</Text>
                <Text style={styles.openCrownArabic} numberOfLines={1}>{surahTitle(meta?.name, sNum)}</Text>
                {!!meta?.englishName && (
                  <Text style={styles.openCrownSub} numberOfLines={1}>{meta.englishName} · {meta.numberOfAyahs} Ayahs · {meta.revelationType}</Text>
                )}
                <Text style={[styles.openCrownDeco, { color: theme.gold }]}>۞</Text>
              </LinearGradient>
              <Ornament gold={theme.gold} />
              <View style={styles.openBody}>
                {contentRows.map((r, idx) => renderRow(r, `${pageNumber}-${idx}`))}
              </View>
              <Ornament gold={theme.gold} />
              <Text style={[styles.pageNum, { color: theme.primaryMuted }]}>{pageNumber} / {layout.totalPages}</Text>
            </View>
          </View>
        </View>
      );
    }

    // ── Standard full page with ornamental border ──
    return (
      <View style={[styles.page, { height: pageHeight }]}>
        <View style={styles.topLabels}>
          <Text style={[styles.labelText, { color: theme.textSecondary }]} numberOfLines={1}>{surahName}</Text>
          <Text style={[styles.labelText, { color: theme.textSecondary }]}>Para {juz}</Text>
        </View>
        <View style={[styles.pageBorder, { borderColor: theme.gold, backgroundColor: theme.surfaceElevated }]}>
          <View style={[styles.pageBorderInner, { borderColor: theme.gold + '55' }]}>
            <Corners gold={theme.gold} />
            <View style={[styles.body, isShort ? styles.bodyCentered : styles.bodyFill]}>
              {rows.map((r, idx) => renderRow(r, `${pageNumber}-${idx}`))}
            </View>
          </View>
        </View>
        <Text style={[styles.pageNum, { color: theme.textTertiary }]}>{pageNumber} / {layout.totalPages}</Text>
      </View>
    );
  }, [layout, surahMap, pageSurahMap, theme, pageHeight, linesPerPage, renderRow]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: pageHeight, offset: pageHeight * index, index,
  }), [pageHeight]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* ═══════════════ HEADER ═══════════════ */}
      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.7} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {juzLabel ? `Para ${juzLabel} · ` : ''}{layout.totalPages} pages · Arabic
            </Text>
          </View>
          <View style={styles.iconBtn}>
            <Ionicons name="book-outline" size={18} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      {/* ═══════════════ PAGES (one full page per screen) ═══════════════ */}
      <View
        style={{ flex: 1, paddingBottom: insets.bottom }}
        onLayout={(e) => {
          // Subtract the bottom inset so the page (and its border) stays above
          // the Android nav bar — otherwise the bottom border is clipped.
          const h = Math.round(e.nativeEvent.layout.height - insets.bottom);
          if (h > 0 && h !== pageHeight) setPageHeight(h);
        }}
      >
        <FlatList
          data={pageNumbers}
          keyExtractor={(p) => `pg-${p}`}
          renderItem={renderPage}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          decelerationRate="fast"
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={false}
        />
      </View>
    </View>
  );
}

/* Decorative L-shaped corner motifs for a page border. */
function Corners({ gold }: { gold: string }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.corner, styles.cTL, { borderColor: gold }]} />
      <View pointerEvents="none" style={[styles.corner, styles.cTR, { borderColor: gold }]} />
      <View pointerEvents="none" style={[styles.corner, styles.cBL, { borderColor: gold }]} />
      <View pointerEvents="none" style={[styles.corner, styles.cBR, { borderColor: gold }]} />
    </>
  );
}

/* Gold flourish (line · diamond · line). */
function Ornament({ gold }: { gold: string }) {
  return (
    <View style={styles.orn}>
      <View style={[styles.ornLine, { backgroundColor: gold + '33' }]} />
      <View style={[styles.ornDm, { backgroundColor: gold + '66' }]} />
      <View style={[styles.ornLine, { backgroundColor: gold + '33' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  /* Full page */
  page: { width: SW, paddingHorizontal: 10, paddingVertical: 8 },
  topLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 6, paddingBottom: 6 },
  labelText: { fontSize: 12, fontWeight: '700', fontFamily: 'AlQalamQuran' },
  pageNum: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'center', paddingTop: 6 },

  /* Ornamental page border */
  pageBorder: { flex: 1, borderWidth: 2.5, borderRadius: 10, padding: 4 },
  pageBorderInner: { flex: 1, borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  corner: { position: 'absolute', width: 18, height: 18 },
  cTL: { top: 2, left: 2, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 8 },
  cTR: { top: 2, right: 2, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 8 },
  cBL: { bottom: 2, left: 2, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 8 },
  cBR: { bottom: 2, right: 2, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 8 },

  /* Body line distribution */
  body: { flex: 1 },
  bodyFill: { justifyContent: 'space-between' },
  bodyCentered: { justifyContent: 'center', gap: 6 },
  lineWrap: { justifyContent: 'center', flexShrink: 1 },
  lineText: { fontFamily: 'AlQalamQuran', fontWeight: '500', writingDirection: 'rtl', textAlign: 'center' },
  bismillah: { fontFamily: 'AlQalamQuran', fontWeight: '500', textAlign: 'center', writingDirection: 'rtl' },

  /* Surah banner */
  bannerWrap: { justifyContent: 'center', alignItems: 'center', paddingVertical: 2 },
  banner: { width: '86%', borderRadius: 12, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 16, alignItems: 'center', gap: 3 },
  bannerOrn: { width: 34, height: 2, borderRadius: 1 },
  bannerArabic: { fontFamily: 'AlQalamQuran', fontSize: 20, color: '#fff', fontWeight: '600', writingDirection: 'rtl', textAlign: 'center' },

  /* Opening pages */
  openBorder: { borderWidth: 4 },
  openBody: { flex: 1, justifyContent: 'center' },
  openCrown: { marginTop: 4, marginBottom: 6, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', gap: 3 },
  openCrownDeco: { fontSize: 16, lineHeight: 20, opacity: 0.85 },
  openCrownArabic: { fontFamily: 'AlQalamQuran', fontSize: 28, color: '#fff', fontWeight: '700', writingDirection: 'rtl', textAlign: 'center' },
  openCrownSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500', letterSpacing: 0.3 },

  /* Ornament flourish */
  orn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  ornLine: { width: 56, height: 1.5, borderRadius: 1 },
  ornDm: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },
});
