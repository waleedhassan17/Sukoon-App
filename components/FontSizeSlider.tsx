/**
 * FontSizeSlider - Brightness-style slider for font scale
 * Custom PanResponder-based slider with tactile haptic feedback
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Palette matching Sukoon design system
const P = {
  primary: '#1B4332',
  primaryLight: '#2D6A4F',
  primaryMuted: '#40916C',
  surfaceMuted: '#F5F1EB',
  text: '#1A1A1A',
  textSec: '#6B6B6B',
  textTer: '#9B9B9B',
  border: 'rgba(0,0,0,0.06)',
  shadow: 'rgba(27,67,50,0.08)',
};

interface FontSizeSliderProps {
  value: number;
  onValueChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function FontSizeSlider({
  value,
  onValueChange,
  min = 0.7,
  max = 1.5,
  step = 0.1,
}: FontSizeSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [trackLayout, setTrackLayout] = useState({ x: 0, width: 0 });
  const [localValue, setLocalValue] = useState(value);

  const thumbScale = useRef(new Animated.Value(1)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const lastSnappedValue = useRef(value);

  // Sync external value changes
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
      lastSnappedValue.current = value;
    }
  }, [value, isDragging]);

  const trackRef = useRef<View>(null);

  const calculateValue = useCallback((pageX: number): number => {
    const relativeX = pageX - trackLayout.x;
    const ratio = Math.max(0, Math.min(1, relativeX / trackLayout.width));
    const rawValue = min + ratio * (max - min);
    // Snap to nearest step
    const snapped = Math.round(rawValue / step) * step;
    // Round to avoid floating point issues
    return Math.round(Math.max(min, Math.min(max, snapped)) * 10) / 10;
  }, [trackLayout, min, max, step]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        // Scale up thumb
        Animated.spring(thumbScale, {
          toValue: 1.15,
          tension: 200,
          friction: 10,
          useNativeDriver: true,
        }).start();
        // Show tooltip
        Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();

        // Calculate initial value from touch
        const newValue = calculateValue(evt.nativeEvent.pageX);
        setLocalValue(newValue);
        if (newValue !== lastSnappedValue.current) {
          lastSnappedValue.current = newValue;
          Haptics.selectionAsync().catch(() => {});
        }
      },
      onPanResponderMove: (evt) => {
        const newValue = calculateValue(evt.nativeEvent.pageX);
        setLocalValue(newValue);
        if (newValue !== lastSnappedValue.current) {
          lastSnappedValue.current = newValue;
          Haptics.selectionAsync().catch(() => {});
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        // Scale thumb back
        Animated.spring(thumbScale, {
          toValue: 1,
          tension: 200,
          friction: 10,
          useNativeDriver: true,
        }).start();
        // Hide tooltip
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
        // Commit final value
        onValueChange(localValue);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.spring(thumbScale, {
          toValue: 1,
          tension: 200,
          friction: 10,
          useNativeDriver: true,
        }).start();
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    trackRef.current?.measureInWindow((x, y, width, height) => {
      setTrackLayout({ x, width });
    });
  };

  // Calculate fill percentage
  const displayValue = isDragging ? localValue : value;
  const fillPercentage = ((displayValue - min) / (max - min)) * 100;

  // Generate tick marks
  const tickCount = Math.round((max - min) / step) + 1;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const tickValue = Math.round((min + i * step) * 10) / 10;
    const percentage = ((tickValue - min) / (max - min)) * 100;
    const isDefault = Math.abs(tickValue - 1.0) < 0.01;
    return { tickValue, percentage, isDefault };
  });

  return (
    <View style={styles.container}>
      {/* Left icon: small A */}
      <Text style={styles.iconSmall}>A</Text>

      {/* Slider track area */}
      <View
        ref={trackRef}
        style={styles.trackArea}
        onLayout={handleTrackLayout}
        {...panResponder.panHandlers}
      >
        {/* Background track */}
        <View style={styles.trackBg} />

        {/* Fill track */}
        <LinearGradient
          colors={['#2D6A4F', '#40916C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.trackFill, { width: `${fillPercentage}%` }]}
        />

        {/* Tick marks */}
        <View style={styles.ticksContainer}>
          {ticks.map(({ tickValue, percentage, isDefault }) => (
            <View
              key={tickValue}
              style={[
                styles.tick,
                { left: `${percentage}%` },
                isDefault && styles.tickDefault,
              ]}
            />
          ))}
        </View>

        {/* Thumb */}
        <Animated.View
          style={[
            styles.thumb,
            {
              left: `${fillPercentage}%`,
              transform: [{ scale: thumbScale }],
            },
          ]}
        >
          {/* Tooltip */}
          <Animated.View style={[styles.tooltip, { opacity: tooltipOpacity }]}>
            <View style={styles.tooltipPill}>
              <Text style={styles.tooltipText}>{Math.round(displayValue * 100)}%</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Right icon: large A */}
      <Text style={styles.iconLarge}>A</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  iconSmall: {
    width: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: P.textTer,
  },
  iconLarge: {
    width: 24,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: P.textTer,
  },
  trackArea: {
    flex: 1,
    marginHorizontal: 14,
    height: 48,
    justifyContent: 'center',
  },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.surfaceMuted,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 8,
    borderRadius: 4,
  },
  ticksContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 28,
    height: 10,
  },
  tick: {
    position: 'absolute',
    width: 1,
    height: 4,
    backgroundColor: P.border,
    marginLeft: -0.5,
  },
  tickDefault: {
    height: 6,
    backgroundColor: P.textTer,
  },
  thumb: {
    position: 'absolute',
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: P.primaryLight,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    marginLeft: -14,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(27,67,50,0.25)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tooltip: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
    left: -14,
  },
  tooltipPill: {
    backgroundColor: P.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  tooltipArrow: {
    width: 6,
    height: 6,
    backgroundColor: P.primary,
    transform: [{ rotate: '45deg' }],
    marginTop: -3,
  },
});
