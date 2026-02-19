/**
 * SukoonSplash - Premium Animated Splash Screen
 * Emerald gradient with logo scale-up, Arabic reveal, ornaments, and fade transition
 * Duration: ~2.2s total
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: SW, height: SH } = Dimensions.get('window');

interface SukoonSplashProps {
  onFinish: () => void;
}

export default function SukoonSplash({ onFinish }: SukoonSplashProps) {
  /* ─── Animation values ─── */
  // Background
  const bgOpacity = useRef(new Animated.Value(1)).current;

  // Logo icon
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(-10)).current;

  // App name "Sukoon"
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameSlide = useRef(new Animated.Value(12)).current;

  // Arabic "سُكُون"
  const arabicOpacity = useRef(new Animated.Value(0)).current;
  const arabicSlide = useRef(new Animated.Value(10)).current;

  // Tagline
  const tagOpacity = useRef(new Animated.Value(0)).current;

  // Ornament lines
  const ornLeftWidth = useRef(new Animated.Value(0)).current;
  const ornRightWidth = useRef(new Animated.Value(0)).current;
  const ornDotScale = useRef(new Animated.Value(0)).current;

  // Decorative circles
  const circleScale = useRef(new Animated.Value(0.5)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;

  // Bismillah at top
  const bisOpacity = useRef(new Animated.Value(0)).current;

  // Final fade out
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      // ── Phase 1: Background circles + Bismillah fade in (0-300ms) ──
      Animated.parallel([
        Animated.timing(circleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(circleScale, {
          toValue: 1,
          tension: 30,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(bisOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      // ── Phase 2: Logo icon scale + fade + rotate (300-800ms) ──
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      // ── Phase 3: App name + ornament lines (800-1200ms) ──
      Animated.parallel([
        Animated.timing(nameOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(nameSlide, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        // Ornament lines expand outward
        Animated.timing(ornLeftWidth, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false, // width can't use native driver
        }),
        Animated.timing(ornRightWidth, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.spring(ornDotScale, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),

      // ── Phase 4: Arabic text + tagline (1200-1600ms) ──
      Animated.parallel([
        Animated.timing(arabicOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(arabicSlide, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(tagOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // ── Phase 5: Hold (1600-1900ms) ──
      Animated.delay(300),

      // ── Phase 6: Fade everything out (1900-2200ms) ──
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    animation.start(() => {
      onFinish();
    });

    return () => animation.stop();
  }, []);

  const rotateInterpolate = logoRotate.interpolate({
    inputRange: [-10, 0],
    outputRange: ['-10deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <LinearGradient
        colors={['#0F3626', '#1B4332', '#2D6A4F', '#1B4332']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* ─── Decorative background circles ─── */}
        <Animated.View
          style={[
            styles.bgCircles,
            {
              opacity: circleOpacity,
              transform: [{ scale: circleScale }],
            },
          ]}
        >
          {[...Array(6)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.bgCircle,
                {
                  width: 140 + i * 70,
                  height: 140 + i * 70,
                  opacity: 0.03 + i * 0.008,
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* ─── Corner decorations ─── */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {/* ─── Bismillah at top ─── */}
        <Animated.Text style={[styles.bismillah, { opacity: bisOpacity }]}>
          بِسۡمِ اللّٰهِ
        </Animated.Text>

        {/* ─── Center content ─── */}
        <View style={styles.center}>
          {/* Logo icon */}
          <Animated.View
            style={[
              styles.logoWrap,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: logoScale },
                  { rotate: rotateInterpolate },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
              style={styles.logoOuter}
            >
              <View style={styles.logoInner}>
                <Ionicons name="leaf" size={36} color="#fff" />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* App name */}
          <Animated.Text
            style={[
              styles.appName,
              {
                opacity: nameOpacity,
                transform: [{ translateY: nameSlide }],
              },
            ]}
          >
            Sukoon
          </Animated.Text>

          {/* Ornamental divider */}
          <View style={styles.ornamentRow}>
            <Animated.View
              style={[
                styles.ornamentLineL,
                { width: ornLeftWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 36] }) },
              ]}
            />
            <Animated.View
              style={[
                styles.ornamentDot,
                { transform: [{ scale: ornDotScale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.ornamentLineR,
                { width: ornRightWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 36] }) },
              ]}
            />
          </View>

          {/* Arabic name */}
          <Animated.Text
            style={[
              styles.arabicName,
              {
                opacity: arabicOpacity,
                transform: [{ translateY: arabicSlide }],
              },
            ]}
          >
            سُكُون
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
            Find peace through Quranic guidance
          </Animated.Text>
        </View>

        {/* ─── Bottom ornament ─── */}
        <Animated.View style={[styles.bottomOrnament, { opacity: tagOpacity }]}>
          <View style={styles.bottomLine} />
          <View style={styles.bottomDiamond} />
          <View style={styles.bottomLine} />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── Background circles ─── */
  bgCircles: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fff',
  },

  /* ─── Corners ─── */
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: 'rgba(212,163,115,0.2)',
  },
  cornerTL: {
    top: 60,
    left: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 60,
    right: 24,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 60,
    left: 24,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 60,
    right: 24,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomRightRadius: 8,
  },

  /* ─── Bismillah ─── */
  bismillah: {
    position: 'absolute',
    top: 100,
    fontSize: 18,
    color: 'rgba(212,163,115,0.35)',
  },

  /* ─── Center ─── */
  center: {
    alignItems: 'center',
  },

  /* Logo */
  logoWrap: {
    marginBottom: 24,
  },
  logoOuter: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* App name */
  appName: {
    fontSize: 38,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 14,
  },

  /* Ornament divider */
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  ornamentLineL: {
    height: 1.5,
    backgroundColor: 'rgba(212,163,115,0.4)',
  },
  ornamentLineR: {
    height: 1.5,
    backgroundColor: 'rgba(212,163,115,0.4)',
  },
  ornamentDot: {
    width: 7,
    height: 7,
    borderRadius: 1,
    backgroundColor: 'rgba(212,163,115,0.5)',
    transform: [{ rotate: '45deg' }],
  },

  /* Arabic name */
  arabicName: {
    fontSize: 30,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 16,
  },

  /* Tagline */
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },

  /* ─── Bottom ornament ─── */
  bottomOrnament: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomLine: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(212,163,115,0.25)',
  },
  bottomDiamond: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: 'rgba(212,163,115,0.3)',
    transform: [{ rotate: '45deg' }],
  },
});
