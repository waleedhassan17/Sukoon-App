/**
 * Root Layout - App entry with animated splash screen
 * Hides expo-splash-screen, runs SukoonSplash animation, then renders app
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, AppState, AppStateStatus, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { FontSizeProvider } from '@/contexts/FontSizeContext';
import { SavedVersesProvider } from '@/contexts/SavedVersesContext';
import SukoonSplash from '@/components/SukoonSplash';
import { QuranService } from '@/lib/quranService';
import { NotificationService } from '@/lib/notificationService';
import { NotificationHistory } from '@/app/notifications';
import { NotificationStorage } from '@/lib/notificationStorage';
import { AzanPlayer } from '@/lib/azanPlayer';
import { DataSyncService } from '@/lib/dataSyncService';
import { FCMService } from '@/lib/fcmService';
import { UserProfileService } from '@/lib/userProfileService';
import { BranchService } from '@/lib/branchService';
import { i18n } from '@/lib/i18n';

// Lazy-load expo-notifications — not available in Expo Go (SDK 53+)
let ExpoNotifications: any = null;
try {
  const mod = require('expo-notifications');
  // Verify the module is functional (Expo Go may import but throw on use)
  if (mod && typeof mod.getPermissionsAsync === 'function') {
    ExpoNotifications = mod;
  }
} catch {
  // Silently ignore — running in Expo Go without native notification support
}

// Prevent auto-hide so we control the transition
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutInner() {
  const { theme, mode } = useTheme();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const responseListener = useRef<any>(null);
  const receivedListener = useRef<any>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  // Keep Android system navigation bar button style matching theme
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        const NavigationBar = require('expo-navigation-bar');
        NavigationBar.setButtonStyleAsync(mode === 'dark' ? 'light' : 'dark');
      } catch {}
    }
  }, [mode]);

  useEffect(() => {
    async function prepare() {
      try {
        // Set Android nav bar button style on init (bg is transparent via edge-to-edge)
        if (Platform.OS === 'android') {
          try {
            const NavigationBar = require('expo-navigation-bar');
            NavigationBar.setButtonStyleAsync(mode === 'dark' ? 'light' : 'dark');
          } catch {}
        }

        // Load Uthmanic Hafs font for Quranic Arabic text (KFGQPC — same as quran.com)
        await Font.loadAsync({
          'UthmanicHafs': require('@/assets/fonts/UthmanicHafs.ttf'),
        });

        // Initialize Notification Service (channels, handlers, etc.)
        await NotificationService.init();

        // Register background task for daily rescheduling
        await NotificationService.registerBackgroundTask();

        // Initialize QuranService cache from AsyncStorage (non-blocking read)
        await QuranService.initializeCache();
        
        // Prefetch Quran surahs list in background for instant first interaction
        // This is fire-and-forget, doesn't block app startup
        QuranService.prefetch();

        // Initialise localization (English / Urdu) BEFORE rendering any new UI.
        await i18n.init();

        // Initialize DataSync (anonymous auth + cloud sync readiness)
        await DataSyncService.init();

        // Salah Buddy: ensure the public profile doc exists with timezone, displayName,
        // photoURL and (after migration) fcmTokens array. Idempotent.
        UserProfileService.ensureProfile().catch(() => {});

        // Initialize FCM push notifications (after DataSync for user ID)
        FCMService.init().then(() => {
          FCMService.subscribeToDefaultTopics().catch(() => {});
        }).catch(() => {});
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

    responseListener.current = NotificationService.setupResponseHandler(router as any);

    // Handle incoming notifications: store in history + play azan sound
    if (ExpoNotifications) {
      receivedListener.current = ExpoNotifications.addNotificationReceivedListener((notification: any) => {
        // Save to legacy notification history (backward compat)
        NotificationHistory.add(notification).catch(() => {});

        // Save to new persistent notification storage (@notifications key)
        // Note: Also saved in setNotificationHandler — dedup logic prevents doubles
        NotificationStorage.addFromNotification(notification).catch(() => {});

        // Play azan sound if this is a prayer notification (foreground only)
        AzanPlayer.handleNotification(notification).catch(() => {});
      });

      // On launch, sync any notifications delivered while app was killed/background.
      // This captures notifications the user hasn't tapped, ensuring history is complete.
      NotificationService.syncDeliveredNotifications().catch(() => {});
    }

    return () => {
      responseListener.current?.remove();
      receivedListener.current?.remove();
    };
  }, [appReady, router]);

  // Handle app state changes (foreground/background)
  // When returning to foreground, play missed azan if one arrived recently
  useEffect(() => {
    if (!appReady) return;

    const subscription = AppState.addEventListener('change', async (state) => {
      const prevState = appStateRef.current;
      appStateRef.current = state;

      // App just came to foreground — check if we missed an azan
      if (state === 'active' && prevState !== 'active') {
        // Give the system a moment to deliver any pending notifications
        setTimeout(() => {
          AzanPlayer.handleAppForeground().catch(() => {});
        }, 500);

        // Sync any notifications delivered while app was in background
        // This ensures the Notifications screen shows all delivered notifications
        NotificationService.syncDeliveredNotifications().catch(() => {});

        // Check if notifications need rescheduling (new day). Reschedule the
        // rolling multi-day window right away using cached coords so we don't
        // wait for the user to open the prayer screen.
        const prefs = await NotificationService.getPreferences();
        if (prefs.enabled) {
          const lastScheduled = await AsyncStorage.getItem('sukoon_notif_last_scheduled');
          const today = new Date().toDateString();
          if (lastScheduled !== today) {
            if (__DEV__) console.log('[Sukoon] New day detected — re-extending notification window');
            NotificationService.rescheduleFromCache().catch(() => {});
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

  // Salah Buddy deep-link router. Branch surfaces both initial (cold-start) and
  // subsequent invite links via a single subscribe(). Routing waits until the
  // splash animation finishes so the user sees the Accept screen, not a flash
  // of the home tab. Tear down on unmount so we don't double-handle on
  // hot-reload during development.
  useEffect(() => {
    if (!splashDone) return;
    const unsub = BranchService.subscribe(({ code }) => {
      router.push(`/invite/${code}` as any);
    });
    return () => { try { unsub(); } catch {} };
  }, [splashDone, router]);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
  }, []);

  // Don't render anything until app is ready
  if (!appReady) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
          name="notifications"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="insights"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        {/* quran/ and tools/ have their own _layout.tsx — just declare the directory */}
        <Stack.Screen name="quran" options={{ headerShown: false }} />
        <Stack.Screen name="tools" options={{ headerShown: false }} />
        {/* Salah Buddy: deep-link target + friend detail. Both have their own _layout.tsx. */}
        <Stack.Screen name="invite" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="friends" options={{ headerShown: false }} />
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
