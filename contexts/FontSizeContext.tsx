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
  arabic: number;       // Base 28
  arabicLarge: number;  // Base 32 (Bismillah)
  arabicLine: number;   // Base 56
  english: number;      // Base 16
  englishLine: number;  // Base 26
  urdu: number;         // Base 18
  urduLine: number;     // Base 32
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
    arabic: 28,
    arabicLarge: 32,
    arabicLine: 56,
    english: 16,
    englishLine: 26,
    urdu: 18,
    urduLine: 32,
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
    arabic: Math.round(28 * fontScale),
    arabicLarge: Math.round(32 * fontScale),
    arabicLine: Math.round(56 * fontScale),
    english: Math.round(16 * fontScale),
    englishLine: Math.round(26 * fontScale),
    urdu: Math.round(18 * fontScale),
    urduLine: Math.round(32 * fontScale),
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
