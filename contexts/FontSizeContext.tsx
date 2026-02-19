/**
 * FontSizeContext - Global font scale management
 * Controls text sizes across all reading screens
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sukoon_font_scale';
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.5;
const DEFAULT_SCALE = 1.0;

interface FontSizes {
  arabic: number;       // Base 24
  arabicLarge: number;  // Base 28 (Bismillah)
  arabicLine: number;   // Base 48
  english: number;      // Base 14
  englishLine: number;  // Base 22
  urdu: number;         // Base 16
  urduLine: number;     // Base 28
}

interface FontSizeContextType {
  fontScale: number;
  setFontScale: (v: number) => void;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
  sizes: FontSizes;
}

const FontSizeContext = createContext<FontSizeContextType>({
  fontScale: DEFAULT_SCALE,
  setFontScale: () => {},
  increase: () => {},
  decrease: () => {},
  reset: () => {},
  sizes: {
    arabic: 24,
    arabicLarge: 28,
    arabicLine: 48,
    english: 14,
    englishLine: 22,
    urdu: 16,
    urduLine: 28,
  },
});

function clampScale(value: number): number {
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
  return Math.round(clamped * 10) / 10;
}

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState<number>(DEFAULT_SCALE);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            setFontScaleState(clampScale(parsed));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Save to AsyncStorage whenever fontScale changes
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, String(fontScale)).catch(() => {});
  }, [fontScale]);

  const setFontScale = useCallback((value: number) => {
    setFontScaleState(clampScale(value));
  }, []);

  const increase = useCallback(() => {
    setFontScaleState((prev) => clampScale(prev + 0.1));
  }, []);

  const decrease = useCallback(() => {
    setFontScaleState((prev) => clampScale(prev - 0.1));
  }, []);

  const reset = useCallback(() => {
    setFontScaleState(DEFAULT_SCALE);
  }, []);

  const sizes = useMemo<FontSizes>(() => ({
    arabic: Math.round(24 * fontScale),
    arabicLarge: Math.round(28 * fontScale),
    arabicLine: Math.round(48 * fontScale),
    english: Math.round(14 * fontScale),
    englishLine: Math.round(22 * fontScale),
    urdu: Math.round(16 * fontScale),
    urduLine: Math.round(28 * fontScale),
  }), [fontScale]);

  const value = useMemo(() => ({
    fontScale,
    setFontScale,
    increase,
    decrease,
    reset,
    sizes,
  }), [fontScale, setFontScale, increase, decrease, reset, sizes]);

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
}

export const useFontSize = () => useContext(FontSizeContext);
