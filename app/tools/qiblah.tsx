/**
 * QiblahScreen — find the Qibla, simply.
 *
 *   header   back · title · recalibrate
 *   status   "Turn right 42°"  →  "You're facing the Qibla"
 *   dial     one compass: tick ring, gold Kaaba marker, fixed pointer, live heading
 *   hint     one line of advice
 *
 * Sensors: raw magnetometer first (smooth, phone held flat), the OS heading as a
 * fallback, and a static "from North" view when neither exists. Location: starts
 * instantly from the app's last-known location, then refines with a fresh fix
 * (bounded by a timeout — it can no longer wait forever on a GPS lock).
 *
 * Efficiency: the dial turns on the native driver at every sensor sample, but the
 * React tree only re-renders ~10×/s; the compass stops when the screen loses focus
 * or the app is backgrounded.
 *
 * Works in Expo Go and production builds. The maths lives in lib/qiblahService.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, ActivityIndicator, Linking, Dimensions, AppState, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Magnetometer } from 'expo-sensors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { t, useLocale } from '@/lib/i18n';
import { useSafeBack } from '@/lib/useSafeBack';
import { getLocationFix, withTimeout } from '@/lib/locationFix';
import { PrayerTimesService } from '@/lib/prayerTimes';
import { distanceKm, LatLng } from '@/lib/prayerEngine';
import {
  calculateQiblahBearing,
  createHeadingSmoother,
  distanceToKaabaKm,
  getCompassDirection,
  isFacingQibla,
  magnetometerToHeading,
  normalizeAngleDiff,
  turnGuidance,
} from '@/lib/qiblahService';
import ToolHero, { HeroIconButton } from '@/components/ToolHero';
import ToolStateCard from '@/components/ToolStateCard';
import CompassDial from '@/components/qibla/CompassDial';

const DIAL_SIZE = Math.min(Dimensions.get('window').width - 56, 320);
const SENSOR_INTERVAL_MS = 33; // ~30 Hz
const SMOOTHER_WINDOW = 8;
const ANIM_MS = 120;
const STATE_THROTTLE_MS = 100; // how often React re-renders with the new heading
const DATA_WAIT_MS = 3000; // how long a sensor gets to produce its first reading
const MOVED_KM = 1; // a fresh fix this far away replaces the remembered location
const CALIBRATE_HINT_MS = 1800;

type ErrorKind = 'permission_denied' | 'gps_unavailable' | 'unknown';
type CompassMode = 'starting' | 'magnetometer' | 'heading' | 'none';

/** Resolve true as soon as `cond()` holds, false after `ms`. */
function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (cond()) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - start >= ms) {
        clearInterval(iv);
        resolve(false);
      }
    }, 100);
  });
}

const formatKm = (km: number) => Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function QiblahScreen() {
  const { theme } = useTheme();
  const goBack = useSafeBack('/');
  const insets = useSafeAreaInsets();
  useLocale();

  const [place, setPlace] = useState<LatLng | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<CompassMode>('starting');
  const [heading, setHeading] = useState(0);
  const [aligned, setAligned] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  // Refs: sensor-rate values that must not trigger a render per sample.
  const dialAnim = useRef(new Animated.Value(0)).current;
  const lastDial = useRef(0);
  const headingRef = useRef(0);
  const lastStateAt = useRef(0);
  const trailingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smoother = useRef(createHeadingSmoother(SMOOTHER_WINDOW));
  const magSub = useRef<{ remove: () => void } | null>(null);
  const headSub = useRef<{ remove: () => void } | null>(null);
  const session = useRef(0); // bumped on every start/stop so stale async work can bail out
  const mounted = useRef(true);
  const focused = useRef(false);
  const havePlace = useRef(false);
  const declination = useRef(0); // magnetic → true north (degrees)

  const bearing = useMemo(() => (place ? calculateQiblahBearing(place.lat, place.lng) : 0), [place]);
  const km = useMemo(() => (place ? distanceToKaabaKm(place.lat, place.lng) : 0), [place]);
  const compassActive = mode === 'magnetometer' || mode === 'heading';

  // ── Dial: shortest-path rotation on the native driver ──
  const animateDial = useCallback(
    (deg: number) => {
      let next = lastDial.current + normalizeAngleDiff(lastDial.current, -deg);
      if (Math.abs(next) > 3600) {
        // Keep the value bounded; a whole number of turns is visually identical.
        next -= 360 * Math.round(next / 360);
        dialAnim.setValue(next);
      }
      lastDial.current = next;
      Animated.timing(dialAnim, {
        toValue: next,
        duration: ANIM_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [dialAnim],
  );

  const applyHeading = useCallback(
    (raw: number) => {
      if (!isFinite(raw) || raw < 0 || !mounted.current) return;
      const smoothed = smoother.current.push(raw);
      headingRef.current = smoothed;
      animateDial(smoothed); // every sample — cheap, native-driven

      // …but only re-render ~10×/s, with a trailing update so the last value always lands.
      const now = Date.now();
      if (now - lastStateAt.current >= STATE_THROTTLE_MS) {
        lastStateAt.current = now;
        setHeading(smoothed);
      }
      if (trailingTimer.current) clearTimeout(trailingTimer.current);
      trailingTimer.current = setTimeout(() => {
        trailingTimer.current = null;
        if (mounted.current) setHeading(headingRef.current);
      }, STATE_THROTTLE_MS);
    },
    [animateDial],
  );

  // ── Compass ──
  const stopCompass = useCallback(() => {
    session.current += 1;
    magSub.current?.remove();
    magSub.current = null;
    headSub.current?.remove();
    headSub.current = null;
    if (trailingTimer.current) {
      clearTimeout(trailingTimer.current);
      trailingTimer.current = null;
    }
  }, []);

  const startCompass = useCallback(async () => {
    stopCompass(); // clears old subscriptions and invalidates any in-flight start
    const my = session.current;
    const alive = () => mounted.current && session.current === my;
    setMode('starting');
    smoother.current.reset();

    // 1) Raw magnetometer — smooth and fast (assumes the phone is held flat).
    try {
      let got = false;
      Magnetometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      const sub = Magnetometer.addListener(({ x, y }) => {
        const h = magnetometerToHeading(x, y);
        if (!isFinite(h)) return;
        got = true;
        applyHeading((h + declination.current + 360) % 360);
      });
      magSub.current = sub;
      await waitFor(() => got || !alive(), DATA_WAIT_MS);
      if (!alive()) {
        sub.remove();
        if (magSub.current === sub) magSub.current = null;
        return;
      }
      if (got) {
        setMode('magnetometer');
        return;
      }
      sub.remove();
      magSub.current = null;
    } catch {
      magSub.current?.remove();
      magSub.current = null;
    }

    if (!alive()) return;

    // 2) The OS's own heading (tilt-compensated, true north).
    try {
      let got = false;
      const sub = await Location.watchHeadingAsync((h) => {
        const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading >= 0 ? h.magHeading : -1;
        if (deg < 0) return;
        got = true;
        applyHeading(deg);
      });
      if (!alive()) {
        sub.remove();
        return;
      }
      headSub.current = sub;
      await waitFor(() => got || !alive(), DATA_WAIT_MS);
      if (!alive()) {
        sub.remove();
        if (headSub.current === sub) headSub.current = null;
        return;
      }
      if (got) {
        setMode('heading');
        return;
      }
      sub.remove();
      headSub.current = null;
    } catch {
      headSub.current?.remove();
      headSub.current = null;
    }

    if (alive()) setMode('none'); // no compass on this device
  }, [applyHeading, stopCompass]);

  // ── Location: instant from the remembered place, then refine with a fresh fix ──
  const initLocation = useCallback(async () => {
    setError(null);
    let saved: { lat: number; lng: number } | null = null;
    try {
      saved = await PrayerTimesService.getSavedLocation();
      if (!mounted.current) return;
      if (saved) {
        setPlace({ lat: saved.lat, lng: saved.lng });
        setLoading(false);
      }

      let perm = (await Location.getForegroundPermissionsAsync()).status;
      if (perm !== 'granted') perm = (await Location.requestForegroundPermissionsAsync()).status;
      if (!mounted.current) return;
      if (perm !== 'granted') {
        if (!saved) setError('permission_denied');
        setLoading(false);
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        if (!mounted.current) return;
        if (!saved) setError('gps_unavailable');
        setLoading(false);
        return;
      }

      const fix = await getLocationFix();
      if (!mounted.current) return;
      if (!fix) {
        if (!saved) setError('unknown');
        setLoading(false);
        return;
      }
      setPlace((prev) => (!prev || distanceKm(prev, fix) > MOVED_KM ? fix : prev));
      setLoading(false);

      // Magnetic declination, so the raw magnetometer points at TRUE north.
      try {
        const h = await withTimeout(Location.getHeadingAsync(), 3000);
        if (h.trueHeading >= 0 && h.magHeading >= 0) declination.current = h.trueHeading - h.magHeading;
      } catch {
        /* 0° is a fine fallback */
      }
    } catch {
      // Any unexpected failure must end in a message, never an endless spinner.
      if (!mounted.current) return;
      if (!saved) setError('unknown');
      setLoading(false);
    }
  }, []);

  // ── Lifecycle ──
  useEffect(() => {
    mounted.current = true;
    initLocation();
    return () => {
      mounted.current = false;
      stopCompass();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start the compass once we know where we are; stop it whenever the screen isn't visible.
  const hasPlace = !!place;
  useEffect(() => {
    havePlace.current = hasPlace;
    if (hasPlace && focused.current) startCompass();
  }, [hasPlace, startCompass]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (havePlace.current) startCompass();
      return () => {
        focused.current = false;
        stopCompass();
      };
    }, [startCompass, stopCompass]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (focused.current && havePlace.current) startCompass();
      } else {
        stopCompass();
      }
    });
    return () => sub.remove();
  }, [startCompass, stopCompass]);

  // ── Alignment (with hysteresis) and its haptic ──
  useEffect(() => {
    setAligned((prev) => (compassActive ? isFacingQibla(prev, bearing, heading) : false));
  }, [heading, bearing, compassActive]);

  useEffect(() => {
    if (aligned) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [aligned]);

  // ── Actions ──
  const handleRecalibrate = useCallback(async () => {
    if (calibrating) return;
    setCalibrating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    smoother.current.reset();
    await new Promise((r) => setTimeout(r, CALIBRATE_HINT_MS)); // let the figure-8 hint be read
    if (mounted.current && !magSub.current && !headSub.current) await startCompass();
    if (mounted.current) setCalibrating(false);
  }, [calibrating, startCompass]);

  const handleRetry = useCallback(() => {
    stopCompass();
    setMode('starting');
    setLoading(true);
    initLocation();
  }, [stopCompass, initLocation]);

  // ── Derived copy ──
  const guidance = turnGuidance(bearing, heading, aligned);
  const statusTitle = !compassActive
    ? t('qibla.fromNorth', { deg: Math.round(bearing) })
    : guidance.direction === 'aligned'
      ? t('qibla.facing')
      : t(guidance.direction === 'right' ? 'qibla.turnRight' : 'qibla.turnLeft', { deg: guidance.degrees });
  // With a live compass the title is guidance, so the line below adds the bearing; without one the
  // title already states the bearing, so the line carries only the distance.
  const info = compassActive
    ? t('qibla.info', { dir: getCompassDirection(bearing), deg: Math.round(bearing), km: formatKm(km) })
    : t('qibla.distance', { km: formatKm(km) });
  const hubValue = compassActive ? heading : bearing;
  const hint = calibrating
    ? t('qibla.calibrating')
    : mode === 'none'
      ? t('qibla.noCompassHint')
      : t('qibla.holdFlat');

  const headerAction = (
    <HeroIconButton
      icon={compassActive ? 'sync' : 'refresh'}
      label={t(compassActive ? 'qibla.recalibrate' : 'qibla.retry')}
      onPress={compassActive ? handleRecalibrate : handleRetry}
      disabled={calibrating}
    />
  );

  // ═════════════════ RENDER ═════════════════

  if (!place && (loading || !error)) {
    return (
      <View style={[s.root, { backgroundColor: theme.surface }]}>
        <ToolHero title={t('qibla.title')} onBack={goBack} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[s.loadingText, { color: theme.textSecondary }]}>{t('qibla.loading')}</Text>
        </View>
      </View>
    );
  }

  if (!place && error) {
    const denied = error === 'permission_denied';
    return (
      <View style={[s.root, { backgroundColor: theme.surface }]}>
        <ToolHero title={t('qibla.title')} onBack={goBack} />
        <View style={s.body}>
          <ToolStateCard
            icon={denied ? 'location-outline' : error === 'gps_unavailable' ? 'navigate-circle-outline' : 'alert-circle-outline'}
            title={t(denied ? 'qibla.permission.title' : error === 'gps_unavailable' ? 'qibla.gps.title' : 'qibla.unknown.title')}
            body={t(denied ? 'qibla.permission.body' : error === 'gps_unavailable' ? 'qibla.gps.body' : 'qibla.unknown.body')}
            primaryLabel={t('qibla.tryAgain')}
            onPrimary={handleRetry}
            secondaryLabel={denied ? t('qibla.openSettings') : undefined}
            onSecondary={denied ? () => Linking.openSettings().catch(() => {}) : undefined}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.surface }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
      >
        <ToolHero title={t('qibla.title')} onBack={goBack} right={headerAction}>
          <View style={s.status}>
            <View style={s.statusRow} accessibilityLiveRegion={aligned ? 'polite' : 'none'}>
              {aligned && <Ionicons name="checkmark-circle" size={24} color="#F6E27A" />}
              <Text style={[s.statusTitle, aligned && s.statusAligned]} numberOfLines={2}>
                {statusTitle}
              </Text>
            </View>
            <Text style={s.statusSub}>{info}</Text>
          </View>
        </ToolHero>

        <View style={s.dialWrap}>
          <CompassDial
            size={DIAL_SIZE}
            dialAnim={dialAnim}
            qiblaBearing={bearing}
            aligned={aligned}
            headingText={`${Math.round(hubValue)}°`}
            directionText={getCompassDirection(hubValue)}
            accessibilityLabel={t('qibla.a11y.dial', {
              heading: Math.round(hubValue),
              qibla: Math.round(bearing),
            })}
          />

          <View style={s.hintRow}>
            {calibrating && <ActivityIndicator size="small" color={theme.primary} style={s.hintSpinner} />}
            <Text style={[s.hint, { color: theme.textSecondary }]}>{hint}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 16, fontSize: 15, textAlign: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 24 },

  status: { alignItems: 'center', marginTop: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, color: '#FFFFFF', textAlign: 'center', marginHorizontal: 6 },
  statusAligned: { color: '#F6E27A' },
  statusSub: { marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.78)', textAlign: 'center' },

  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, minHeight: 24 },
  hintSpinner: { marginEnd: 8 },
  hint: { fontSize: 13, lineHeight: 19, textAlign: 'center', flexShrink: 1 },
});
