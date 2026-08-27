/**
 * Minimal react-native stub for pure-logic unit tests (Node environment).
 * Only the surface our lib/ modules touch is implemented.
 */
export const Platform = {
  OS: 'android' as 'android' | 'ios' | 'web',
  select: <T,>(specifics: Record<string, T>): T | undefined =>
    specifics[Platform.OS] ?? specifics.default,
};

export default { Platform };
