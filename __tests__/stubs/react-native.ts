/**
 * Minimal react-native stub for pure-logic unit tests (Node environment).
 * Only the surface our lib/ modules touch is implemented.
 */
export const Platform = {
  OS: 'android' as 'android' | 'ios' | 'web',
  select: <T,>(specifics: Record<string, T>): T | undefined =>
    specifics[Platform.OS] ?? specifics.default,
};

/**
 * Native module registry. Empty by default, which is what lib/firebaseConfig's
 * hasNativeFirebaseModules() reads as "Expo Go / no native Firebase" — the
 * behaviour every other test relies on. Tests that need native Firebase present
 * assign into this object before requiring the module under test.
 */
export const NativeModules: Record<string, any> = {};

export default { Platform, NativeModules };
