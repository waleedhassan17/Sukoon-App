/**
 * Device location helpers shared by every screen that needs "where am I".
 *
 * A fix is requested at Balanced accuracy (city-level is plenty for prayer
 * times and the Qibla bearing, and arrives far faster than a High-accuracy GPS
 * lock — which indoors can take minutes), bounded by a timeout, and falls back
 * to the OS's last-known position instead of leaving the UI waiting forever.
 */

import * as Location from 'expo-location';
import type { LatLng } from './prayerEngine';

/** Reject if `p` has not settled within `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export const GPS_TIMEOUT_MS = 12_000;

/** A position fix: fresh if possible, else the OS's last known one, else null. */
export async function getLocationFix(timeoutMs: number = GPS_TIMEOUT_MS): Promise<LatLng | null> {
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutMs,
    );
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    } catch {}
    return null;
  }
}
