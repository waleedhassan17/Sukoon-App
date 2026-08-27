/**
 * Firebase Configuration - Production Ready
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (e.g., "Sukoon App")
 * 3. Add an Android app with package name: com.sukoon.app (from app.json)
 * 4. Download google-services.json and place it in: android/app/google-services.json
 * 5. Add an iOS app (optional) and download GoogleService-Info.plist
 * 6. Replace the placeholder config below with your actual Firebase config
 * 7. Enable Firestore, Authentication (Anonymous), and Cloud Messaging in Firebase Console
 * 
 * For Cloud Messaging (Push Notifications):
 * - Enable Cloud Messaging in Firebase Console > Project Settings > Cloud Messaging
 * - For Android: google-services.json handles everything
 * - For iOS: Upload your APNs key in Firebase Console
 */

import { Platform } from 'react-native';

// ══════════════════════════════════════════════
// FIREBASE WEB CONFIG (for reference / web fallback)
// Replace these with your actual Firebase project values
// ══════════════════════════════════════════════
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDI0hLeB7RmT9x8v_0OXre-TFUZf7GzZPg',
  authDomain: 'sukoon-b36b4.firebaseapp.com',
  projectId: 'sukoon-b36b4',
  storageBucket: 'sukoon-b36b4.firebasestorage.app',
  messagingSenderId: '828153068966',
  appId: '1:828153068966:android:262edb1419fd1ad3096367',
};

// ══════════════════════════════════════════════
// INITIALIZATION STATUS
// ══════════════════════════════════════════════

let isFirebaseInitialized = false;
let firebaseApp: any = null;
let firestoreDb: any = null;
let authInstance: any = null;
let emulatorsConnected = false;

// ══════════════════════════════════════════════
// EMULATOR SUPPORT (local development only)
// ══════════════════════════════════════════════

/**
 * Point the SDKs at the local Firebase emulators when EXPO_PUBLIC_USE_FIREBASE_EMULATOR
 * is set. This is what makes the rules suite and the app exercise the SAME rules —
 * without it there is no way to try a change locally before it reaches real users.
 *
 * Ports mirror ../../firebase.json. Firestore is on 8090 rather than the usual 8080
 * because that port is already occupied on the primary dev machine.
 */
const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';

// The Android emulator reaches the host loopback through 10.0.2.2; everything else
// (iOS simulator, web) can use localhost directly.
const EMULATOR_HOST =
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST
  ?? (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

const EMULATOR_PORTS = { firestore: 8090, auth: 9099 };

/**
 * Check if Firebase is properly configured (not placeholder values)
 */
export function isFirebaseConfigured(): boolean {
  return (
    FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY' &&
    FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID'
  );
}

/**
 * Initialize Firebase (lazy, called once)
 * Returns true if Firebase is ready, false if not configured
 */
/**
 * Check if Firebase native modules are available (false in Expo Go)
 */
export function hasNativeFirebaseModules(): boolean {
  try {
    const { NativeModules } = require('react-native');
    return !!NativeModules.RNFBAppModule;
  } catch {
    return false;
  }
}

export async function initializeFirebase(): Promise<boolean> {
  if (isFirebaseInitialized) return true;
  if (!isFirebaseConfigured()) {
    if (__DEV__) console.log('[Firebase] Not configured - using local storage only');
    return false;
  }

  // Guard: Firebase native modules aren't available in Expo Go
  if (!hasNativeFirebaseModules()) {
    if (__DEV__) console.log('[Firebase] Native modules not available (Expo Go?) — using local storage only');
    return false;
  }

  try {
    // Dynamic import to avoid crash when not configured
    const { default: firebase } = await import('@react-native-firebase/app');
    
    // Check if default app exists
    if (firebase.apps.length === 0) {
      // For React Native Firebase, the native modules read from google-services.json
      // so we don't need to call initializeApp with config
      // The app initializes automatically from the native config files
    }
    
    firebaseApp = firebase.app();
    isFirebaseInitialized = true;
    
    if (__DEV__) console.log('[Firebase] Initialized successfully');
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[Firebase] Initialization failed:', error);
    return false;
  }
}

/**
 * Get Firestore instance (lazy)
 */
export async function getFirestore(): Promise<any | null> {
  if (firestoreDb) return firestoreDb;

  const ready = await initializeFirebase();
  if (!ready) return null;

  try {
    const firestore = await import('@react-native-firebase/firestore');
    firestoreDb = firestore.default();
    if (USE_EMULATOR && !emulatorsConnected) {
      emulatorsConnected = true;
      firestoreDb.useEmulator(EMULATOR_HOST, EMULATOR_PORTS.firestore);
      if (__DEV__) {
        console.log(`[Firebase] Firestore → emulator ${EMULATOR_HOST}:${EMULATOR_PORTS.firestore}`);
      }
    }
    return firestoreDb;
  } catch (error) {
    if (__DEV__) console.warn('[Firebase] Firestore not available:', error);
    return null;
  }
}

/**
 * Get Firebase Messaging instance
 */
export async function getMessaging(): Promise<any | null> {
  const ready = await initializeFirebase();
  if (!ready) return null;

  try {
    const messaging = await import('@react-native-firebase/messaging');
    return messaging.default();
  } catch (error) {
    if (__DEV__) console.warn('[Firebase] Messaging not available:', error);
    return null;
  }
}

/**
 * Get Firebase Auth instance
 */
export async function getAuth(): Promise<any | null> {
  if (authInstance) return authInstance;

  const ready = await initializeFirebase();
  if (!ready) return null;

  try {
    const auth = await import('@react-native-firebase/auth');
    authInstance = auth.default();
    if (USE_EMULATOR) {
      // Safe to call repeatedly, but we only reach here once thanks to the cache.
      authInstance.useEmulator(`http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`);
      if (__DEV__) {
        console.log(`[Firebase] Auth → emulator ${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`);
      }
    }
    return authInstance;
  } catch (error) {
    if (__DEV__) console.warn('[Firebase] Auth not available:', error);
    return null;
  }
}

// ══════════════════════════════════════════════
// AUTH READINESS
// ══════════════════════════════════════════════

let authReadyPromise: Promise<string | null> | null = null;

/**
 * Hard ceiling on how long anyone waits for anonymous sign-in.
 *
 * This is not a nicety. App startup awaits DataSyncService.init(), which awaits
 * this, and that await gates setAppReady() → SplashScreen.hideAsync(). Firebase's
 * signInAnonymously() has no timeout of its own, so on a captive-portal wifi or a
 * stalled connection it can neither resolve nor reject — and an unbounded await
 * there means the app never leaves the splash screen.
 *
 * 10s is generous for a slow-but-working network while still bounded. Cloud sync
 * is optional; the tracker works entirely from AsyncStorage, so timing out costs
 * the user nothing they can see.
 */
const AUTH_READY_TIMEOUT_MS = 10000;

/**
 * Resolve once anonymous auth has actually settled, yielding the uid.
 *
 * Why this exists: sign-in used to be fire-and-forgotten in DataSyncService.init(),
 * while readers took `auth.currentUser?.uid` synchronously. Whether a Firestore read
 * was authenticated therefore came down to a race with app startup — and losing that
 * race surfaced as an empty friends list or a permission-denied banner, intermittently
 * and mostly on cold start.
 *
 * Every Firestore access that needs `request.auth` must await this first.
 *
 * Returns null (never throws) when Firebase is unavailable — Expo Go, no native
 * modules, offline first-run — so callers can degrade instead of crashing.
 */
export function authReady(): Promise<string | null> {
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = (async () => {
    const auth = await getAuth();
    if (!auth) return null;

    // Already signed in (the common case — the SDK restores the session from
    // Keychain/Keystore, which is also what makes friendships survive reinstalls).
    if (auth.currentUser?.uid) return auth.currentUser.uid;

    return new Promise<string | null>(resolve => {
      let settled = false;
      const finish = (uid: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { unsubscribe(); } catch { /* listener already torn down */ }
        if (uid === null) {
          // Don't cache a failure forever — the next caller should get a fresh
          // attempt once the network recovers, rather than being told "no auth"
          // for the rest of the process lifetime.
          authReadyPromise = null;
        }
        resolve(uid);
      };

      const timer = setTimeout(() => {
        if (__DEV__) console.warn('[Firebase] Anonymous sign-in timed out; continuing without cloud sync');
        finish(null);
      }, AUTH_READY_TIMEOUT_MS);

      const unsubscribe = auth.onAuthStateChanged((user: any) => {
        if (user?.uid) finish(user.uid);
      });

      // No session to restore — create an anonymous one. The listener above fires
      // on success; this catch handles the offline / disabled-provider case.
      auth.signInAnonymously().catch((err: unknown) => {
        if (__DEV__) console.warn('[Firebase] Anonymous sign-in failed:', err);
        finish(null);
      });
    });
  })();

  return authReadyPromise;
}

/**
 * Reset the cached auth promise. Only needed when the signed-in identity changes
 * (e.g. linking an anonymous account to Google), so the next authReady() re-resolves.
 */
export function resetAuthReady(): void {
  authReadyPromise = null;
}

export default {
  isConfigured: isFirebaseConfigured,
  initialize: initializeFirebase,
  getFirestore,
  getMessaging,
  getAuth,
  authReady,
};
