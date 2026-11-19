/**
 * CounterRing — the big tap target of the Tasbeeh screen.
 *
 * A gradient disc with a real SVG progress arc (the old "ring" faked it with four
 * border colours and a rotate, so it jumped in quarters), the count in the
 * middle and "of 33" beneath. Pressing it springs down and back; completing a
 * round gives the whole disc a brief gold pulse. All motion runs on the native
 * driver, so rapid tapping never stutters.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { SHADOWS } from '@/constants/theme';
import { roundProgress } from '@/lib/dhikr';

const STROKE = 9;
const GOLD = '#F6E27A';

export default function CounterRing({
  size,
  count,
  target,
  ofLabel,
  completions,
  onTap,
  accessibilityLabel,
  accessibilityHint,
}: {
  size: number;
  count: number;
  target: number;
  /** e.g. "of 33". */
  ofLabel: string;
  /** Increments each time a round completes — triggers the pulse. */
  completions: number;
  onTap: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
}) {
  const { theme } = useTheme();
  const press = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const seen = useRef(completions);

  // Gold pulse each time a round completes.
  useEffect(() => {
    if (completions === seen.current) return;
    seen.current = completions;
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [completions, pulse]);

  const c = size / 2;
  const r = c - STROKE - 8;
  const circumference = 2 * Math.PI * r;
  const progress = roundProgress(count, target);

  const scale = Animated.multiply(
    press,
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
  );

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
      <Pressable
        onPress={onTap}
        onPressIn={() => Animated.spring(press, { toValue: 0.96, useNativeDriver: true, speed: 60, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start()}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[{ width: size, height: size, borderRadius: c }, SHADOWS.lg]}
      >
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.disc, { width: size, height: size, borderRadius: c }]}
        >
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            {/* Track */}
            <Circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,0.16)" strokeWidth={STROKE} fill="none" />
            {/* Progress — starts at 12 o'clock and fills clockwise */}
            {progress > 0 && (
              <Circle
                cx={c}
                cy={c}
                r={r}
                stroke={GOLD}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - progress)}
                rotation={-90}
                origin={`${c}, ${c}`}
              />
            )}
          </Svg>

          <View style={s.center} pointerEvents="none">
            <Text style={[s.count, { fontSize: Math.round(size * 0.27) }]} accessibilityLiveRegion="none">
              {count}
            </Text>
            <Text style={s.of}>{ofLabel}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { alignItems: 'center' },
  count: { color: '#FFFFFF', fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  of: { marginTop: 2, fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
});
