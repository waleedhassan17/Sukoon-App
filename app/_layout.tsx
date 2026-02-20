/**
 * Root Layout - App entry with animated splash screen
 * Hides expo-splash-screen, runs SukoonSplash animation, then renders app
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { FontSizeProvider } from '@/contexts/FontSizeContext';
import { SavedVersesProvider } from '@/contexts/SavedVersesContext';
import SukoonSplash from '@/components/SukoonSplash';
import { QuranService } from '@/lib/quranService';

// Prevent auto-hide so we control the transition
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutInner() {
  const { theme, mode } = useTheme();
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize QuranService cache from AsyncStorage (non-blocking read)
        await QuranService.initializeCache();
        
        // Prefetch Quran surahs list in background for instant first interaction
        // This is fire-and-forget, doesn't block app startup
        QuranService.prefetch();
      } catch (e) {
        console.warn('App preparation error:', e);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  // Once app is ready, hide the native expo splash screen
  // and let our custom animated splash take over
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady]);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
  }, []);

  // Don't render anything until app is ready
  if (!appReady) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Main app navigation */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="emotion-result"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="quran/[surah]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen name="tools/tasbeeh" options={{ headerShown: false }} />
        <Stack.Screen name="tools/qiblah" options={{ headerShown: false }} />
        <Stack.Screen name="tools/prayer" options={{ headerShown: false }} />
        <Stack.Screen name="tools/dashboard" options={{ headerShown: false }} />
      </Stack>

      {/* Custom animated splash overlay — renders on top, self-removes */}
      {!splashDone && <SukoonSplash onFinish={handleSplashFinish} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <FontSizeProvider>
        <SavedVersesProvider>
          <RootLayoutInner />
        </SavedVersesProvider>
      </FontSizeProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
