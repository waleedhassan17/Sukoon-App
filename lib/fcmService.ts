/**
 * Firebase Cloud Messaging (FCM) Service
 * 
 * Handles:
 * - FCM token registration & refresh
 * - Remote push notification handling (foreground/background)
 * - Token storage in Firestore (for server-side push)
 * - Permission management
 * 
 * Works alongside expo-notifications (local) — FCM handles remote push.
 * If Firebase is not configured, this module is a safe no-op.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessaging, getFirestore, isFirebaseConfigured } from './firebaseConfig';

// ══════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════

const KEYS = {
  FCM_TOKEN: 'sukoon_fcm_token',
  USER_ID: 'sukoon_firebase_uid',
};

// ══════════════════════════════════════════════
// FCM SERVICE
// ══════════════════════════════════════════════

export const FCMService = {

  /**
   * Initialize FCM — call once on app start (after DataSyncService.init)
   * 1. Requests notification permission
   * 2. Gets FCM token
   * 3. Stores token in Firestore for server-side pushes
   * 4. Sets up token refresh listener
   * 5. Sets up foreground message handler
   */
  async init(): Promise<void> {
    if (!isFirebaseConfigured()) {
      if (__DEV__) console.log('[FCM] Firebase not configured — skipping');
      return;
    }

    try {
      const messaging = await getMessaging();
      if (!messaging) return;

      // 1. Request permission (Android auto-grants, iOS shows prompt)
      const authStatus = await messaging.requestPermission();
      const authorized =
        authStatus === 1 || // AUTHORIZED
        authStatus === 2;   // PROVISIONAL

      if (!authorized) {
        if (__DEV__) console.log('[FCM] Permission denied');
        return;
      }

      // 2. Get FCM token
      const token = await messaging.getToken();
      if (token) {
        await this._storeToken(token);
        if (__DEV__) console.log('[FCM] Token:', token.substring(0, 20) + '...');
      }

      // 3. Listen for token refresh
      messaging.onTokenRefresh(async (newToken: string) => {
        await this._storeToken(newToken);
        if (__DEV__) console.log('[FCM] Token refreshed');
      });

      // 4. Foreground message handler
      messaging.onMessage(async (remoteMessage: any) => {
        if (__DEV__) console.log('[FCM] Foreground message:', remoteMessage.notification?.title);
        
        // The message is also forwarded to expo-notifications if properly configured,
        // but we can also handle it here for custom logic
        // (e.g., updating badge count, showing in-app toast, etc.)
      });

      if (__DEV__) console.log('[FCM] Initialized successfully');
    } catch (error) {
      if (__DEV__) console.warn('[FCM] Init failed:', error);
    }
  },

  /**
   * Store FCM token locally + in Firestore
   */
  async _storeToken(token: string): Promise<void> {
    try {
      // Store locally
      await AsyncStorage.setItem(KEYS.FCM_TOKEN, token);

      // Store in Firestore for server-side push
      const db = await getFirestore();
      const userId = await AsyncStorage.getItem(KEYS.USER_ID);
      if (db && userId) {
        await db.collection('users').doc(userId).set({
          fcmToken: token,
          platform: Platform.OS,
          lastTokenUpdate: Date.now(),
        }, { merge: true });
      }
    } catch (error) {
      if (__DEV__) console.warn('[FCM] Token storage failed:', error);
    }
  },

  /**
   * Get current FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.FCM_TOKEN);
    } catch {
      return null;
    }
  },

  /**
   * Subscribe to a topic (e.g., 'prayer-reminders', 'quran-daily')
   * Server can push to all users subscribed to a topic
   */
  async subscribeToTopic(topic: string): Promise<void> {
    if (!isFirebaseConfigured()) return;
    try {
      const messaging = await getMessaging();
      if (messaging) {
        await messaging.subscribeToTopic(topic);
        if (__DEV__) console.log(`[FCM] Subscribed to topic: ${topic}`);
      }
    } catch (error) {
      if (__DEV__) console.warn(`[FCM] Subscribe failed for ${topic}:`, error);
    }
  },

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    if (!isFirebaseConfigured()) return;
    try {
      const messaging = await getMessaging();
      if (messaging) {
        await messaging.unsubscribeFromTopic(topic);
        if (__DEV__) console.log(`[FCM] Unsubscribed from topic: ${topic}`);
      }
    } catch (error) {
      if (__DEV__) console.warn(`[FCM] Unsubscribe failed for ${topic}:`, error);
    }
  },

  /**
   * Subscribe to default Sukoon topics
   */
  async subscribeToDefaultTopics(): Promise<void> {
    await this.subscribeToTopic('sukoon-general');
    await this.subscribeToTopic('prayer-reminders');
    await this.subscribeToTopic('quran-daily');
  },

  /**
   * Check if FCM is available
   */
  isAvailable(): boolean {
    return isFirebaseConfigured();
  },
};

// ══════════════════════════════════════════════
// BACKGROUND MESSAGE HANDLER
// Must be registered at module level for @react-native-firebase/messaging
// This runs when the app is killed/background and receives a push
// ══════════════════════════════════════════════

async function setupBackgroundHandler(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    const messaging = await getMessaging();
    if (messaging) {
      messaging.setBackgroundMessageHandler(async (remoteMessage: any) => {
        if (__DEV__) console.log('[FCM] Background message:', remoteMessage.notification?.title);
        // Background messages are automatically displayed as system notifications
        // by Firebase. Custom handling can be added here if needed.
      });
    }
  } catch {}
}

// Auto-setup background handler on module load
setupBackgroundHandler().catch(() => {});

export default FCMService;
