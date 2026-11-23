/**
 * SukoonSplash — the brand moment between the native splash and the app.
 *
 * The native splash (app.json → expo-splash-screen) draws the same gold mark,
 * at the same size, centred on the same emerald. This overlay starts from
 * that exact frame, so the handoff is invisible: the mark glides up, the
 * wordmark settles in beneath it, and the overlay fades to reveal the app.
 * ~1.3 s total; with Reduce Motion on, it simply holds and fades.
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

/** Must match expo-splash-screen `backgroundColor` in app.json. */
const BACKGROUND = '#0D3B2E';
/** Must match expo-splash-screen `imageWidth` in app.json. */
const MARK_SIZE = 120;
const GAP = 28;
const WORDMARK_LINE = 20;
const TRACKING = 6;
/** Distance that puts the mark at the exact screen centre while the wordmark is hidden. */
const CENTER_OFFSET = (GAP + WORDMARK_LINE) / 2;

const MARK = require('@/assets/images/splash-icon.png');
const useNativeDriver = Platform.OS !== 'web';
const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

interface SukoonSplashProps {
  onFinish: () => void;
}

export default function SukoonSplash({ onFinish }: SukoonSplashProps) {
  const markY = useRef(new Animated.Value(CENTER_OFFSET)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(8)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;

    const fadeOut = Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 300,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver,
    });

    const run = (reduceMotion: boolean) => {
      if (cancelled) return;
      animation = reduceMotion
        ? Animated.sequence([Animated.delay(400), fadeOut])
        : Animated.sequence([
            Animated.parallel([
              Animated.timing(markY, {
                toValue: 0,
                duration: 600,
                easing: easeOut,
                useNativeDriver,
              }),
              Animated.sequence([
                Animated.delay(150),
                Animated.parallel([
                  Animated.timing(wordOpacity, {
                    toValue: 1,
                    duration: 450,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver,
                  }),
                  Animated.timing(wordY, {
                    toValue: 0,
                    duration: 450,
                    easing: easeOut,
                    useNativeDriver,
                  }),
                ]),
              ]),
            ]),
            Animated.delay(400),
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
  }, [markY, wordOpacity, wordY, screenOpacity]);

  return (
    <Animated.View
      style={[styles.container, { opacity: screenOpacity }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Sukoon"
    >
      <View style={styles.lockup}>
        <Animated.View style={{ transform: [{ translateY: markY }] }}>
          <Image source={MARK} style={styles.mark} fadeDuration={0} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.wordmark,
            { opacity: wordOpacity, transform: [{ translateY: wordY }] },
          ]}
          allowFontScaling={false}
        >
          SUKOON
        </Animated.Text>
      </View>
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
  wordmark: {
    marginTop: GAP,
    // Letter spacing trails the last glyph; pad the start so the word sits optically centred.
    paddingLeft: TRACKING,
    fontSize: 16,
    lineHeight: WORDMARK_LINE,
    fontWeight: '500',
    letterSpacing: TRACKING,
    color: '#F3EDE0',
    includeFontPadding: false,
  },
});
