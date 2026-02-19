/**
 * QiblahService - AlAdhan API integration for Qiblah direction
 * 
 * API Endpoints:
 * - Qiblah Direction: https://api.aladhan.com/v1/qibla/{latitude}/{longitude}
 * - Compass Enhanced: https://api.aladhan.com/v1/qibla/{latitude}/{longitude}/compass
 */

const ALADHAN_BASE_URL = 'https://api.aladhan.com/v1';

export interface QiblahResponse {
  code: number;
  status: string;
  data: {
    latitude: number;
    longitude: number;
    direction: number;  // Bearing in degrees toward Kaaba
  };
}

export interface QiblahCompassResponse {
  code: number;
  status: string;
  data: {
    latitude: number;
    longitude: number;
    direction: number;
    compass: {
      direction: string;       // e.g., "NE", "E", "SE"
      degree: number;
      clock: string;           // Clock direction e.g., "2 o'clock"
    };
  };
}

export interface QiblahData {
  direction: number;           // Bearing in degrees
  compassDirection?: string;   // Human-readable direction (NE, E, etc.)
  compassClock?: string;       // Clock position (e.g., "2 o'clock")
  latitude: number;
  longitude: number;
}

/**
 * Fetches Qiblah direction from AlAdhan API
 * @param latitude User's latitude
 * @param longitude User's longitude
 * @returns QiblahData with direction and coordinates
 */
export async function fetchQiblahDirection(
  latitude: number,
  longitude: number
): Promise<QiblahData> {
  const url = `${ALADHAN_BASE_URL}/qibla/${latitude}/${longitude}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'identity', // Request uncompressed response
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data: QiblahResponse = await response.json();

    if (data.code !== 200 || data.status !== 'OK') {
      throw new Error('API returned an error response');
    }

    return {
      direction: data.data.direction,
      latitude: data.data.latitude,
      longitude: data.data.longitude,
    };
  } catch (error) {
    console.error('Error fetching Qiblah direction:', error);
    throw error;
  }
}

/**
 * Fetches enhanced Qiblah compass data from AlAdhan API
 * Includes human-readable compass direction and clock position
 * @param latitude User's latitude
 * @param longitude User's longitude
 * @returns QiblahData with full compass information
 */
export async function fetchQiblahCompass(
  latitude: number,
  longitude: number
): Promise<QiblahData> {
  // Use the basic qibla endpoint as /compass may have issues
  // We'll calculate compass direction locally for reliability
  const url = `${ALADHAN_BASE_URL}/qibla/${latitude}/${longitude}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'identity', // Request uncompressed response
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    // Get response as text first to handle potential encoding issues
    const responseText = await response.text();
    
    // Try to parse JSON
    let data: QiblahResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse API response:', responseText.substring(0, 100));
      throw new Error('Invalid JSON response from API');
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }

    if (data.code !== 200 || data.status !== 'OK') {
      throw new Error('API returned an error response');
    }

    if (!data.data || typeof data.data.direction !== 'number') {
      throw new Error('Missing direction data in response');
    }

    // Calculate compass direction locally
    const compassDir = getCompassDirection(data.data.direction);

    return {
      direction: data.data.direction,
      compassDirection: compassDir,
      latitude: data.data.latitude ?? latitude,
      longitude: data.data.longitude ?? longitude,
    };
  } catch (error) {
    console.error('Error fetching Qiblah compass data:', error);
    throw error;
  }
}

/**
 * Converts heading degrees to compass direction label
 * @param degrees Heading in degrees (0-360)
 * @returns Compass direction string (N, NE, E, SE, S, SW, W, NW)
 */
export function getCompassDirection(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Calculates angle difference for smooth rotation
 * Handles the 360° wraparound to find shortest rotation path
 * @param from Starting angle
 * @param to Target angle
 * @returns Normalized angle difference (-180 to 180)
 */
export function normalizeAngleDiff(from: number, to: number): number {
  let diff = to - from;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Local Qiblah calculation as fallback when API is unavailable
 * Uses spherical geometry to calculate bearing to Kaaba
 * @param lat User's latitude
 * @param lng User's longitude
 * @returns Bearing in degrees to Kaaba
 */
export function calculateQiblahLocal(lat: number, lng: number): number {
  const KAABA_LAT = 21.4225;
  const KAABA_LNG = 39.8262;
  
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const kaabaLatR = (KAABA_LAT * Math.PI) / 180;
  const kaabaLngR = (KAABA_LNG * Math.PI) / 180;
  
  const dLng = kaabaLngR - lngR;
  const y = Math.sin(dLng) * Math.cos(kaabaLatR);
  const x = Math.cos(latR) * Math.sin(kaabaLatR) - 
            Math.sin(latR) * Math.cos(kaabaLatR) * Math.cos(dLng);
  
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}
