/**
 * OthersScreen - More Islamic Tools
 * Premium, refined design matching HomeScreen aesthetic
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { RADIUS } from '@/constants/theme';

const { width } = Dimensions.get('window');

const TOOLS = [
  {
    key: 'salah-tracker',
    label: 'Salah Tracker',
    route: '/tools/salah-tracker',
    icon: 'checkmark-circle-outline' as const,
    gradient: ['#1B4332', '#0B3D2C'],
    desc: 'Track and log your daily prayers',
  },
  {
    key: 'tasbeeh',
    label: 'Tasbeeh Counter',
    route: '/tools/tasbeeh',
    icon: 'ellipse-outline' as const,
    gradient: ['#2D6A4F', '#1B4332'],
    desc: 'Digital dhikr counter with presets',
  },
  {
    key: 'qiblah',
    label: 'Qiblah Finder',
    route: '/tools/qiblah',
    icon: 'navigate-outline' as const,
    gradient: ['#40916C', '#2D6A4F'],
    desc: 'Find the direction of prayer',
  },
  {
    key: 'prayer',
    label: 'Prayer Times',
    route: '/tools/prayer',
    icon: 'time-outline' as const,
    gradient: ['#52B788', '#40916C'],
    desc: 'Accurate local prayer schedule',
  },
  {
    key: 'insights',
    label: 'Spiritual Progress',
    route: '/insights',
    icon: 'analytics-outline' as const,
    gradient: ['#74C69D', '#52B788'],
    desc: 'View your reading stats & achievements',
  },
];

/* ─── Staggered entry hook ─── */
function useStaggeredEntry(count: number, baseDelay = 80) {
  const opacities = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  const slides = useRef(Array.from({ length: count }, () => new Animated.Value(20))).current;

  useEffect(() => {
    const animations = opacities.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 450,
          delay: i * baseDelay + 150,
          useNativeDriver: true,
        }),
        Animated.timing(slides[i], {
          toValue: 0,
          duration: 450,
          delay: i * baseDelay + 150,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(0, animations).start();
  }, []);

  return opacities.map((opacity, i) => ({ opacity, transform: [{ translateY: slides[i] }] }));
}

export default function OthersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const router = useRouter();

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  // 4 tool cards + 1 banner = 5 items
  const itemAnims = useStaggeredEntry(TOOLS.length + 1, 90);

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
                  styles.headerPatternCircle,
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
                <Ionicons name="grid-outline" size={20} color="#fff" />
              </View>
            </View>
            <Text style={styles.headerTitle}>More Tools</Text>
            <Text style={styles.headerSub}>Enhance your spiritual journey</Text>
          </Animated.View>
        </LinearGradient>

        {/* ═══════════════ TOOLS LIST ═══════════════ */}
        <View style={styles.body}>
          {TOOLS.map((tool, index) => (
            <Animated.View key={tool.key} style={itemAnims[index]}>
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
                onPress={() => router.push(tool.route as any)}
                activeOpacity={0.75}
              >
                <LinearGradient
                  colors={tool.gradient as [string, string]}
                  style={styles.cardIconWrap}
                >
                  <Ionicons name={tool.icon} size={22} color="#fff" />
                </LinearGradient>

                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{tool.label}</Text>
                  <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{tool.desc}</Text>
                </View>

                <View style={[styles.cardArrow, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}

          {/* ═══════════════ DIVIDER ═══════════════ */}
          <View style={styles.divider}>
            <View style={[styles.dividerDot, { backgroundColor: theme.border }]} />
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <View style={[styles.dividerDot, { backgroundColor: theme.border }]} />
          </View>

          {/* ═══════════════ INSPIRATIONAL BANNER ═══════════════ */}
          <Animated.View style={itemAnims[TOOLS.length]}>
            <View style={styles.banner}>
              <LinearGradient
                colors={theme.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerGradient}
              >
                <View style={styles.bannerDecoTop}>
                  <Text style={[styles.bannerDecoChar, { color: theme.accent }]}>﷽</Text>
                </View>

                <Text style={styles.bannerTitle}>Sukoon</Text>

                <View style={styles.bannerDividerLine} />

                <Text style={styles.bannerSub}>
                  Your spiritual companion{'\n'}for peace and guidance
                </Text>

                <View style={styles.bannerFooter}>
                  <View style={styles.bannerPill}>
                    <Ionicons name="heart-outline" size={12} color={theme.accent} />
                    <Text style={styles.bannerPillText}>Made with Tawakkul</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* ─── Header ─── */
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
  headerPatternCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fff',
  },
  headerIconRow: {
    marginBottom: 16,
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
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    letterSpacing: 0.2,
  },

  /* ─── Body ─── */
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  /* ─── Tool Cards ─── */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
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
  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardArrow: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* ─── Divider ─── */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 8,
  },
  dividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  dividerLine: {
    width: 40,
    height: 1,
  },

  /* ─── Banner ─── */
  banner: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  bannerGradient: {
    padding: 32,
    alignItems: 'center',
  },
  bannerDecoTop: {
    marginBottom: 16,
    opacity: 0.4,
  },
  bannerDecoChar: {
    fontSize: 28,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  bannerDividerLine: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(212,163,115,0.35)',
    borderRadius: 1,
    marginBottom: 14,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 18,
  },
  bannerFooter: {
    alignItems: 'center',
  },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 6,
  },
  bannerPillText: {
    fontSize: 12,
    color: 'rgba(212,163,115,0.85)',
    fontWeight: '500',
  },
});