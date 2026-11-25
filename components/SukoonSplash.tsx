/**
 * SukoonSplash — the brand moment between the native splash and the app.
 *
 * The native splash (app.json → expo-splash-screen) draws the same heart mark,
 * at the same size, centred on the same forest green. This overlay starts from
 * that exact frame, so the handoff is invisible. Then:
 *
 *   1. the heart beats once ("lub-dub") and a soft ring pulses out from it,
 *   2. the mark rises as the wordmark and tagline settle in beneath it,
 *   3. the overlay fades (with a slight lift) to reveal the app.
 *
 * ~1.6 s total. With Reduce Motion on, it simply holds and fades.
 */

import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

/** Must match expo-splash-screen `backgroundColor` in app.json (the logo's own green). */
const BACKGROUND = '#1F3621';
/** Must match expo-splash-screen `imageWidth` in app.json. */
const MARK_SIZE = 150;
/** The heart's cream, sampled from the logo. */
const CREAM = '#EFD7B3';
const GAP = 26;
const WORDMARK_LINE = 20;
const TAGLINE_GAP = 10;
const TAGLINE_LINE = 18;
const TRACKING = 6;
/** Distance that puts the mark at the exact screen centre while the text is hidden. */
const CENTER_OFFSET = (GAP + WORDMARK_LINE + TAGLINE_GAP + TAGLINE_LINE) / 2;

const MARK = require('@/assets/images/splash-icon.png');
const useNativeDriver = Platform.OS !== 'web';
const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

interface SukoonSplashProps {
  onFinish: () => void;
}

export default function SukoonSplash({ onFinish }: SukoonSplashProps) {
  const markY = useRef(new Animated.Value(CENTER_OFFSET)).current;
  const beat = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(8)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY = useRef(new Animated.Value(6)).current;
  const lift = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;

    const timing = (value: Animated.Value, toValue: number, duration: number, easing = easeOut) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver });

    const fadeOut = Animated.parallel([
      timing(screenOpacity, 0, 300, Easing.inOut(Easing.quad)),
      timing(lift, 1.03, 300, Easing.out(Easing.quad)),
    ]);

    // One calm heartbeat: a fuller "lub", a lighter "dub".
    const heartbeat = Animated.sequence([
      timing(beat, 1.06, 120, Easing.out(Easing.quad)),
      timing(beat, 1, 130, Easing.inOut(Easing.quad)),
      Animated.delay(40),
      timing(beat, 1.03, 100, Easing.out(Easing.quad)),
      timing(beat, 1, 170, Easing.inOut(Easing.quad)),
    ]);

    const reveal = (delay: number, opacity: Animated.Value, y: Animated.Value) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          timing(opacity, 1, 420, Easing.out(Easing.quad)),
          timing(y, 0, 420),
        ]),
      ]);

    const run = (reduceMotion: boolean) => {
      if (cancelled) return;
      animation = reduceMotion
        ? Animated.sequence([Animated.delay(400), timing(screenOpacity, 0, 300, Easing.inOut(Easing.quad))])
        : Animated.sequence([
            Animated.parallel([
              heartbeat,
              timing(ring, 1, 900, Easing.out(Easing.cubic)),
              Animated.sequence([Animated.delay(400), timing(markY, 0, 600)]),
              reveal(500, wordOpacity, wordY),
              reveal(620, tagOpacity, tagY),
            ]),
            Animated.delay(320),
            fadeOut,
          ]);
      animation.start(({ finished }) => {
        if (finished) onFinishRef.current();
      });
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(run)
      .catch(() => run(false));

    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [markY, beat, ring, wordOpacity, wordY, tagOpacity, tagY, lift, screenOpacity]);

  // The ring starts on the mark's inscribed circle (the artwork never crosses
  // it) and drifts outward while fading, so it never overlaps the drawing.
  const ringStyle = {
    opacity: ring.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.4, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }],
  };

  return (
    <Animated.View
      style={[styles.container, { opacity: screenOpacity }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Sukoon"
    >
      <Animated.View style={[styles.lockup, { transform: [{ scale: lift }] }]}>
        <Animated.View style={{ transform: [{ translateY: markY }] }}>
          <Animated.View style={{ transform: [{ scale: beat }] }}>
            <Image source={MARK} style={styles.mark} fadeDuration={0} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        </Animated.View>
        <Animated.Text
          style={[styles.wordmark, { opacity: wordOpacity, transform: [{ translateY: wordY }] }]}
          allowFontScaling={false}
        >
          SUKOON
        </Animated.Text>
        <Animated.Text
          style={[styles.tagline, { opacity: tagOpacity, transform: [{ translateY: tagY }] }]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          Connecting hearts with Quranic guidance
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    alignItems: 'center',
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 1.5,
    borderColor: CREAM,
  },
  wordmark: {
    marginTop: GAP,
    // Letter spacing trails the last glyph; pad the start so the word sits optically centred.
    paddingLeft: TRACKING,
    fontSize: 16,
    lineHeight: WORDMARK_LINE,
    fontWeight: '600',
    letterSpacing: TRACKING,
    color: CREAM,
    includeFontPadding: false,
  },
  tagline: {
    marginTop: TAGLINE_GAP,
    fontSize: 13,
    lineHeight: TAGLINE_LINE,
    fontWeight: '400',
    letterSpacing: 0.3,
    color: 'rgba(239,215,179,0.62)',
    includeFontPadding: false,
  },
});
