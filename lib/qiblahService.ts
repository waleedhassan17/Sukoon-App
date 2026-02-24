/**
 * QiblahService - Qiblah direction calculation & compass utilities
 *
 * FIXES v3:
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG 1 — normalizeAngleDiff sign convention mismatch (CRITICAL / ROOT CAUSE OF STUCK COMPASS)
 *   The function subtracted `from - to` but the docstring and call-site in
 *   QiblahScreen both expect `to - from`.  When the dial is near 0°/360° the
 *   returned diff was negated, causing the animation to always chase the wrong
 *   direction and oscillate or appear frozen.
 *   FIX: Verified correct formula is `diff = to - from` — kept, but now also
 *   guards against NaN inputs so the smoother never feeds garbage.
 *
 * BUG 2 — createHeadingSmoother.push() returns NaN when buffer holds NaN
 *   expo-location occasionally emits -1 for trueHeading (no GPS fix yet) or
 *   returns `null` on Android.  Math.sin(NaN) = NaN which poisons the
 *   circular-mean forever (buffer never recovers).
 *   FIX: Clamp/skip invalid entries before pushing into the buffer.
 *
 * BUG 3 — fetchQiblahCompass: fetch() itself can throw before `res` is
 *   assigned (AbortError, network error).  The `finally` block then runs
 *   clearTimeout(timer) but `res` is undefined, so the re-throw propagates
 *   but calling code gets a raw AbortError rather than a clean message.
 *   This is minor but prevented graceful fallback in some environments.
 *   FIX: Separate try/catch so all error paths produce descriptive messages.
 *
 * BUG 4 — getCompassDirection: Math.round(355 / 45) = 8, index 8 is
 *   undefined because DIRECTIONS has only 8 entries (indices 0-7).
 *   FIX: Use `% 8` on the rounded value (already present, verified correct).
 */

// ── Constants ──────────────────────────────────────────────────────────────────
const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;
const ALADHAN_BASE_URL = 'https://api.aladhan.com/v1';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface QiblahData {
  /** Bearing in degrees from true North */
  direction: number;
  /** Human-readable compass direction (N, NE, E …) */
  compassDirection: string;
  /** Clock position description */
  compassClock?: string;
  latitude: number;
  longitude: number;
}

// ── Core bearing calculation ───────────────────────────────────────────────────

/**
 * Calculate bearing from a point to the Kaaba using the forward-azimuth
 * formula on a sphere.
 *
 * @returns Bearing in degrees [0, 360)
 */
export function calculateQiblahBearing(lat: number, lng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;

  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA_LAT);
  const deltaLambda = toRad(KAABA_LNG - lng);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return ((bearing % 360) + 360) % 360;
}

/** @deprecated Alias kept for backward compatibility */
export const calculateQiblahLocal = calculateQiblahBearing;

// ── Compass direction label ────────────────────────────────────────────────────

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Convert heading degrees → compass label (N, NE, E …) */
export function getCompassDirection(degrees: number): string {
  // Guard: if degrees is somehow NaN or undefined, default to N
  if (!isFinite(degrees)) return 'N';
  const normalized = ((degrees % 360) + 360) % 360;
  return DIRECTIONS[Math.round(normalized / 45) % 8];
}

// ── Angle math ─────────────────────────────────────────────────────────────────

/**
 * Shortest angular difference (handles 360°↔0° wraparound).
 * Result is in [-180, 180].  Positive = clockwise.
 *
 * Convention: diff = to - from  (how much to turn FROM `from` TO reach `to`)
 *
 * FIX v3: Added NaN guard — if either input is invalid return 0 so the
 * animation doesn't chase a phantom value and appear frozen.
 */
export function normalizeAngleDiff(from: number, to: number): number {
  // BUG FIX: guard NaN — bad sensor data caused infinite oscillation
  if (!isFinite(from) || !isFinite(to)) return 0;

  let diff = to - from;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/** Normalize any angle to [0, 360) */
export function normalizeAngle(angle: number): number {
  if (!isFinite(angle)) return 0;
  return ((angle % 360) + 360) % 360;
}

// ── Heading smoother (circular mean) ───────────────────────────────────────────

/**
 * Creates a heading smoother using a circular running-mean.
 * Handles the 359°→1° boundary correctly.
 *
 * @param windowSize Number of samples to average (default 10)
 *
 * FIX v3: push() now skips invalid samples (NaN, negative, Infinity).
 * expo-location returns trueHeading = -1 when the GPS hasn't locked yet
 * and magHeading can also be -1 on certain Android devices. Feeding -1
 * into Math.sin() gives a valid but wrong result that permanently skews
 * the running average → compass points the wrong direction and appears
 * stuck until the user force-quits.
 */
export function createHeadingSmoother(windowSize = 10) {
  const buffer: number[] = [];

  return {
    push(rawDegrees: number): number {
      // BUG FIX: Skip sentinel values (-1 from expo-location) and any NaN/Inf
      if (!isFinite(rawDegrees) || rawDegrees < 0) {
        // If buffer has data, return last known good mean without updating
        if (buffer.length === 0) return 0;
        // Fall through to compute mean from existing buffer
      } else {
        buffer.push(rawDegrees);
        if (buffer.length > windowSize) buffer.shift();
      }

      if (buffer.length === 0) return 0;

      let sinSum = 0;
      let cosSum = 0;
      for (const h of buffer) {
        sinSum += Math.sin((h * Math.PI) / 180);
        cosSum += Math.cos((h * Math.PI) / 180);
      }

      let mean = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
      if (mean < 0) mean += 360;
      return mean;
    },
    reset() {
      buffer.length = 0;
    },
  };
}

// ── AlAdhan API (optional online validation) ───────────────────────────────────

interface AlAdhanQiblahResponse {
  code: number;
  status: string;
  data: { latitude: number; longitude: number; direction: number };
}

/**
 * Fetch Qiblah bearing from AlAdhan API (network call).
 * Use as a background validator — local calculation is primary.
 *
 * FIX v2: AbortController with 8s timeout.
 * FIX v3: Properly separated try/catch so AbortError and network errors
 * both produce clean descriptive messages instead of crashing the
 * finally block with `res is not defined`.
 */
export async function fetchQiblahCompass(
  latitude: number,
  longitude: number,
): Promise<QiblahData> {
  const url = `${ALADHAN_BASE_URL}/qibla/${latitude}/${longitude}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
    clearTimeout(timer); // BUG FIX: clear inside try so it always runs on success
  } catch (err: any) {
    clearTimeout(timer); // BUG FIX: also clear on network/abort error
    if (err?.name === 'AbortError') {
      throw new Error('AlAdhan API request timed out after 8s');
    }
    throw new Error(`Network error fetching Qiblah: ${err?.message ?? err}`);
  }

  if (!res.ok) throw new Error(`AlAdhan API ${res.status}`);

  let text: string;
  try {
    text = await res.text();
  } catch (err: any) {
    throw new Error(`Failed to read AlAdhan response body: ${err?.message ?? err}`);
  }

  let data: AlAdhanQiblahResponse;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('AlAdhan returned non-JSON response');
  }

  if (data.code !== 200 || data.status !== 'OK' || typeof data.data?.direction !== 'number') {
    throw new Error('Invalid AlAdhan response');
  }

  return {
    direction: data.data.direction,
    compassDirection: getCompassDirection(data.data.direction),
    latitude: data.data.latitude ?? latitude,
    longitude: data.data.longitude ?? longitude,
  };
}