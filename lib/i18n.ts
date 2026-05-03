/**
 * Tiny in-house i18n module for Salah Buddy strings.
 *
 * Why not i18next: pulls 60KB+ of runtime + plugins for what is currently a
 * single feature with two locales. This file is ~70 lines and gives us:
 *   - device-language detection (English / Urdu),
 *   - manual locale override (persisted in AsyncStorage),
 *   - parameter interpolation: t('key', { name: 'Ali' }) → "Hello, Ali"
 *   - RTL flag (true for Urdu) so screens can flip layout direction.
 *
 * Strings live in `locales/en.json` and `locales/ur.json`. Add new locales by
 * dropping a JSON file and registering it in LOCALES.
 *
 * If the rest of the app later adopts i18next, the public API of this module
 * (`t`, `getLocale`, `useLocale`) is small enough to swap implementations
 * without touching call sites.
 */

import { useEffect, useState } from 'react';
import { NativeModules, Platform, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ur from './locales/ur.json';

export type LocaleCode = 'en' | 'ur';

const LOCALES: Record<LocaleCode, Record<string, string>> = { en, ur };
const RTL_LOCALES: ReadonlySet<LocaleCode> = new Set(['ur']);
const LOCALE_KEY = 'sukoon_locale';

let currentLocale: LocaleCode = 'en';
const listeners = new Set<(loc: LocaleCode) => void>();

function detectDeviceLocale(): LocaleCode {
  try {
    const tag: string =
      Platform.OS === 'ios'
        ? (NativeModules.SettingsManager?.settings?.AppleLocale
           ?? NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
           ?? 'en')
        : (NativeModules.I18nManager?.localeIdentifier ?? 'en');
    return tag.toLowerCase().startsWith('ur') ? 'ur' : 'en';
  } catch {
    return 'en';
  }
}

export const i18n = {
  /**
   * Resolve persisted locale, fallback to device locale. Call once on app start.
   */
  async init(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(LOCALE_KEY);
      currentLocale = (saved === 'ur' || saved === 'en') ? saved : detectDeviceLocale();
    } catch {
      currentLocale = detectDeviceLocale();
    }
    // Surface RTL to RN so layout flips for Urdu. App restart is required for full
    // effect on Android — we accept the trade-off rather than forceful restarts.
    const wantRTL = RTL_LOCALES.has(currentLocale);
    if (I18nManager.isRTL !== wantRTL) {
      try { I18nManager.forceRTL(wantRTL); I18nManager.allowRTL(wantRTL); } catch {}
    }
  },

  getLocale(): LocaleCode { return currentLocale; },

  isRTL(): boolean { return RTL_LOCALES.has(currentLocale); },

  async setLocale(loc: LocaleCode): Promise<void> {
    currentLocale = loc;
    try { await AsyncStorage.setItem(LOCALE_KEY, loc); } catch {}
    listeners.forEach(fn => fn(loc));
  },

  /**
   * Translate a key with optional `{name}` interpolation. Falls back to English
   * if the key is missing in the active locale, then to the key itself if both
   * are missing — never throws, never returns undefined.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = LOCALES[currentLocale] ?? LOCALES.en;
    let template = dict[key] ?? LOCALES.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return template;
  },
};

/** React hook — re-renders the consumer when the locale changes. */
export function useLocale(): LocaleCode {
  const [loc, setLoc] = useState<LocaleCode>(currentLocale);
  useEffect(() => {
    listeners.add(setLoc);
    return () => { listeners.delete(setLoc); };
  }, []);
  return loc;
}

export const t = i18n.t.bind(i18n);
