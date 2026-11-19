/** Qibla maths: bearing, distance, heading conversion, alignment and guidance. */

import {
  ALIGN_ENTER_DEG,
  ALIGN_EXIT_DEG,
  calculateQiblahBearing,
  createHeadingSmoother,
  distanceToKaabaKm,
  getCompassDirection,
  isFacingQibla,
  KAABA,
  magnetometerToHeading,
  normalizeAngleDiff,
  turnGuidance,
} from '../lib/qiblahService';

/**
 * Independent implementation (3-D vectors) to cross-check the forward-azimuth
 * formula: take the great circle through the user and the Kaaba, find its tangent
 * at the user's position, and measure that tangent against local north.
 */
function vectorBearing(lat: number, lng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const toVec = (la: number, lo: number) => [
    Math.cos(r(la)) * Math.cos(r(lo)),
    Math.cos(r(la)) * Math.sin(r(lo)),
    Math.sin(r(la)),
  ];
  const cross = (u: number[], v: number[]) => [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

  const a = toVec(lat, lng);
  const b = toVec(KAABA.lat, KAABA.lng);
  const pole = [0, 0, 1];
  const east = cross(pole, a); // local east at the user
  const north = cross(a, east); // local north at the user
  const towardKaaba = cross(cross(a, b), a); // tangent at the user, along the great circle to the Kaaba
  const sign = dot(towardKaaba, b) >= 0 ? 1 : -1; // make sure it points toward, not away from, the Kaaba
  const t = towardKaaba.map((x) => x * sign);
  const bearing = (Math.atan2(dot(t, east), dot(t, north)) * 180) / Math.PI;
  return ((bearing % 360) + 360) % 360;
}

const CITIES: Record<string, [number, number]> = {
  Lahore: [31.5204, 74.3587], Karachi: [24.8607, 67.0011], Islamabad: [33.6844, 73.0479], Dhaka: [23.8103, 90.4125],
  Delhi: [28.6139, 77.209], Cairo: [30.0444, 31.2357], Istanbul: [41.0082, 28.9784], Tehran: [35.6892, 51.389],
  London: [51.5072, -0.1276], Paris: [48.8566, 2.3522], NewYork: [40.7128, -74.006], LosAngeles: [34.0522, -118.2437],
  Toronto: [43.6532, -79.3832], Jakarta: [-6.2088, 106.8456], KualaLumpur: [3.139, 101.6869], Tokyo: [35.6762, 139.6503],
  Sydney: [-33.8688, 151.2093], Johannesburg: [-26.2041, 28.0473], Lagos: [6.5244, 3.3792], SaoPaulo: [-23.5505, -46.6333],
  Moscow: [55.7558, 37.6173], Nairobi: [-1.2921, 36.8219],
};

describe('calculateQiblahBearing', () => {
  it.each(Object.entries(CITIES))('%s agrees with an independent vector calculation', (_name, [lat, lng]) => {
    const a = calculateQiblahBearing(lat, lng);
    const b = vectorBearing(lat, lng);
    const d = Math.abs(normalizeAngleDiff(a, b));
    expect(d).toBeLessThan(0.05);
  });

  it('matches well-known published bearings', () => {
    expect(Math.abs(calculateQiblahBearing(...CITIES.London) - 118.99)).toBeLessThan(0.6);
    expect(Math.abs(calculateQiblahBearing(...CITIES.NewYork) - 58.48)).toBeLessThan(0.6);
  });

  it('points broadly the right way from each region', () => {
    expect(calculateQiblahBearing(...CITIES.Lahore)).toBeGreaterThan(250); // west-south-west
    expect(calculateQiblahBearing(...CITIES.Lahore)).toBeLessThan(270);
    expect(calculateQiblahBearing(...CITIES.Jakarta)).toBeGreaterThan(285); // north-west
    expect(calculateQiblahBearing(...CITIES.Jakarta)).toBeLessThan(305);
    expect(calculateQiblahBearing(...CITIES.Cairo)).toBeGreaterThan(125); // south-east
    expect(calculateQiblahBearing(...CITIES.Cairo)).toBeLessThan(145);
  });

  it('always returns a value in [0, 360)', () => {
    for (const [lat, lng] of Object.values(CITIES)) {
      const b = calculateQiblahBearing(lat, lng);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe('distanceToKaabaKm', () => {
  it('is zero at the Kaaba and sensible elsewhere', () => {
    expect(distanceToKaabaKm(KAABA.lat, KAABA.lng)).toBeCloseTo(0, 3);
    expect(distanceToKaabaKm(...CITIES.London)).toBeGreaterThan(4750);
    expect(distanceToKaabaKm(...CITIES.London)).toBeLessThan(4850);
    expect(distanceToKaabaKm(...CITIES.NewYork)).toBeGreaterThan(10150);
    expect(distanceToKaabaKm(...CITIES.NewYork)).toBeLessThan(10350);
  });
});

describe('magnetometerToHeading (phone held flat)', () => {
  const B = 40;
  it('top of the phone toward north → 0°', () => expect(magnetometerToHeading(0, B)).toBeCloseTo(0, 5));
  it('top toward east → 90° (north is to the phone’s left)', () => expect(magnetometerToHeading(-B, 0)).toBeCloseTo(90, 5));
  it('top toward south → 180°', () => expect(magnetometerToHeading(0, -B)).toBeCloseTo(180, 5));
  it('top toward west → 270°', () => expect(magnetometerToHeading(B, 0)).toBeCloseTo(270, 5));
  it('returns NaN for bad sensor data so callers can skip it', () => {
    expect(magnetometerToHeading(NaN, 1)).toBeNaN();
    expect(magnetometerToHeading(1, Infinity)).toBeNaN();
  });
});

describe('angles', () => {
  it('normalizeAngleDiff takes the short way round', () => {
    expect(normalizeAngleDiff(350, 10)).toBe(20);
    expect(normalizeAngleDiff(10, 350)).toBe(-20);
    expect(normalizeAngleDiff(0, 180)).toBe(180);
    expect(normalizeAngleDiff(NaN, 10)).toBe(0);
  });

  it('getCompassDirection labels eight points and wraps at 360', () => {
    expect(getCompassDirection(0)).toBe('N');
    expect(getCompassDirection(90)).toBe('E');
    expect(getCompassDirection(225)).toBe('SW');
    expect(getCompassDirection(359)).toBe('N');
    expect(getCompassDirection(NaN)).toBe('N');
  });

  it('the heading smoother averages across the 359°→1° boundary', () => {
    const s = createHeadingSmoother(4);
    let m = 0;
    for (const h of [358, 359, 1, 2]) m = s.push(h);
    const off = Math.abs(normalizeAngleDiff(m, 0));
    expect(off).toBeLessThan(1);
  });

  it('the smoother ignores sentinel/invalid samples', () => {
    const s = createHeadingSmoother(4);
    s.push(100);
    expect(s.push(-1)).toBeCloseTo(100, 5);
    expect(s.push(NaN)).toBeCloseTo(100, 5);
  });
});

describe('isFacingQibla (hysteresis)', () => {
  it('enters only within the strict threshold', () => {
    expect(isFacingQibla(false, 100, 100 + ALIGN_ENTER_DEG)).toBe(true);
    expect(isFacingQibla(false, 100, 100 + ALIGN_ENTER_DEG + 1)).toBe(false);
  });
  it('stays aligned until clearly outside the wider threshold', () => {
    expect(isFacingQibla(true, 100, 100 + ALIGN_EXIT_DEG)).toBe(true);
    expect(isFacingQibla(true, 100, 100 + ALIGN_EXIT_DEG + 1)).toBe(false);
  });
  it('a reading hovering at 7° does not flicker', () => {
    let aligned = false;
    const seq = [3, 7, 6, 8, 7, 8, 6, 3];
    const out = seq.map((off) => (aligned = isFacingQibla(aligned, 100, 100 + off)));
    // enters at 3°, then stays aligned through 6–8°
    expect(out).toEqual([true, true, true, true, true, true, true, true]);
  });
  it('works across the 0°/360° seam', () => {
    expect(isFacingQibla(false, 358, 2)).toBe(true); // 4° apart
    expect(isFacingQibla(false, 2, 358)).toBe(true);
  });
});

describe('turnGuidance', () => {
  it('turn right when the Qibla is clockwise of where the phone points', () => {
    expect(turnGuidance(10, 350, false)).toEqual({ direction: 'right', degrees: 20 });
  });
  it('turn left when it is anticlockwise', () => {
    expect(turnGuidance(350, 10, false)).toEqual({ direction: 'left', degrees: 20 });
  });
  it('takes the short way round (never "turn 340° right")', () => {
    expect(turnGuidance(0, 270, false)).toEqual({ direction: 'right', degrees: 90 });
    expect(turnGuidance(0, 100, false)).toEqual({ direction: 'left', degrees: 100 });
  });
  it('aligned means hold still', () => {
    expect(turnGuidance(100, 101, true)).toEqual({ direction: 'aligned', degrees: 0 });
  });
});
