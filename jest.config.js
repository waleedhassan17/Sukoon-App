/**
 * Jest config for pure-logic unit tests (lib/audiobooks/*).
 * React-Native/Expo modules are stubbed via moduleNameMapper — these tests run
 * in plain Node so they need no emulator or Metro. UI smoke tests would use
 * jest-expo; see docs/audiobooks-implementation-plan.md.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  globals: {
    // React Native's compile-time flag, referenced by lib/ modules.
    __DEV__: false,
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__tests__/stubs/react-native.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^\\.\\./firebaseConfig$': '<rootDir>/__tests__/stubs/firebaseConfig.ts',
    '^\\.\\./dataSyncService$': '<rootDir>/__tests__/stubs/dataSyncService.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react', esModuleInterop: true } }],
  },
};
