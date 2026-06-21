/**
 * LibraryScreen — the "Quran" tab landing.
 *
 * Instead of jumping straight into the Surah list, the tab now offers two
 * choices (islam360-style): the Holy Quran and the Ahadees collections.
 *   • Quran card   → /quran/surahs   (the full Surah / Parah browser)
 *   • Ahadees card → /quran/hadith   (Hadith book collections)
 *
 * Design is kept consistent with the rest of the app: the same gradient header
 * with decorative circles, theme tokens, and card treatment used elsewhere.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';

interface LibraryCard {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const CARDS: LibraryCard[] = [
  {
    key: 'quran',
    title: 'Holy Quran',
    subtitle: '114 Surahs — read, listen & reflect',
    icon: 'book',
    route: '/quran/surahs',
  },
  {
    key: 'hadith',
    title: 'Ahadees',
    subtitle: 'Authentic Hadith collections',
    icon: 'reader',
    route: '/quran/hadith',
  },
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
                <Ionicons
                  name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color="rgba(255,255,255,0.85)"
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ═══════════════ CHOICE CARDS ═══════════════ */}
        <View style={styles.cardsWrap}>
          {CARDS.map((card) => (
            <TouchableOpacity
              key={card.key}
              activeOpacity={0.85}
              onPress={() => router.push(card.route as any)}
              accessibilityRole="button"
              accessibilityLabel={card.title}
              style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <LinearGradient colors={theme.headerGradient} style={styles.cardIcon}>
                <Ionicons name={card.icon} size={26} color="#fff" />
              </LinearGradient>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{card.title}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{card.subtitle}</Text>
              </View>
              <View style={[styles.cardArrow, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 28,
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerIconRow: {
    marginBottom: 14,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
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

  /* ─── Cards ─── */
  cardsWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: { elevation: 3 },
    }),
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardArrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
