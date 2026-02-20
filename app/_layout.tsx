/**
 * Root Layout - App entry with animated splash screen
 * Hides expo-splash-screen, runs SukoonSplash animation, then renders app
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { FontSizeProvider } from '@/contexts/FontSizeContext';
import { SavedVersesProvider } from '@/contexts/SavedVersesContext';
import SukoonSplash from '@/components/SukoonSplash';
import { QuranService } from '@/lib/quranService';
import { NotificationService } from '@/lib/notificationService';

// Prevent auto-hide so we control the transition
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutInner() {
  const { theme, mode } = useTheme();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const responseListener = useRef<Notifications.Subscription>();
  const appStateRef = useRef<AppStateStatus>('active');

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize Notification Service (channels, handlers, etc.)
        await NotificationService.init();

        // Register background task for daily rescheduling
        await NotificationService.registerBackgroundTask();

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

  // Set up notification response handler (when user taps notification)
  useEffect(() => {
    if (!appReady) return;

    responseListener.current = NotificationService.setupResponseHandler(router);

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [appReady, router]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    if (!appReady) return;

    const subscription = AppState.addEventListener('change', async (state) => {
      appStateRef.current = state;

      // When app comes to foreground, check if we need to reschedule
      if (state === 'active') {
        const prefs = await NotificationService.getPreferences();
        if (prefs.enabled) {
          const lastScheduled = await AsyncStorage.getItem('sukoon_notif_last_scheduled');
          const today = new Date().toDateString();
          if (lastScheduled !== today) {
            // New day! Notifications need rescheduling
            // They will be rescheduled when prayer times are next fetched
            console.log('[Sukoon] New day detected — notifications will reschedule on next prayer times fetch');
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appReady]);

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
