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
function hasNativeFirebaseModules(): boolean {
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
  const ready = await initializeFirebase();
  if (!ready) return null;

  try {
    const auth = await import('@react-native-firebase/auth');
    return auth.default();
  } catch (error) {
    if (__DEV__) console.warn('[Firebase] Auth not available:', error);
    return null;
  }
}

export default {
  isConfigured: isFirebaseConfigured,
  initialize: initializeFirebase,
  getFirestore,
  getMessaging,
  getAuth,
};
