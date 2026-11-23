/**
 * Native half of image sharing: capture a laid-out view to a PNG and hand the
 * file to the OS share sheet (WhatsApp, Instagram, Photos, Files…).
 *
 * Both native modules are loaded lazily inside try/catch. `react-native-view-shot`
 * (TurboModuleRegistry.getEnforcing) and `expo-sharing` (requireNativeModule)
 * THROW at import time on a binary that doesn't contain them — web, Expo Go or
 * a stale dev build. Importing them at the top level would crash those builds.
 * Store builds can't get this JS without the modules: it ships on OTA runtime 1.1.0.
 *
 * Sharing is image-only by design. There is deliberately no text fallback.
 */

import { Platform } from 'react-native';
import type { View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

type ViewShotModule = typeof import('react-native-view-shot');
type SharingModule = typeof import('expo-sharing');

let viewShot: ViewShotModule | null | undefined;
let sharing: SharingModule | null | undefined;

function loadModules(): { viewShot: ViewShotModule | null; sharing: SharingModule | null } {
  if (Platform.OS === 'web') return { viewShot: null, sharing: null };
  if (viewShot === undefined) {
    try { viewShot = require('react-native-view-shot') as ViewShotModule; } catch { viewShot = null; }
  }
  if (sharing === undefined) {
    try { sharing = require('expo-sharing') as SharingModule; } catch { sharing = null; }
  }
  return { viewShot, sharing };
}

/** True when this build can capture and share images. */
export async function canShareImage(): Promise<boolean> {
  const { viewShot: vs, sharing: sh } = loadModules();
  if (!vs || !sh) return false;
  try {
    return await sh.isAvailableAsync();
  } catch {
    return false;
  }
}

const SHARE_DIR = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}share/` : null;

/**
 * Give the capture a clean, readable name ("sukoon-ayah-ali-imran-3-8.png")
 * and keep only the latest shared card in the cache. On any failure the
 * original capture is shared as-is.
 */
async function tidyFile(uri: string, fileName: string): Promise<string> {
  if (!SHARE_DIR) return uri;
  try {
    await FileSystem.deleteAsync(SHARE_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(SHARE_DIR, { intermediates: true });
    const target = `${SHARE_DIR}${fileName}.png`;
    await FileSystem.moveAsync({ from: uri, to: target });
    return target;
  } catch {
    return uri;
  }
}

export interface ShareImageOptions {
  /** Output size in pixels. */
  width: number;
  height: number;
  /** Base name without extension. */
  fileName: string;
  /** Android chooser title. */
  dialogTitle?: string;
}

/**
 * Capture `target` as a PNG and open the share sheet with it.
 * Throws if the build lacks the native modules or the capture fails.
 */
export async function shareViewAsImage(target: View | null, opts: ShareImageOptions): Promise<void> {
  const { viewShot: vs, sharing: sh } = loadModules();
  if (!vs || !sh) throw new Error('image-share-unavailable');
  if (!target) throw new Error('image-share-no-target');

  const captured = await vs.captureRef(target, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: opts.width,
    height: opts.height,
    fileName: opts.fileName,
  });
  const uri = await tidyFile(captured, opts.fileName);

  await sh.shareAsync(uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: opts.dialogTitle,
  });
}
