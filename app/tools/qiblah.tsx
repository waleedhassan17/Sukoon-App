/**
 * QiblahScreen – Production-ready Qiblah Compass
 *
 * Sensors:  expo-sensors Magnetometer (primary)
 * Location: expo-location (foreground, high accuracy)
 * Bearing:  Great-circle (forward-azimuth) formula
 * Animation: React Native Animated API (native driver)
 *
 * Works in Expo Go AND production EAS builds.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Vibration,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { useTheme } from '@/contexts/ThemeContext';
import { SHADOWS, RADIUS } from '@/constants/theme';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Kaaba coordinates (Makkah, Saudi Arabia) */
const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

/** Compass dial dimensions */
const SCREEN_WIDTH = Dimensions.get('window').width;
const COMPASS_SIZE = Math.min(SCREEN_WIDTH - 60, 300);
const COMPASS_RADIUS = COMPASS_SIZE / 2;

/** Magnetometer update interval (ms) — ~30 fps */
const SENSOR_INTERVAL_MS = 33;

/** Alignment threshold — degrees within which user is "facing Qiblah" */
const ALIGNMENT_THRESHOLD = 8;

/** Heading smoother window size */
const SMOOTHER_WINDOW = 8;

/** Animation duration for dial rotation (ms) */
const ANIM_DURATION = 120;

// ═══════════════════════════════════════════════════════════════════════════════
// PURE HELPERS (no React — extracted for testability)
// ═══════════════════════════════════════════════════════════════════════════════

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Calculate compass heading from raw magnetometer data.
 *   heading = atan2(y, x) × (180 / π)
 *   Normalize to [0, 360)
 */
function magnetometerToHeading(x: number, y: number): number {
  let heading = Math.atan2(y, x) * (180 / Math.PI);
  if (heading < 0) heading += 360;
  return heading;
}

/**
 * Calculate Qiblah bearing using the great-circle (forward-azimuth) formula.
 *
 *   Δlong = lon₂ − lon₁
 *   θ = atan2(
 *       sin(Δlong) × cos(lat₂),
 *       cos(lat₁) × sin(lat₂) − sin(lat₁) × cos(lat₂) × cos(Δlong)
 *   )
 *   Normalize to [0, 360)
 */
function calculateQiblahBearing(userLat: number, userLon: number): number {
  const phi1 = toRad(userLat);
  const phi2 = toRad(KAABA_LAT);
  const deltaLambda = toRad(KAABA_LON - userLon);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  let bearing = toDeg(Math.atan2(y, x));
  return ((bearing % 360) + 360) % 360;
}

/**
 * Compass direction label (N, NE, E, SE, S, SW, W, NW)
 */
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
function getCompassDirection(deg: number): string {
  if (!isFinite(deg)) return 'N';
  const norm = ((deg % 360) + 360) % 360;
  return DIRECTIONS[Math.round(norm / 45) % 8];
}

/**
 * Shortest angular difference [-180, 180].
 * Positive = clockwise from 'from' to 'to'.
 */
function angleDiff(from: number, to: number): number {
  if (!isFinite(from) || !isFinite(to)) return 0;
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * Circular-mean heading smoother.
 * Uses sin/cos averaging to handle the 359 to 1 boundary correctly.
 */
function createSmoother(windowSize: number) {
  const buf: number[] = [];
  return {
    push(deg: number): number {
      if (!isFinite(deg) || deg < 0) {
        return buf.length > 0 ? this._mean() : 0;
      }
      buf.push(deg);
      if (buf.length > windowSize) buf.shift();
      return this._mean();
    },
    _mean(): number {
      let sinSum = 0, cosSum = 0;
      for (const h of buf) {
        sinSum += Math.sin(toRad(h));
        cosSum += Math.cos(toRad(h));
      }
      let m = toDeg(Math.atan2(sinSum, cosSum));
      if (m < 0) m += 360;
      return m;
    },
    reset() {
      buf.length = 0;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

type AppError = {
  kind: 'permission_denied' | 'gps_unavailable' | 'sensor_unavailable' | 'unknown';
  message: string;
};

export default function QiblahScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [heading, setHeading] = useState(0);
  const [qiblahBearing, setQiblahBearing] = useState(0);
  const [qiblahDirection, setQiblahDirection] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState('Finding your location…');
  const [error, setError] = useState<AppError | null>(null);
  const [compassActive, setCompassActive] = useState(false);
  const [sensorMode, setSensorMode] = useState<'magnetometer' | 'heading' | 'none'>('none');
  const [calibrating, setCalibrating] = useState(false);
  const [showCalibTip, setShowCalibTip] = useState(false);

  // ── Refs (avoid re-renders on every sensor tick) ───────────────────────────
  const dialAnim = useRef(new Animated.Value(0)).current;
  const lastAnimVal = useRef(0);
  const smootherRef = useRef(createSmoother(SMOOTHER_WINDOW));
  const sensorSubRef = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);
  const headingSubRef = useRef<{ remove: () => void } | null>(null);
  const mountedRef = useRef(true);
  const wasAligned = useRef(false);

  // ── Animate dial (shortest-path, native driver) ────────────────────────────
  const animateDial = useCallback(
    (headingDeg: number) => {
      // Dial rotates OPPOSITE to device heading (compass-rose convention)
      const target = -headingDeg;
      const diff = angleDiff(lastAnimVal.current, target);
      const newVal = lastAnimVal.current + diff;
      lastAnimVal.current = newVal;

      Animated.timing(dialAnim, {
        toValue: newVal,
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [dialAnim],
  );

  // ── Apply heading from any source (validates before smoothing) ─────────────
  const applyHeading = useCallback(
    (raw: number) => {
      if (!isFinite(raw) || raw < 0) return;
      const smoothed = smootherRef.current.push(raw);
      if (mountedRef.current) {
        setHeading(smoothed);
        animateDial(smoothed);
      }
    },
    [animateDial],
  );

  // ── Start compass: Magnetometer → watchHeadingAsync fallback ───────────────
  const startCompass = useCallback(async (): Promise<boolean> => {
    // Clean up any existing subscriptions
    sensorSubRef.current?.remove(); sensorSubRef.current = null;
    headingSubRef.current?.remove(); headingSubRef.current = null;

    // ── Strategy 1: Try Magnetometer (subscribe and wait for actual data) ──
    try {
      const gotData = { value: false };

      Magnetometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      const sub = Magnetometer.addListener(({ x, y }) => {
        gotData.value = true;
        applyHeading(magnetometerToHeading(x, y));
      });

      // Wait up to 3 seconds for the first data tick
      const dataArrived = await new Promise<boolean>((resolve) => {
        let resolved = false;
        const iv = setInterval(() => {
          if ((gotData.value || !mountedRef.current) && !resolved) {
            resolved = true; clearInterval(iv); resolve(gotData.value);
          }
        }, 100);
        setTimeout(() => {
          if (!resolved) { resolved = true; clearInterval(iv); resolve(gotData.value); }
        }, 3000);
      });

      if (dataArrived && mountedRef.current) {
        sensorSubRef.current = sub;
        setCompassActive(true);
        setSensorMode('magnetometer');
        if (__DEV__) console.log('[Qiblah] ✓ Magnetometer active');
        return true;
      }

      // No data — clean up and try next strategy
      sub.remove();
      if (__DEV__) console.log('[Qiblah] ✗ Magnetometer: no data, trying watchHeadingAsync…');
    } catch (err) {
      sensorSubRef.current?.remove(); sensorSubRef.current = null;
      if (__DEV__) console.warn('[Qiblah] ✗ Magnetometer threw:', err);
    }

    if (!mountedRef.current) return false;

    // ── Strategy 2: Location.watchHeadingAsync (uses device compass via OS) ──
    try {
      const gotData = { value: false };

      const sub = await Location.watchHeadingAsync((headingObj) => {
        let h: number;
        if (headingObj.trueHeading >= 0) {
          h = headingObj.trueHeading;
        } else if (headingObj.magHeading >= 0) {
          h = headingObj.magHeading;
        } else {
          return; // skip sentinel values
        }
        gotData.value = true;
        applyHeading(h);
      });

      // Wait up to 3 seconds for valid heading data
      const dataArrived = await new Promise<boolean>((resolve) => {
        let resolved = false;
        const iv = setInterval(() => {
          if ((gotData.value || !mountedRef.current) && !resolved) {
            resolved = true; clearInterval(iv); resolve(gotData.value);
          }
        }, 100);
        setTimeout(() => {
          if (!resolved) { resolved = true; clearInterval(iv); resolve(gotData.value); }
        }, 3000);
      });

      if (dataArrived && mountedRef.current) {
        headingSubRef.current = sub;
        setCompassActive(true);
        setSensorMode('heading');
        if (__DEV__) console.log('[Qiblah] ✓ watchHeadingAsync active');
        return true;
      }

      sub.remove();
      if (__DEV__) console.log('[Qiblah] ✗ watchHeadingAsync: no valid data');
    } catch (err) {
      headingSubRef.current?.remove(); headingSubRef.current = null;
      if (__DEV__) console.warn('[Qiblah] ✗ watchHeadingAsync threw:', err);
    }

    // ── No sensor available ──
    if (mountedRef.current) {
      setCompassActive(false);
      setSensorMode('none');
    }
    return false;
  }, [applyHeading]);

  // ── Stop all compass subscriptions ─────────────────────────────────────────
  const stopCompass = useCallback(() => {
    sensorSubRef.current?.remove(); sensorSubRef.current = null;
    headingSubRef.current?.remove(); headingSubRef.current = null;
    if (mountedRef.current) {
      setCompassActive(false);
      setSensorMode('none');
    }
  }, []);

  // ── Get user location ──────────────────────────────────────────────────────
  const fetchLocation = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    // 1. Request permission
    if (mountedRef.current) setLoadMsg('Requesting location permission…');
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      if (mountedRef.current) {
        setError({
          kind: 'permission_denied',
          message:
            'Location permission is required to calculate the Qiblah direction. Please allow location access in your device settings.',
        });
      }
      return null;
    }

    // 2. Check GPS enabled
    if (mountedRef.current) setLoadMsg('Getting your location…');
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      if (mountedRef.current) {
        setError({
          kind: 'gps_unavailable',
          message: 'GPS is turned off. Please enable location services to use the Qiblah Finder.',
        });
      }
      return null;
    }

    // 3. Get coordinates (high accuracy)
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return { lat: loc.coords.latitude, lon: loc.coords.longitude };
  }, []);

  // ── Main initialization ────────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // Step 1: Get user coordinates
      const coords = await fetchLocation();
      if (!coords || !mountedRef.current) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      // Step 2: Calculate Qiblah bearing
      if (mountedRef.current) setLoadMsg('Calculating Qiblah direction…');
      const bearing = calculateQiblahBearing(coords.lat, coords.lon);
      const direction = getCompassDirection(bearing);

      if (mountedRef.current) {
        setQiblahBearing(bearing);
        setQiblahDirection(direction);
        setLoading(false);
      }

      // Step 3: Start compass sensors
      const sensorOk = await startCompass();
      if (!sensorOk && mountedRef.current) {
        setError({
          kind: 'sensor_unavailable',
          message:
            'Compass sensor is not available on this device. The Qiblah direction is shown but the compass cannot track your heading.',
        });
      }
    } catch (err: any) {
      if (__DEV__) console.warn('[Qiblah] init error:', err);
      if (mountedRef.current) {
        setError({
          kind: 'unknown',
          message: 'Something went wrong. Please try again.',
        });
        setLoading(false);
      }
    }
  }, [fetchLocation, startCompass]);

  // ── Recalibrate ────────────────────────────────────────────────────────────
  const handleRecalibrate = useCallback(async () => {
    if (mountedRef.current) setCalibrating(true);
    if (Platform.OS !== 'web') Vibration.vibrate(40);

    // Reset smoother to flush stale averaged data (subscription stays alive)
    smootherRef.current.reset();

    // Brief visual pause
    await new Promise((r) => setTimeout(r, 600));

    // If subscription died, restart it
    if (!sensorSubRef.current && !headingSubRef.current) {
      await startCompass();
    }

    if (mountedRef.current) setCalibrating(false);
    if (Platform.OS !== 'web') Vibration.vibrate([0, 30, 40, 30]);
  }, [startCompass]);

  // ── Retry (full re-init) ───────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    stopCompass();
    initialize();
  }, [stopCompass, initialize]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    initialize();

    return () => {
      mountedRef.current = false;
      sensorSubRef.current?.remove(); sensorSubRef.current = null;
      headingSubRef.current?.remove(); headingSubRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const relativeQiblah = ((qiblahBearing - heading) % 360 + 360) % 360;
  const isAligned =
    relativeQiblah <= ALIGNMENT_THRESHOLD || relativeQiblah >= 360 - ALIGNMENT_THRESHOLD;
  const compassLabel = getCompassDirection(heading);

  // ── Alignment haptic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isAligned && !wasAligned.current && compassActive) {
      if (Platform.OS !== 'web') Vibration.vibrate(60);
    }
    wasAligned.current = isAligned;
  }, [isAligned, compassActive]);

  // ── Animated interpolation ─────────────────────────────────────────────────
  const dialRotate = dialAnim.interpolate({
    inputRange: [-36000, 36000],
    outputRange: ['-36000deg', '36000deg'],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.centered}>
          <View style={[styles.loadingRing, { borderColor: theme.primary }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
          <Text style={[styles.loadingTitle, { color: theme.text }]}>{loadMsg}</Text>
          <Text style={[styles.loadingSub, { color: theme.textSecondary }]}>
            Please ensure GPS is enabled
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // ── Error state (location / GPS errors — not sensor) ───────────────────────
  if (error && error.kind !== 'sensor_unavailable') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.flex1}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Qiblah Finder</Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Error body */}
          <View style={styles.centered}>
            <View style={[styles.errorIcon, { backgroundColor: theme.error + '15' }]}>
              <Ionicons
                name={
                  error.kind === 'permission_denied'
                    ? 'location-outline'
                    : 'warning-outline'
                }
                size={56}
                color={theme.error}
              />
            </View>
            <Text style={[styles.errorTitle, { color: theme.text }]}>
              {error.kind === 'permission_denied'
                ? 'Location Access Required'
                : error.kind === 'gps_unavailable'
                ? 'GPS Unavailable'
                : 'Something Went Wrong'}
            </Text>
            <Text style={[styles.errorMsg, { color: theme.textSecondary }]}>
              {error.message}
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>

            {error.kind === 'permission_denied' && (
              <>
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: theme.primary }]}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={18} color={theme.primary} />
                  <Text style={[styles.outlineBtnText, { color: theme.primary }]}>
                    Open Settings
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.hintText, { color: theme.textTertiary }]}>
                  Enable location access for Sukoon
                </Text>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Main compass UI ────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.flex1}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Qiblah Finder</Text>
          {compassActive ? (
            <TouchableOpacity
              onPress={handleRecalibrate}
              style={styles.headerBtn}
              disabled={calibrating}
            >
              <Ionicons
                name="sync"
                size={20}
                color={calibrating ? theme.textTertiary : theme.primary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleRetry} style={styles.headerBtn}>
              <Ionicons name="refresh" size={20} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sensor-unavailable banner ── */}
        {!compassActive && error?.kind === 'sensor_unavailable' && (
          <View style={[styles.banner, { backgroundColor: theme.warning + '15' }]}>
            <Ionicons name="alert-circle" size={20} color={theme.warning} />
            <View style={styles.bannerBody}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>
                Compass not available
              </Text>
              <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
                Showing static Qiblah direction relative to North
              </Text>
            </View>
          </View>
        )}

        {/* ── Calibration unstable banner ── */}
        {compassActive && calibrating && (
          <View style={[styles.banner, { backgroundColor: theme.primary + '15' }]}>
            <ActivityIndicator size="small" color={theme.primary} />
            <View style={styles.bannerBody}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>Calibrating…</Text>
              <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
                Move your phone in a figure-8 pattern
              </Text>
            </View>
          </View>
        )}

        {/* ── Heading readout ── */}
        <View style={styles.headingRow}>
          <Text style={[styles.headingDeg, { color: theme.text }]}>
            {Math.round(heading)}°
          </Text>
          <Text style={[styles.headingDir, { color: theme.primary }]}>{compassLabel}</Text>
        </View>

        {/* ── Compass ── */}
        <View style={styles.compassArea}>
          {/* Outer ring */}
          <View
            style={[
              styles.compassOuter,
              {
                borderColor: isAligned && compassActive
                  ? theme.gold
                  : 'rgba(128,128,128,0.18)',
              },
              isAligned && compassActive && styles.compassGlow,
            ]}
          >
            {/* Calibration overlay */}
            {calibrating && (
              <View style={styles.calibOverlay}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.calibOverlayText, { color: theme.textSecondary }]}>
                  Calibrating…
                </Text>
              </View>
            )}

            {/* Rotating dial */}
            <Animated.View
              style={[styles.dial, { transform: [{ rotate: dialRotate }] }]}
            >
              {/* Cardinal direction labels */}
              <View style={styles.cardinals}>
                <Text style={[styles.card, styles.cardN, { color: theme.error }]}>N</Text>
                <Text style={[styles.card, styles.cardNE, { color: theme.textTertiary }]}>NE</Text>
                <Text style={[styles.card, styles.cardE, { color: theme.textTertiary }]}>E</Text>
                <Text style={[styles.card, styles.cardSE, { color: theme.textTertiary }]}>SE</Text>
                <Text style={[styles.card, styles.cardS, { color: theme.textTertiary }]}>S</Text>
                <Text style={[styles.card, styles.cardSW, { color: theme.textTertiary }]}>SW</Text>
                <Text style={[styles.card, styles.cardW, { color: theme.textTertiary }]}>W</Text>
                <Text style={[styles.card, styles.cardNW, { color: theme.textTertiary }]}>NW</Text>
              </View>

              {/* Tick marks (72 ticks = every 5 degrees) */}
              {Array.from({ length: 72 }).map((_, i) => {
                const isMajor = i % 9 === 0; // every 45 degrees
                const tickH = isMajor ? 14 : 6;
                const pivot = COMPASS_RADIUS - 4;
                return (
                  <View
                    key={i}
                    style={[
                      styles.tickWrapper,
                      {
                        transform: [
                          { rotate: i * 5 + 'deg' },
                          { translateY: -pivot },
                        ],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.tick,
                        {
                          height: tickH,
                          backgroundColor: isMajor
                            ? theme.textSecondary
                            : theme.textTertiary,
                          opacity: isMajor ? 0.9 : 0.35,
                        },
                      ]}
                    />
                  </View>
                );
              })}

              {/* Qiblah indicator (Kaaba) on the dial */}
              <View
                style={[
                  styles.qiblahPointer,
                  { transform: [{ rotate: qiblahBearing + 'deg' }] },
                ]}
              >
                <View style={styles.qiblahIconWrap}>
                  <LinearGradient
                    colors={['#D4AF37', '#B8941E']}
                    style={styles.qiblahGradient}
                  >
                    <Text style={styles.kaabaEmoji}>🕋</Text>
                  </LinearGradient>
                </View>
                <View style={[styles.qiblahLine, { backgroundColor: theme.gold }]} />
              </View>
            </Animated.View>

            {/* Fixed center indicator (always points up = user facing direction) */}
            <View style={styles.centerPointer}>
              <View style={[styles.centerArrow, { borderBottomColor: theme.primary }]} />
              <View style={[styles.centerDot, { backgroundColor: theme.primary }]} />
            </View>
          </View>

          {/* ── Calibration tip card ── */}
          {showCalibTip && compassActive && (
            <View
              style={[styles.calibCard, { backgroundColor: theme.surface }, SHADOWS.lg]}
            >
              <View style={styles.calibCardHeader}>
                <Ionicons name="sync" size={22} color={theme.primary} />
                <Text style={[styles.calibCardTitle, { color: theme.text }]}>
                  Calibrate Compass
                </Text>
                <TouchableOpacity onPress={() => setShowCalibTip(false)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.calibCardBody, { color: theme.textSecondary }]}>
                Move your phone in a figure-8 pattern several times to improve compass accuracy.
              </Text>
              <Text style={styles.figure8}>∞</Text>
            </View>
          )}

          {/* ── Status card ── */}
          <View style={[styles.statusCard, { backgroundColor: theme.surface }, SHADOWS.md]}>
            <Ionicons
              name={
                !compassActive
                  ? 'location'
                  : isAligned
                  ? 'checkmark-circle'
                  : 'navigate-outline'
              }
              size={28}
              color={isAligned && compassActive ? theme.success : theme.primary}
            />
            <View style={styles.statusBody}>
              <Text
                style={[
                  styles.statusTitle,
                  {
                    color: isAligned && compassActive ? theme.success : theme.text,
                  },
                ]}
              >
                {!compassActive
                  ? 'Qiblah Direction Found'
                  : isAligned
                  ? 'You are facing the Qiblah!'
                  : 'Rotate towards the Kaaba'}
              </Text>
              <Text style={[styles.statusSub, { color: theme.textSecondary }]}>
                Qiblah is {qiblahDirection} ({Math.round(qiblahBearing)}°)
              </Text>
            </View>
          </View>

          {/* ── Detail row ── */}
          <View style={styles.detailRow}>
            <View style={[styles.detailCard, { backgroundColor: theme.surface }]}>
              <Ionicons name="compass-outline" size={20} color={theme.primary} />
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Heading</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {Math.round(heading)}° {compassLabel}
              </Text>
            </View>
            <View style={[styles.detailCard, { backgroundColor: theme.surface }]}>
              <Text style={styles.kaabaSmall}>🕋</Text>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Qiblah</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {Math.round(qiblahBearing)}° {qiblahDirection}
              </Text>
            </View>
          </View>

          {/* ── Recalibrate button ── */}
          {compassActive && (
            <TouchableOpacity
              style={[styles.recalBtn, { borderColor: theme.border }]}
              onPress={handleRecalibrate}
              disabled={calibrating}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-circle-outline" size={22} color={theme.primary} />
              <Text style={[styles.recalText, { color: theme.primary }]}>
                {calibrating ? 'Calibrating…' : 'Recalibrate Compass'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Calibration tip ── */}
          {compassActive && (
            <TouchableOpacity onPress={() => setShowCalibTip(true)}>
              <Text style={[styles.tipText, { color: theme.textTertiary }]}>
                💡 Move phone in figure-8 to calibrate compass
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Static fallback ── */}
          {!compassActive && (
            <View style={[styles.staticCard, { backgroundColor: theme.primary + '10' }]}>
              <Ionicons name="information-circle" size={20} color={theme.primary} />
              <Text style={[styles.staticText, { color: theme.text }]}>
                Qiblah is {Math.round(qiblahBearing)}° from North ({qiblahDirection}).
                Use a physical compass or tap ↻ to retry sensor detection.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  // ── Loading ──
  loadingRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  loadingSub: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700' },

  // ── Banner ──
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: RADIUS.md,
    gap: 12,
  },
  bannerBody: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '600' },
  bannerSub: { fontSize: 12, marginTop: 2 },

  // ── Heading readout ──
  headingRow: { alignItems: 'center', paddingVertical: 6 },
  headingDeg: { fontSize: 36, fontWeight: '700' },
  headingDir: { fontSize: 18, fontWeight: '600', marginTop: 2 },

  // ── Compass area ──
  compassArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  // ── Compass outer ring ──
  compassOuter: {
    width: COMPASS_SIZE + 10,
    height: COMPASS_SIZE + 10,
    borderRadius: (COMPASS_SIZE + 10) / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.03)',
  },
  compassGlow: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },

  // ── Rotating dial ──
  dial: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardinals: { position: 'absolute', width: '100%', height: '100%' },
  card: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '700',
    width: 30,
    textAlign: 'center',
  },
  cardN: { top: 10, left: '50%', marginLeft: -15 },
  cardNE: { top: 42, right: 28, fontSize: 12 },
  cardE: { right: 10, top: '50%', marginTop: -10 },
  cardSE: { bottom: 42, right: 28, fontSize: 12 },
  cardS: { bottom: 10, left: '50%', marginLeft: -15 },
  cardSW: { bottom: 42, left: 28, fontSize: 12 },
  cardW: { left: 10, top: '50%', marginTop: -10 },
  cardNW: { top: 42, left: 28, fontSize: 12 },

  // ── Tick marks ──
  tickWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tick: {
    width: 2,
    borderRadius: 1,
  },

  // ── Qiblah pointer (on dial) ──
  qiblahPointer: {
    position: 'absolute',
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    alignItems: 'center',
  },
  qiblahIconWrap: { position: 'absolute', top: -2 },
  qiblahGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  kaabaEmoji: { fontSize: 24 },
  qiblahLine: {
    position: 'absolute',
    width: 2,
    height: 90,
    top: 42,
    opacity: 0.45,
  },

  // ── Center pointer (fixed) ──
  centerPointer: { position: 'absolute', alignItems: 'center' },
  centerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    top: -76,
  },
  centerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    ...SHADOWS.sm,
  },

  // ── Status card ──
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    marginTop: 28,
    width: '100%',
  },
  statusBody: { flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: '600' },
  statusSub: { fontSize: 13, marginTop: 2 },

  // ── Detail row ──
  detailRow: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  detailCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  kaabaSmall: { fontSize: 18 },

  // ── Recalibrate ──
  recalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 20,
  },
  recalText: { fontSize: 15, fontWeight: '500' },

  // ── Tip ──
  tipText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },

  // ── Error ──
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMsg: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 12,
  },
  outlineBtnText: { fontSize: 15, fontWeight: '500' },
  hintText: { fontSize: 13, marginTop: 20, textAlign: 'center' },

  // ── Calibration overlay ──
  calibOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 9999,
  },
  calibOverlayText: { marginTop: 10, fontSize: 14 },

  // ── Calibration tip card ──
  calibCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    padding: 20,
    marginTop: 16,
  },
  calibCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  calibCardTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  calibCardBody: { fontSize: 14, lineHeight: 20 },
  figure8: {
    fontSize: 56,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    transform: [{ rotate: '90deg' }],
  },

  // ── Static fallback ──
  staticCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: RADIUS.md,
    marginTop: 20,
    width: '100%',
  },
  staticText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
