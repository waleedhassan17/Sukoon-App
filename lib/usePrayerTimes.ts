/**
 * usePrayerTimes — one source of truth for "where am I and when is prayer",
 * shared by the Home screen and the Prayer Times screen.
 *
 * Flow
 *  1. Paint instantly from the last-known location (computed offline — no
 *     network, no spinner on repeat visits).
 *  2. In the background, refresh the GPS fix. If the user has moved (> 3 km),
 *     recompute, persist the new location and re-lay the notification window.
 *     The OLD Home screen returned early whenever a cache existed and therefore
 *     never refreshed location — so travelling users kept stale times and a
 *     stale notification schedule.
 *  3. Recompute at local midnight and whenever the app returns to foreground.
 *
 * The hook deliberately holds NO per-second state (a ticking hook would
 * re-render the whole Home screen every second). Live countdowns live in
 * <LiveCountdown/>, which asks the hook to `reload()` when a prayer time passes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { PrayerTimesService, PrayerTimesData } from './prayerTimes';
import {
  distanceKm,
  LatLng,
  NextPrayerInfo,
  nextPrayerAfter,
  resolveSettings,
} from './prayerEngine';
import { NotificationService } from './notificationService';
import { resolveLocationName } from './locationName';
import { getLocationFix } from './locationFix';

export type PrayerStatus = 'loading' | 'ready' | 'denied' | 'unavailable';
export type LocationPermission = 'granted' | 'denied' | 'undetermined';

/** Moving less than this keeps the same location (GPS jitter, same city). */
const MOVE_THRESHOLD_KM = 3;

export interface UsePrayerTimes {
  status: PrayerStatus;
  permission: LocationPermission;
  coords: LatLng | null;
  /** '' until resolved (UI should fall back to formatCoords). */
  locationName: string;
  times: PrayerTimesData | null;
  next: NextPrayerInfo | null;
  refreshing: boolean;
  /** Re-ask for a fresh GPS fix (pull-to-refresh / retry). Prompts if needed. */
  refresh: () => Promise<void>;
  /** Recompute with current settings (after a settings change / prayer elapsed). */
  reload: () => Promise<void>;
}

export function usePrayerTimes(
  opts: { askPermission?: 'never' | 'ifNoLocation' | 'always' } = {},
): UsePrayerTimes {
  const { askPermission = 'ifNoLocation' } = opts;

  const [status, setStatus] = useState<PrayerStatus>('loading');
  const [permission, setPermission] = useState<LocationPermission>('undetermined');
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationName, setLocationName] = useState('');
  const [times, setTimes] = useState<PrayerTimesData | null>(null);
  const [next, setNext] = useState<NextPrayerInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mounted = useRef(true);
  const coordsRef = useRef<LatLng | null>(null);
  const nameRef = useRef('');

  const recompute = useCallback(async (c: LatLng) => {
    const now = new Date();
    const data = PrayerTimesService.computeFor(c, now);
    const n = nextPrayerAfter(c, resolveSettings(c), now);
    if (!mounted.current) return;
    setTimes(data);
    setNext(n);
  }, []);

  const reload = useCallback(async () => {
    if (coordsRef.current) await recompute(coordsRef.current);
  }, [recompute]);

  /** Best-effort place name; never blocks anything. */
  const fillName = useCallback(async (c: LatLng) => {
    const name = await resolveLocationName(c.lat, c.lng);
    if (!name || !mounted.current) return;
    // The user may have moved again while we were resolving.
    if (!coordsRef.current || distanceKm(coordsRef.current, c) > 1) return;
    nameRef.current = name;
    setLocationName(name);
    PrayerTimesService.cacheLocation(c.lat, c.lng, name).catch(() => {});
  }, []);

  /**
   * Obtain a location fix and, if it differs from what we have, adopt it.
   * Returns what the caller should show if there is still no location at all.
   */
  const syncLocation = useCallback(
    async (o: { force: boolean; interactive: boolean }): Promise<'ok' | 'denied' | 'unavailable'> => {
      let perm = (await Location.getForegroundPermissionsAsync()).status;
      if (perm !== 'granted' && o.interactive) {
        perm = (await Location.requestForegroundPermissionsAsync()).status;
      }
      const mapped: LocationPermission = perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'undetermined';
      if (mounted.current) setPermission(mapped);
      if (perm !== 'granted') return coordsRef.current ? 'ok' : 'denied';

      // A recent fix is good enough unless the user explicitly refreshed.
      if (!o.force && coordsRef.current && (await PrayerTimesService.getCachedLocation())) {
        NotificationService.syncSchedule().catch(() => {});
        return 'ok';
      }

      const fix = await getLocationFix();
      if (!fix) return coordsRef.current ? 'ok' : 'unavailable';

      const prev = coordsRef.current;
      if (!prev || distanceKm(prev, fix) > MOVE_THRESHOLD_KM) {
        coordsRef.current = fix;
        nameRef.current = '';
        if (mounted.current) {
          setCoords(fix);
          setLocationName('');
        }
        await PrayerTimesService.cacheLocation(fix.lat, fix.lng, '');
        await recompute(fix);
        // New place ⇒ new times ⇒ re-lay the window (also saves the coords).
        NotificationService.syncSchedule(fix).catch(() => {});
        fillName(fix).catch(() => {});
      } else {
        // Same place: just reset the GPS TTL and make sure the window is topped up.
        await PrayerTimesService.cacheLocation(prev.lat, prev.lng, nameRef.current);
        NotificationService.syncSchedule().catch(() => {});
      }
      return 'ok';
    },
    [recompute, fillName],
  );

  // ── Initial load ──
  useEffect(() => {
    mounted.current = true;
    (async () => {
      const saved = await PrayerTimesService.getSavedLocation();
      if (saved) {
        const c = { lat: saved.lat, lng: saved.lng };
        coordsRef.current = c;
        nameRef.current = saved.name;
        setCoords(c);
        setLocationName(saved.name);
        await recompute(c);
        if (mounted.current) setStatus('ready');
        if (!saved.name) fillName(c).catch(() => {});
      }

      const interactive = askPermission === 'always' || (askPermission === 'ifNoLocation' && !saved);
      try {
        const res = await syncLocation({ force: false, interactive });
        if (!saved && mounted.current) {
          setStatus(res === 'ok' ? 'ready' : res === 'denied' ? 'denied' : 'unavailable');
        }
      } catch {
        if (!saved && mounted.current) setStatus('unavailable');
      }
    })();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-read settings whenever the screen regains focus ──
  useFocusEffect(
    useCallback(() => {
      reload().catch(() => {});
    }, [reload]),
  );

  // ── App returns to foreground → recompute (day may have rolled over) ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reload().catch(() => {});
    });
    return () => sub.remove();
  }, [reload]);

  // ── The moment the next prayer arrives, roll over to the one after it ──
  // One timer (not a per-second tick), so Home and the Prayer screen never show
  // a prayer that has already passed as "next".
  const nextAt = next ? next.time.getTime() : null;
  useEffect(() => {
    if (nextAt == null || !Number.isFinite(nextAt)) return;
    const wait = nextAt - Date.now();
    // Bounded: setTimeout overflows past ~24.8 days, and a bad value must never spin.
    if (!Number.isFinite(wait) || wait > 2 ** 31 - 1) return;
    const id = setTimeout(() => { reload().catch(() => {}); }, Math.max(wait, 0) + 500);
    return () => clearTimeout(id);
  }, [nextAt, reload]);

  // ── Local midnight → new day's times ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 2, 0);
      timer = setTimeout(() => {
        reload().catch(() => {});
        arm();
      }, midnight.getTime() - now.getTime());
    };
    arm();
    return () => clearTimeout(timer);
  }, [reload]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await syncLocation({ force: true, interactive: true });
      if (!coordsRef.current && mounted.current) {
        setStatus(res === 'denied' ? 'denied' : 'unavailable');
      } else if (mounted.current) {
        setStatus('ready');
        await reload();
      }
    } catch {
      if (!coordsRef.current && mounted.current) setStatus('unavailable');
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [syncLocation, reload]);

  return { status, permission, coords, locationName, times, next, refreshing, refresh, reload };
}
