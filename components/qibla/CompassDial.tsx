/**
 * CompassDial — the centrepiece of the Qibla screen.
 *
 * A calm, uncluttered dial: tick ring + N/E/S/W, a gold Kaaba marker sitting at
 * the Qibla bearing, a fixed pointer at the top (where the phone is facing) and
 * the live heading in the hub.
 *
 *  • The face is ONE static SVG (72 ticks + 4 letters) rotated by a native-driver
 *    transform — the old screen rotated 72 separate Views.
 *  • `dialAnim` is the rotation in degrees (= −heading) and is deliberately
 *    unbounded, so the dial always takes the short way round the 359°→1° seam.
 *  • The Kaaba badge counter-rotates so the icon always stays upright.
 *  • When the phone points at the Qibla, the marker meets the pointer and the
 *    ring turns gold.
 */

import React from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useTheme } from '@/contexts/ThemeContext';
import { SHADOWS } from '@/constants/theme';

const POINTER_H = 16;
const MARKER = 42;
/** Gap between the dial's edge and the tick ring. */
const FACE_INSET = 7;
const GOLD = '#D4AF37';

const DialFace = React.memo(function DialFace({
  size,
  major,
  minor,
  letter,
  north,
}: {
  size: number;
  major: string;
  minor: string;
  letter: string;
  north: string;
}) {
  const c = size / 2;
  const r = c - FACE_INSET;

  return (
    <Svg width={size} height={size}>
      {Array.from({ length: 72 }, (_, i) => {
        const deg = i * 5;
        const isCardinal = deg % 90 === 0;
        const isMid = deg % 45 === 0;
        const len = isCardinal ? 16 : isMid ? 12 : 6;
        const a = (deg * Math.PI) / 180;
        const sin = Math.sin(a);
        const cos = Math.cos(a);
        return (
          <Line
            key={i}
            x1={c + sin * r}
            y1={c - cos * r}
            x2={c + sin * (r - len)}
            y2={c - cos * (r - len)}
            stroke={isCardinal || isMid ? major : minor}
            strokeWidth={isCardinal ? 2.5 : isMid ? 1.8 : 1}
            strokeLinecap="round"
            opacity={isCardinal || isMid ? 0.9 : 0.4}
          />
        );
      })}
      {(
        [
          ['N', 0],
          ['E', 90],
          ['S', 180],
          ['W', 270],
        ] as const
      ).map(([label, deg]) => {
        const a = (deg * Math.PI) / 180;
        const rr = r - 54;
        return (
          <SvgText
            key={label}
            x={c + Math.sin(a) * rr}
            y={c - Math.cos(a) * rr + 6}
            fontSize={18}
            fontWeight="700"
            fill={label === 'N' ? north : letter}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
});

export default function CompassDial({
  size,
  dialAnim,
  qiblaBearing,
  aligned,
  headingText,
  directionText,
  accessibilityLabel,
}: {
  size: number;
  /** Rotation of the dial in degrees (−heading); unbounded. */
  dialAnim: Animated.Value;
  qiblaBearing: number;
  /** Phone is pointing at the Qibla. */
  aligned: boolean;
  /** Big number in the hub, e.g. "266°". */
  headingText: string;
  /** Small label under it, e.g. "W". */
  directionText: string;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();

  const dialRotate = dialAnim.interpolate({
    inputRange: [-36000, 36000],
    outputRange: ['-36000deg', '36000deg'],
  });
  // Net on-screen rotation of the badge = dial (dialAnim) + bearing → cancel it.
  const badgeRotate = dialAnim.interpolate({
    inputRange: [-36000, 36000],
    outputRange: [`${36000 - qiblaBearing}deg`, `${-36000 - qiblaBearing}deg`],
  });

  const c = size / 2;
  const hub = Math.round(size * 0.36);
  // The marker sits ON the tick ring; the letters live inside it, so they never collide.
  const markerCentre = c - FACE_INSET - 14; // radius of the marker's centre
  const markerTop = c - markerCentre - MARKER / 2;
  const needleTop = c - (markerCentre - MARKER / 2);
  const needleHeight = Math.max(8, markerCentre - MARKER / 2 - hub / 2 - 4);
  const accent = aligned ? GOLD : theme.primary;

  return (
    <View
      style={{ width: size, height: size + POINTER_H }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ marginTop: POINTER_H, width: size, height: size }}>
        {/* Bezel */}
        <View
          style={[
            s.bezel,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.surfaceElevated,
              borderColor: aligned ? GOLD : theme.border,
              borderWidth: aligned ? 3 : StyleSheet.hairlineWidth,
            },
            SHADOWS.lg,
          ]}
        />

        {/* Rotating layer: face + Qibla marker */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ rotate: dialRotate }] }]}
          pointerEvents="none"
        >
          {/* Needle — behind the face, so a letter always draws over it */}
          <View
            style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${qiblaBearing}deg` }] }]}
            pointerEvents="none"
          >
            <View style={[s.needle, { height: needleHeight, top: needleTop, left: c - 1.5 }]} />
          </View>

          <DialFace
            size={size}
            major={theme.textSecondary}
            minor={theme.textTertiary}
            letter={theme.textSecondary}
            north={theme.error}
          />

          {/* Kaaba marker — on top, kept upright while the dial turns */}
          <View
            style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${qiblaBearing}deg` }] }]}
            pointerEvents="none"
          >
            <Animated.View
              style={[
                s.marker,
                { top: markerTop, left: c - MARKER / 2, transform: [{ rotate: badgeRotate }, { scale: aligned ? 1.12 : 1 }] },
              ]}
            >
              <LinearGradient colors={['#E3C45A', '#B8941E']} style={s.markerFill}>
                <FontAwesome6 name="kaaba" size={19} color="#3D2E00" />
              </LinearGradient>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Hub — fixed, shows the live heading */}
        <View
          style={[
            s.hub,
            {
              width: hub,
              height: hub,
              borderRadius: hub / 2,
              left: (size - hub) / 2,
              top: (size - hub) / 2,
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[s.hubValue, { color: theme.text, fontSize: Math.round(hub * 0.34) }]} numberOfLines={1}>
            {headingText}
          </Text>
          <Text style={[s.hubLabel, { color: accent }]} numberOfLines={1}>
            {directionText}
          </Text>
        </View>
      </View>

      {/* Fixed pointer: where the phone is facing */}
      <View
        pointerEvents="none"
        style={[s.pointer, { left: size / 2 - 10, borderTopColor: accent }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bezel: { position: 'absolute' },
  needle: { position: 'absolute', width: 3, borderRadius: 2, backgroundColor: GOLD, opacity: 0.85 },
  marker: { position: 'absolute', width: MARKER, height: MARKER },
  markerFill: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  hub: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  hubValue: { fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  hubLabel: { fontSize: 14, fontWeight: '700', marginTop: 1, letterSpacing: 0.6 },
  pointer: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: POINTER_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
