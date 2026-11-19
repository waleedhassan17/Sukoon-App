/**
 * Human-readable place names for display only.
 *
 * Prayer times never depend on this — they are computed from coordinates. The
 * name is a nicety, resolved best-effort over the network with short timeouts,
 * and the UI falls back to correctly-signed coordinates ("31.52°N, 74.36°E")
 * when it can't be found (offline, blocked, rate-limited).
 */

import * as Location from 'expo-location';

/** "31.52°N, 74.36°E" — hemisphere-correct (the old screen hard-coded N/E). */
export function formatCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lng).toFixed(2)}°${ew}`;
}

async function fetchJson(url: string, headers: Record<string, string>, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function join(city: string, country: string): string {
  if (city && country) return `${city}, ${country}`;
  return city || country || '';
}

/**
 * City, Country for a coordinate. Waterfall: BigDataCloud → Nominatim →
 * expo-location. Returns '' when nothing could be resolved.
 */
export async function resolveLocationName(lat: number, lng: number, timeoutMs = 6000): Promise<string> {
  // 1. BigDataCloud (accurate, free, no key)
  try {
    const d = await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { Accept: 'application/json' },
      timeoutMs,
    );
    const name = join(d?.city || d?.locality || d?.principalSubdivision || '', d?.countryName || '');
    if (name) return name;
  } catch {}

  // 2. Nominatim
  try {
    const d = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en&zoom=10`,
      { 'User-Agent': 'SukoonApp/1.0', Accept: 'application/json' },
      timeoutMs,
    );
    const a = d?.address;
    if (a) {
      const name = join(a.city || a.state_district || a.county || a.state || a.town || '', a.country || '');
      if (name) return name;
    }
  } catch {}

  // 3. Platform geocoder
  try {
    const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (geo) {
      const name = join(geo.city || geo.district || geo.subregion || geo.region || '', geo.country || '');
      if (name) return name;
    }
  } catch {}

  return '';
}
