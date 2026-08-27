/**
 * authReady() must never hang.
 *
 * App startup awaits DataSyncService.init(), which awaits authReady(), and that
 * await gates setAppReady() → SplashScreen.hideAsync() in app/_layout.tsx.
 * Firebase's signInAnonymously() has no timeout of its own, so on a captive-portal
 * wifi or a stalled connection it can neither resolve nor reject. Without the
 * timeout in authReady(), that strands the app on the splash screen forever.
 *
 * These drive the real module with a fake native layer, so they exercise the
 * actual promise/timer logic rather than a restatement of it.
 */

type Behaviour = 'immediate' | 'hangs' | 'rejects' | 'existing';

/** A fake @react-native-firebase/auth whose behaviour each test controls. */
function makeAuth(behaviour: Behaviour) {
  const listeners: ((u: any) => void)[] = [];
  const auth = {
    currentUser: behaviour === 'existing' ? { uid: 'existing-uid' } : null,
    signInCalls: 0,
    onAuthStateChanged(cb: (u: any) => void) {
      listeners.push(cb);
      return () => { listeners.length = 0; };
    },
    signInAnonymously() {
      auth.signInCalls++;
      switch (behaviour) {
        case 'immediate':
          // Real Firebase notifies the listener; mirror that ordering.
          listeners.forEach(l => l({ uid: 'new-uid' }));
          return Promise.resolve({ user: { uid: 'new-uid' } });
        case 'rejects':
          return Promise.reject(new Error('auth/network-request-failed'));
        default:
          return new Promise(() => {}); // never settles — the dangerous case
      }
    },
  };
  return auth;
}

/**
 * Run `body` against a freshly-loaded firebaseConfig with the native Firebase
 * layer faked.
 *
 * Everything must happen INSIDE the isolated scope: getAuth() reaches for its
 * native modules through a lazy `await import(...)`, so a module captured here
 * and used outside would find the mocks already unregistered.
 *
 * `__esModule: true` is required on each mock — without it the CommonJS interop
 * wraps the mock a second time and initializeFirebase() silently fails.
 */
async function withAuth(auth: any, body: (mod: any) => Promise<void>): Promise<void> {
  await jest.isolateModulesAsync(async () => {
    // react-native is redirected by moduleNameMapper, which beats jest.doMock —
    // so flip the flag on the shared stub instead. Present === "not Expo Go".
    const rn = require('react-native');
    if (auth) rn.NativeModules.RNFBAppModule = {};
    else delete rn.NativeModules.RNFBAppModule;

    jest.doMock('@react-native-firebase/app', () => ({
      __esModule: true,
      default: { apps: [{}], app: () => ({}) },
    }));
    jest.doMock('@react-native-firebase/auth', () => ({
      __esModule: true,
      default: () => auth,
    }));

    await body(require('../lib/firebaseConfig'));
  });
}

/** Let pending promise jobs drain while fake timers are installed. */
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

afterEach(() => {
  jest.useRealTimers();
  // Leave the shared stub as we found it for every other suite.
  delete require('react-native').NativeModules.RNFBAppModule;
});

describe('authReady', () => {
  test('resolves immediately when a session already exists', async () => {
    await withAuth(makeAuth('existing'), async mod => {
      await expect(mod.authReady()).resolves.toBe('existing-uid');
    });
  });

  test('resolves with the uid after a successful anonymous sign-in', async () => {
    await withAuth(makeAuth('immediate'), async mod => {
      await expect(mod.authReady()).resolves.toBe('new-uid');
    });
  });

  test('resolves null rather than rejecting when sign-in fails', async () => {
    // Callers must be able to degrade, not crash.
    await withAuth(makeAuth('rejects'), async mod => {
      await expect(mod.authReady()).resolves.toBeNull();
    });
  });

  test('TIMES OUT instead of hanging when sign-in never settles', async () => {
    // The splash-screen bug. Without the timeout this promise never settles.
    await withAuth(makeAuth('hangs'), async mod => {
      jest.useFakeTimers();
      const p = mod.authReady();
      let settled = false;
      p.then(() => { settled = true; });

      await flush();
      jest.advanceTimersByTime(10001);

      await expect(p).resolves.toBeNull();
      expect(settled).toBe(true);
    });
  });

  test('a timed-out attempt is not cached — the next call retries', async () => {
    // Caching the failure would leave cloud sync dead until an app restart.
    const auth = makeAuth('hangs');
    await withAuth(auth, async mod => {
      jest.useFakeTimers();

      const first = mod.authReady();
      await flush();
      jest.advanceTimersByTime(10001);
      await expect(first).resolves.toBeNull();

      const second = mod.authReady();
      expect(second).not.toBe(first);
      await flush();
      jest.advanceTimersByTime(10001);
      await expect(second).resolves.toBeNull();

      expect(auth.signInCalls).toBe(2); // genuinely retried
    });
  });

  test('a successful result IS cached — sign-in runs once', async () => {
    const auth = makeAuth('immediate');
    await withAuth(auth, async mod => {
      expect(await mod.authReady()).toBe('new-uid');
      expect(await mod.authReady()).toBe('new-uid');
      expect(auth.signInCalls).toBe(1);
    });
  });

  test('returns null when Firebase is unavailable (Expo Go)', async () => {
    await withAuth(null, async mod => {
      await expect(mod.authReady()).resolves.toBeNull();
    });
  });
});
