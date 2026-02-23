/**
 * QiblahScreen - Beautiful compass with Qiblah direction
 * Integrated with AlAdhan API for accurate Qiblah bearing
 * 
 * Features:
 * - GPS location with permission handling (Android + iOS)
 * - AlAdhan Qiblah API integration with fallback
 * - Device magnetometer for compass heading
 * - Smooth animated needle rotation
 * - Compass heading labels (N, NE, E, etc.)
 * - Retry and recalibrate functionality
 * - Static fallback mode when compass unavailable
 * - Emulator detection
 * - Comprehensive error handling
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  ActivityIndicator, 
  Platform,
  TouchableOpacity,
  Easing,
  Vibration,
  Linking,
  PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { Magnetometer, DeviceMotion } from 'expo-sensors';
import { useTheme } from '@/contexts/ThemeContext';
import { SHADOWS, RADIUS } from '@/constants/theme';
import { 
  fetchQiblahCompass, 
  getCompassDirection, 
  calculateQiblahLocal,
  normalizeAngleDiff,
  QiblahData
} from '@/lib/qiblahService';

// Error types for specific handling (sensor_unavailable uses fallback, not error screen)
type ErrorType = 
  | 'permission_denied' 
  | 'gps_unavailable' 
  | 'api_failed' 
  | 'unknown';

interface QiblahError {
  type: ErrorType;
  message: string;
  canRetry: boolean;
}

// Magnetometer update interval in ms (lower = smoother but more battery)
const MAGNETOMETER_UPDATE_INTERVAL = 50;

// Alignment threshold in degrees
const ALIGNMENT_THRESHOLD = 10;

// Timeout (ms) to wait for sensor data before declaring it dead
const SENSOR_DATA_TIMEOUT = 3000;

// GPS heading update interval
const GPS_HEADING_INTERVAL = 500;

/**
 * Detect if running on emulator/simulator
 * Emulators typically don't have magnetometer sensors
 */
const isEmulator = (): boolean => {
  if (!Device.isDevice) {
    return true; // Running in Expo Go simulator or emulator
  }
  // Additional checks for common emulator indicators
  const brand = Device.brand?.toLowerCase() || '';
  const modelName = Device.modelName?.toLowerCase() || '';
  const deviceName = Device.deviceName?.toLowerCase() || '';
  
  const emulatorIndicators = ['sdk', 'emulator', 'simulator', 'genymotion', 'android sdk', 'google_sdk'];
  return emulatorIndicators.some(indicator => 
    brand.includes(indicator) || 
    modelName.includes(indicator) || 
    deviceName.includes(indicator)
  );
};

export default function QiblahScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  
  // State management
  const [heading, setHeading] = useState(0);
  const [manualHeading, setManualHeading] = useState(0); // For manual compass in static mode
  const [qiblahData, setQiblahData] = useState<QiblahData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Finding your location...');
  const [error, setError] = useState<QiblahError | null>(null);
  const [sensorAvailable, setSensorAvailable] = useState(true);
  const [sensorType, setSensorType] = useState<'magnetometer' | 'devicemotion' | 'gps' | 'none'>('none');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isRunningOnEmulator, setIsRunningOnEmulator] = useState(false);
  const [showCalibrationTip, setShowCalibrationTip] = useState(false);
  
  // Refs for cleanup and animation
  const magnetometerSubscription = useRef<any>(null);
  const deviceMotionSubscription = useRef<any>(null);
  const locationSubscription = useRef<any>(null);
  const sensorWatchdogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compassRotation = useRef(new Animated.Value(0)).current;
  const qiblahNeedleRotation = useRef(new Animated.Value(0)).current;
  const lastHeading = useRef(0);
  const compassCenterRef = useRef({ x: 0, y: 0 });
  const headingHistory = useRef<number[]>([]); // For smoothing
  const sensorAvailableRef = useRef(true); // Stable ref for PanResponder
  /** Ref to the compass View for accurate center measurement */
  const compassViewRef = useRef<View>(null);
  /** Track the previous touch angle for delta-based rotation */
  const prevTouchAngle = useRef<number | null>(null);
  /** Accumulated manual heading (survives across gestures) */
  const manualHeadingRef = useRef(0);
  
  /**
   * Pan responder for manual compass rotation in static mode.
   *
   * Design: delta-based rotation (not absolute position).
   * Each gesture computes the angle change from the previous touch point
   * relative to the compass center, then applies that delta to the
   * accumulated heading. This gives smooth, natural rotation without
   * jumps, jitter, or reversed direction.
   *
   * Uses sensorAvailableRef (not state) to avoid stale closures.
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !sensorAvailableRef.current,
      onMoveShouldSetPanResponder: () => !sensorAvailableRef.current,
      onPanResponderGrant: (evt) => {
        if (sensorAvailableRef.current) return;

        // Haptic feedback on touch start
        if (Platform.OS !== 'web') {
          Vibration.vibrate(10);
        }

        // Measure compass center accurately using pageX/pageY from the layout
        // (compassCenterRef is set in onLayout via measure())
        const { pageX, pageY } = evt.nativeEvent;
        const cx = compassCenterRef.current.x;
        const cy = compassCenterRef.current.y;

        // Record the initial touch angle so we can compute deltas
        const startAngle = Math.atan2(pageY - cy, pageX - cx) * (180 / Math.PI);
        prevTouchAngle.current = startAngle;
      },
      onPanResponderMove: (evt) => {
        if (sensorAvailableRef.current) return;
        if (prevTouchAngle.current === null) return;

        const { pageX, pageY } = evt.nativeEvent;
        const cx = compassCenterRef.current.x;
        const cy = compassCenterRef.current.y;

        // Current touch angle relative to compass center
        const currentAngle = Math.atan2(pageY - cy, pageX - cx) * (180 / Math.PI);

        // Delta since last touch point (handles 360°/0° wraparound)
        let delta = currentAngle - prevTouchAngle.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        // Apply delta to accumulated manual heading
        // Positive delta = clockwise touch movement = heading increases
        let newHeading = manualHeadingRef.current + delta;
        // Normalize to [0, 360)
        newHeading = ((newHeading % 360) + 360) % 360;

        manualHeadingRef.current = newHeading;
        prevTouchAngle.current = currentAngle;

        setManualHeading(newHeading);
        animateRotation(compassRotation, -newHeading, lastHeading.current);
        lastHeading.current = -newHeading;
      },
      onPanResponderRelease: () => {
        // Clear the previous angle so next gesture starts fresh
        prevTouchAngle.current = null;
      },
      onPanResponderTerminate: () => {
        prevTouchAngle.current = null;
      },
    })
  ).current;
  
  /**
   * Smoothly animate compass rotation
   * Uses shortest path calculation for natural rotation
   */
  const animateRotation = useCallback((
    animatedValue: Animated.Value, 
    toValue: number, 
    currentValue: number
  ) => {
    const diff = normalizeAngleDiff(currentValue, toValue);
    const newValue = currentValue + diff;
    
    Animated.timing(animatedValue, {
      toValue: newValue,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  /**
   * Apply smoothing to compass heading
   */
  const applySmoothing = useCallback((angle: number) => {
    const SMOOTHING_FACTOR = 5;
    headingHistory.current.push(angle);
    if (headingHistory.current.length > SMOOTHING_FACTOR) {
      headingHistory.current.shift();
    }
    
    // Circular mean for smooth heading (handles 359°/1° boundary)
    let sinSum = 0, cosSum = 0;
    for (const h of headingHistory.current) {
      sinSum += Math.sin(h * Math.PI / 180);
      cosSum += Math.cos(h * Math.PI / 180);
    }
    let smoothedAngle = Math.atan2(sinSum, cosSum) * (180 / Math.PI);
    if (smoothedAngle < 0) smoothedAngle += 360;
    
    setHeading(smoothedAngle);
    animateRotation(compassRotation, -smoothedAngle, lastHeading.current);
    lastHeading.current = -smoothedAngle;
  }, [animateRotation, compassRotation]);

  /**
   * Start compass sensor for heading
   * Tries Magnetometer → DeviceMotion → GPS heading → falls back to static mode
   * Includes watchdog timeout: if sensor says available but sends no data, auto-fallback
   */
  const startMagnetometer = useCallback(async () => {
    try {
      // Check if running on emulator first
      const onEmulator = isEmulator();
      setIsRunningOnEmulator(onEmulator);
      
      if (onEmulator) {
        if (__DEV__) console.log('Running on emulator - compass not available');
        setSensorAvailable(false);
        sensorAvailableRef.current = false;
        setSensorType('none');
        return false; // No error, just use static mode
      }
      
      // Reset heading history for smoothing
      headingHistory.current = [];
      
      // Helper: wait for first sensor data or timeout
      const waitForSensorData = (timeoutMs: number): Promise<boolean> => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve(false), timeoutMs);
          sensorWatchdogTimer.current = timer;
          // Store resolve so listener can trigger it
          (waitForSensorData as any)._resolve = (success: boolean) => {
            clearTimeout(timer);
            sensorWatchdogTimer.current = null;
            resolve(success);
          };
        });
      };
      
      let dataReceived = false;
      const markDataReceived = () => {
        if (!dataReceived) {
          dataReceived = true;
          if (sensorWatchdogTimer.current) {
            clearTimeout(sensorWatchdogTimer.current);
            sensorWatchdogTimer.current = null;
          }
        }
      };
      
      // Try DeviceMotion first on iOS (provides fused compass heading)
      if (Platform.OS === 'ios') {
        const deviceMotionAvailable = await DeviceMotion.isAvailableAsync();
        if (deviceMotionAvailable) {
          if (__DEV__) console.log('Using DeviceMotion for compass (iOS)');
          DeviceMotion.setUpdateInterval(MAGNETOMETER_UPDATE_INTERVAL);
          
          dataReceived = false;
          deviceMotionSubscription.current = DeviceMotion.addListener((data) => {
            markDataReceived();
            if (data.rotation) {
              let angle = (data.rotation.alpha * 180 / Math.PI);
              angle = ((angle % 360) + 360) % 360;
              applySmoothing(angle);
            }
          });
          
          // Wait for data with timeout
          const gotData = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(!dataReceived ? false : true), SENSOR_DATA_TIMEOUT);
            const checkInterval = setInterval(() => {
              if (dataReceived) {
                clearTimeout(timer);
                clearInterval(checkInterval);
                resolve(true);
              }
            }, 200);
            // Also clear interval on timeout
            setTimeout(() => clearInterval(checkInterval), SENSOR_DATA_TIMEOUT + 100);
          });
          
          if (gotData) {
            setSensorAvailable(true);
            sensorAvailableRef.current = true;
            setSensorType('devicemotion');
            return true;
          } else {
            // Sensor reported available but no data — clean up and try next
            if (__DEV__) console.log('DeviceMotion (iOS) reported available but no data received');
            if (deviceMotionSubscription.current) {
              deviceMotionSubscription.current.remove();
              deviceMotionSubscription.current = null;
            }
          }
        }
      }
      
      // Try Magnetometer
      const magnetometerAvailable = await Magnetometer.isAvailableAsync();
      
      if (magnetometerAvailable) {
        if (__DEV__) console.log('Trying Magnetometer for compass...');
        Magnetometer.setUpdateInterval(MAGNETOMETER_UPDATE_INTERVAL);
        
        dataReceived = false;
        magnetometerSubscription.current = Magnetometer.addListener((data) => {
          markDataReceived();
          let angle = Math.atan2(data.x, data.y) * (180 / Math.PI);
          if (angle < 0) angle += 360;
          if (Platform.OS === 'android') {
            angle = (360 - angle) % 360;
          }
          applySmoothing(angle);
        });
        
        // Wait for data with timeout
        const gotData = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), SENSOR_DATA_TIMEOUT);
          const checkInterval = setInterval(() => {
            if (dataReceived) {
              clearTimeout(timer);
              clearInterval(checkInterval);
              resolve(true);
            }
          }, 200);
          setTimeout(() => clearInterval(checkInterval), SENSOR_DATA_TIMEOUT + 100);
        });
        
        if (gotData) {
          if (__DEV__) console.log('Magnetometer providing data successfully');
          setSensorAvailable(true);
          sensorAvailableRef.current = true;
          setSensorType('magnetometer');
          return true;
        } else {
          if (__DEV__) console.log('Magnetometer reported available but no data received');
          if (magnetometerSubscription.current) {
            magnetometerSubscription.current.remove();
            magnetometerSubscription.current = null;
          }
        }
      }
      
      // Try DeviceMotion as Android fallback
      const deviceMotionAvailable = await DeviceMotion.isAvailableAsync();
      if (deviceMotionAvailable) {
        if (__DEV__) console.log('Trying DeviceMotion for compass (Android fallback)...');
        DeviceMotion.setUpdateInterval(MAGNETOMETER_UPDATE_INTERVAL);
        
        dataReceived = false;
        deviceMotionSubscription.current = DeviceMotion.addListener((data) => {
          if (data.rotation) {
            markDataReceived();
            let angle = (data.rotation.gamma * 180 / Math.PI);
            angle = ((angle % 360) + 360) % 360;
            applySmoothing(angle);
          }
        });
        
        // Wait for data with timeout
        const gotData = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), SENSOR_DATA_TIMEOUT);
          const checkInterval = setInterval(() => {
            if (dataReceived) {
              clearTimeout(timer);
              clearInterval(checkInterval);
              resolve(true);
            }
          }, 200);
          setTimeout(() => clearInterval(checkInterval), SENSOR_DATA_TIMEOUT + 100);
        });
        
        if (gotData) {
          if (__DEV__) console.log('DeviceMotion providing rotation data successfully');
          setSensorAvailable(true);
          sensorAvailableRef.current = true;
          setSensorType('devicemotion');
          return true;
        } else {
          if (__DEV__) console.log('DeviceMotion reported available but no rotation data');
          if (deviceMotionSubscription.current) {
            deviceMotionSubscription.current.remove();
            deviceMotionSubscription.current = null;
          }
        }
      }
      
      // GPS Heading Fallback — works when user is walking/moving
      if (__DEV__) console.log('No compass sensor available — trying GPS heading fallback...');
      try {
        const gpsStarted = await startGPSHeading();
        if (gpsStarted) {
          return true;
        }
      } catch (e) {
        if (__DEV__) console.log('GPS heading fallback failed:', e);
      }
      
      if (__DEV__) console.log('All compass methods failed — static mode');
      setSensorAvailable(false);
      sensorAvailableRef.current = false;
      setSensorType('none');
      return false;
      
    } catch (e) {
      console.error('Compass sensor error:', e);
      setSensorAvailable(false);
      sensorAvailableRef.current = false;
      setSensorType('none');
      return false;
    }
  }, [animateRotation, compassRotation]);

  /**
   * Start GPS-based heading as a fallback when no compass hardware exists
   * Uses Location.watchPositionAsync to compute heading from movement
   * The user needs to walk for this to work
   */
  const startGPSHeading = useCallback(async () => {
    try {
      // Check if we already have location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (__DEV__) console.log('GPS heading: location permission not granted');
        return false;
      }

      let lastCoords: { lat: number; lng: number } | null = null;
      let gpsDataReceived = false;

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 1, // Update every 1 meter moved
          timeInterval: GPS_HEADING_INTERVAL,
        },
        (location) => {
          const { latitude, longitude, heading: gpsHeading, speed } = location.coords;

          // Method 1: Use GPS-provided heading if available and device is moving
          if (gpsHeading != null && gpsHeading >= 0 && speed != null && speed > 0.5) {
            gpsDataReceived = true;
            applySmoothing(gpsHeading);
            return;
          }

          // Method 2: Compute bearing from consecutive GPS points
          if (lastCoords) {
            const dist = getDistanceMeters(lastCoords.lat, lastCoords.lng, latitude, longitude);
            if (dist > 2) { // Only update if moved at least 2 meters (reduce noise)
              const bearing = computeBearing(lastCoords.lat, lastCoords.lng, latitude, longitude);
              gpsDataReceived = true;
              applySmoothing(bearing);
              lastCoords = { lat: latitude, lng: longitude };
            }
          } else {
            lastCoords = { lat: latitude, lng: longitude };
          }
        }
      );

      // For GPS heading, set the sensor type immediately since it requires movement
      // We don't wait for data — instead we show "walk to activate" UI
      setSensorAvailable(true);
      sensorAvailableRef.current = true;
      setSensorType('gps');
      if (__DEV__) console.log('GPS heading mode activated — walk to get heading');
      return true;
    } catch (e) {
      if (__DEV__) console.log('GPS heading setup failed:', e);
      return false;
    }
  }, [applySmoothing]);

  /**
   * Compute bearing between two GPS coordinates (degrees from North)
   */
  const computeBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return ((brng % 360) + 360) % 360;
  };

  /**
   * Haversine distance between two GPS coordinates in meters
   */
  const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  /**
   * Stop all compass sensors and GPS heading
   */
  const stopMagnetometer = useCallback(() => {
    if (magnetometerSubscription.current) {
      magnetometerSubscription.current.remove();
      magnetometerSubscription.current = null;
    }
    if (deviceMotionSubscription.current) {
      deviceMotionSubscription.current.remove();
      deviceMotionSubscription.current = null;
    }
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (sensorWatchdogTimer.current) {
      clearTimeout(sensorWatchdogTimer.current);
      sensorWatchdogTimer.current = null;
    }
    setSensorType('none');
  }, []);

  /**
   * Fetch Qiblah direction - uses local calculation (fast & reliable)
   * with optional API validation
   */
  const fetchQiblahData = useCallback(async (latitude: number, longitude: number) => {
    try {
      setLoadingMessage('Calculating Qiblah direction...');
      
      // Use local calculation (accurate spherical geometry)
      const localDirection = calculateQiblahLocal(latitude, longitude);
      const qiblahInfo: QiblahData = {
        direction: localDirection,
        compassDirection: getCompassDirection(localDirection),
        latitude,
        longitude
      };
      
      setQiblahData(qiblahInfo);
      qiblahNeedleRotation.setValue(localDirection);
      
      // Optionally try API in background to validate (don't wait for it)
      fetchQiblahCompass(latitude, longitude)
        .then((apiData) => {
          // If API succeeds and differs significantly, log it
          const diff = Math.abs(apiData.direction - localDirection);
          if (diff > 1) {
            if (__DEV__) console.log(`API direction: ${apiData.direction}°, Local: ${localDirection}° (diff: ${diff.toFixed(2)}°)`);
          }
        })
        .catch(() => {
          // Silently ignore API errors since we have local calculation
        });
      
      return true;
    } catch (error) {
      if (__DEV__) console.error('Qiblah calculation error:', error);
      return false;
    }
  }, [qiblahNeedleRotation]);

  /**
   * Request location permission and get current position
   */
  const getLocation = useCallback(async () => {
    try {
      setLoadingMessage('Requesting location permission...');
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError({
          type: 'permission_denied',
          message: 'Location permission is required to determine Qiblah direction. Please enable location access in your device settings.',
          canRetry: true
        });
        return null;
      }
      
      setLoadingMessage('Getting your location...');
      
      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      
      if (!enabled) {
        setError({
          type: 'gps_unavailable',
          message: 'GPS is disabled. Please enable location services to use Qiblah finder.',
          canRetry: true
        });
        return null;
      }
      
      // Get current position with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 0
      });
      
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      };
      
      setUserLocation(coords);
      return coords;
      
    } catch (e: any) {
      console.error('Location error:', e);
      
      // Handle specific location errors
      if (e.code === 'ERR_LOCATION_SETTINGS_UNSATISFIED') {
        setError({
          type: 'gps_unavailable',
          message: 'Unable to get GPS signal. Please move to an open area and try again.',
          canRetry: true
        });
      } else {
        setError({
          type: 'unknown',
          message: 'Failed to get your location. Please check your GPS settings and try again.',
          canRetry: true
        });
      }
      
      return null;
    }
  }, []);

  /**
   * Main setup function - orchestrates location, API, and sensor initialization
   */
  const setup = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Get location
      const coords = await getLocation();
      if (!coords) {
        setLoading(false);
        return;
      }
      
      // Step 2: Fetch Qiblah direction
      const qiblahSuccess = await fetchQiblahData(coords.lat, coords.lng);
      if (!qiblahSuccess) {
        setLoading(false);
        return;
      }
      
      setLoading(false);
      
      // Step 3: Start compass sensor
      await startMagnetometer();
      
    } catch (e) {
      console.error('Setup error:', e);
      setError({
        type: 'unknown',
        message: 'An unexpected error occurred. Please try again.',
        canRetry: true
      });
      setLoading(false);
    }
  }, [getLocation, fetchQiblahData, startMagnetometer]);

  /**
   * Retry button handler
   */
  const handleRetry = useCallback(() => {
    stopMagnetometer();
    setup();
  }, [setup, stopMagnetometer]);

  /**
   * Recalibrate compass
   * Restarts magnetometer and optionally refreshes Qiblah data
   */
  const handleRecalibrate = useCallback(async () => {
    setIsCalibrating(true);
    
    // Provide haptic feedback
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
    
    // Stop current sensor
    stopMagnetometer();
    
    // Reset heading animation
    compassRotation.setValue(0);
    lastHeading.current = 0;
    
    // Brief pause to allow sensor reset
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Restart magnetometer
    await startMagnetometer();
    
    // Optionally refresh Qiblah data if we have location
    if (userLocation) {
      await fetchQiblahData(userLocation.lat, userLocation.lng);
    }
    
    setIsCalibrating(false);
    
    // Provide success feedback
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 50, 50, 50]);
    }
  }, [stopMagnetometer, startMagnetometer, compassRotation, userLocation, fetchQiblahData]);

  // Initialize on mount - using ref pattern to avoid stale closure
  const setupRef = useRef(setup);
  setupRef.current = setup;
  
  useEffect(() => {
    setupRef.current();
    return () => {
      stopMagnetometer();
    };
  }, [stopMagnetometer]);

  // Calculate derived values
  // In static mode, use manual heading; otherwise use sensor heading
  const effectiveHeading = sensorAvailable ? heading : manualHeading;
  const qiblahAngle = qiblahData?.direction ?? 0;
  const qiblahDirection = qiblahAngle - effectiveHeading;
  const normalizedQiblahDirection = ((qiblahDirection % 360) + 360) % 360;
  const isAligned = normalizedQiblahDirection < ALIGNMENT_THRESHOLD || 
                    normalizedQiblahDirection > (360 - ALIGNMENT_THRESHOLD);
  const compassHeadingLabel = getCompassDirection(effectiveHeading);
  const qiblahCompassLabel = qiblahData?.compassDirection ?? getCompassDirection(qiblahAngle);

  // Interpolate rotation for smooth animation
  const compassRotateInterpolate = compassRotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg']
  });

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.loadingWrap}>
          <View style={[styles.loadingCircle, { borderColor: theme.primary }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
          <Text style={[styles.loadingText, { color: theme.text }]}>{loadingMessage}</Text>
          <Text style={[styles.loadingSubtext, { color: theme.textSecondary }]}>
            Please ensure GPS is enabled
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>Qiblah Finder</Text>
            <View style={{ width: 38 }} />
          </View>
          
          <View style={styles.errorContainer}>
            <View style={[styles.errorIconWrap, { backgroundColor: `${theme.error}15` }]}>
              <Ionicons 
                name={error.type === 'permission_denied' ? 'location-outline' : 'warning-outline'} 
                size={56} 
                color={theme.error} 
              />
            </View>
            <Text style={[styles.errorTitle, { color: theme.text }]}>
              {error.type === 'permission_denied' ? 'Location Access Required' :
               error.type === 'gps_unavailable' ? 'GPS Unavailable' :
               'Something Went Wrong'}
            </Text>
            <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
              {error.message}
            </Text>
            
            {error.canRetry && (
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#FFF" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
            
            {error.type === 'permission_denied' && (
              <>
                <TouchableOpacity 
                  style={[styles.settingsButton, { borderColor: theme.primary }]}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={18} color={theme.primary} />
                  <Text style={[styles.settingsButtonText, { color: theme.primary }]}>
                    Open Settings
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.settingsHint, { color: theme.textTertiary }]}>
                  Enable location access for Sukoon app
                </Text>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Qiblah Finder</Text>
          {sensorAvailable ? (
            <TouchableOpacity 
              onPress={handleRecalibrate} 
              style={styles.calibrateBtn}
              disabled={isCalibrating}
            >
              <Ionicons 
                name="sync" 
                size={20} 
                color={isCalibrating ? theme.textTertiary : theme.primary} 
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleRetry} style={styles.calibrateBtn}>
              <Ionicons name="refresh" size={20} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Static Mode Banner (when compass unavailable) */}
        {!sensorAvailable && (
          <View style={[styles.staticModeBanner, { backgroundColor: theme.surface }]}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <View style={styles.staticModeTextContainer}>
              <Text style={[styles.staticModeTitle, { color: theme.text }]}>
                {isRunningOnEmulator ? 'Emulator Detected' : 'Static Direction Mode'}
              </Text>
              <Text style={[styles.staticModeSubtext, { color: theme.textSecondary }]}>
                {isRunningOnEmulator 
                  ? 'Compass not available on emulator. Drag compass to test.' 
                  : 'Drag the compass to simulate rotation.'}
              </Text>
            </View>
          </View>
        )}

        {/* GPS Heading Mode Banner */}
        {sensorAvailable && sensorType === 'gps' && (
          <View style={[styles.staticModeBanner, { backgroundColor: `${theme.primary}15` }]}>
            <Ionicons name="walk-outline" size={20} color={theme.primary} />
            <View style={styles.staticModeTextContainer}>
              <Text style={[styles.staticModeTitle, { color: theme.text }]}>
                GPS Compass Mode
              </Text>
              <Text style={[styles.staticModeSubtext, { color: theme.textSecondary }]}>
                Walk slowly to detect your heading direction.
              </Text>
            </View>
          </View>
        )}

        {/* Compass Heading Display */}
        <View style={styles.headingDisplay}>
          <Text style={[styles.headingDegree, { color: theme.text }]}>
            {Math.round(effectiveHeading)}°
          </Text>
          <Text style={[styles.headingLabel, { color: theme.primary }]}>
            {compassHeadingLabel}
          </Text>
          {!sensorAvailable && (
            <Text style={[styles.headingSubLabel, { color: theme.textTertiary }]}>
              (Manual)
            </Text>
          )}
          {sensorAvailable && sensorType === 'gps' && (
            <Text style={[styles.headingSubLabel, { color: theme.textTertiary }]}>
              (GPS — walk for accuracy)
            </Text>
          )}
        </View>

        <View style={styles.compassWrap}>
          {/* Calibration overlay */}
          {isCalibrating && sensorAvailable && (
            <View style={styles.calibratingOverlay}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.calibratingText, { color: theme.textSecondary }]}>
                Calibrating...
              </Text>
            </View>
          )}

          {/* Calibration tip popup - shows when sensor needs calibration */}
          {showCalibrationTip && sensorAvailable && (
            <View style={[styles.calibrationTipCard, { backgroundColor: theme.surface }, SHADOWS.lg]}>
              <View style={styles.calibrationTipHeader}>
                <Ionicons name="sync" size={24} color={theme.primary} />
                <Text style={[styles.calibrationTipTitle, { color: theme.text }]}>
                  Calibrate Your Compass
                </Text>
                <TouchableOpacity onPress={() => setShowCalibrationTip(false)}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.calibrationTipText, { color: theme.textSecondary }]}>
                Move your device in a figure-8 pattern several times to calibrate the compass sensor.
              </Text>
              <View style={styles.figure8Container}>
                <Text style={styles.figure8Icon}>∞</Text>
              </View>
            </View>
          )}

          {/* Main Compass */}
          <View 
            ref={compassViewRef}
            style={[
              styles.compassOuter, 
              { borderColor: isAligned ? theme.gold : 'rgba(128,128,128,0.2)' },
              isAligned && styles.compassAligned,
              !sensorAvailable && styles.compassInteractive
            ]}
            onLayout={() => {
              // Use measure() to get accurate absolute screen coordinates.
              // This avoids the fragile hard-coded offset that broke on
              // different devices/screen sizes.
              if (compassViewRef.current) {
                compassViewRef.current.measure((_x, _y, w, h, pageX, pageY) => {
                  compassCenterRef.current = {
                    x: pageX + w / 2,
                    y: pageY + h / 2,
                  };
                });
              }
            }}
            {...(!sensorAvailable ? panResponder.panHandlers : {})}
          >
            {/* Manual rotation hint for static mode */}
            {!sensorAvailable && (
              <View style={styles.dragHint}>
                <Ionicons name="hand-left" size={16} color={theme.textTertiary} />
                <Text style={[styles.dragHintText, { color: theme.textTertiary }]}>
                  Drag to rotate
                </Text>
              </View>
            )}
            
            {/* Compass ring with cardinal directions - rotates with device */}
            <Animated.View 
              style={[
                styles.compass, 
                { transform: [{ rotate: compassRotateInterpolate }] }
              ]}
            >
              {/* Cardinal direction markers */}
              <View style={styles.cardinalContainer}>
                <Text style={[styles.cardinal, styles.cardN, { color: theme.error }]}>N</Text>
                <Text style={[styles.cardinal, styles.cardNE, { color: theme.textTertiary }]}>NE</Text>
                <Text style={[styles.cardinal, styles.cardE, { color: theme.textTertiary }]}>E</Text>
                <Text style={[styles.cardinal, styles.cardSE, { color: theme.textTertiary }]}>SE</Text>
                <Text style={[styles.cardinal, styles.cardS, { color: theme.textTertiary }]}>S</Text>
                <Text style={[styles.cardinal, styles.cardSW, { color: theme.textTertiary }]}>SW</Text>
                <Text style={[styles.cardinal, styles.cardW, { color: theme.textTertiary }]}>W</Text>
                <Text style={[styles.cardinal, styles.cardNW, { color: theme.textTertiary }]}>NW</Text>
              </View>

              {/* Compass tick marks */}
              {Array.from({ length: 72 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tickMark,
                    {
                      transform: [{ rotate: `${i * 5}deg` }],
                      backgroundColor: i % 2 === 0 ? theme.textTertiary : 'transparent',
                      height: i % 9 === 0 ? 12 : 6,
                      opacity: i % 9 === 0 ? 0.8 : 0.4
                    }
                  ]}
                />
              ))}

              {/* Qiblah indicator - positioned relative to compass rotation */}
              <View style={[styles.qiblahIndicator, { transform: [{ rotate: `${qiblahAngle}deg` }] }]}>
                <View style={styles.qiblahArrow}>
                  <LinearGradient 
                    colors={['#D4AF37', '#B8941E']} 
                    style={styles.qiblahArrowInner}
                  >
                    <Text style={styles.kaabaIcon}>🕋</Text>
                  </LinearGradient>
                </View>
                {/* Direction line to Kaaba */}
                <View style={[styles.qiblahLine, { backgroundColor: theme.gold }]} />
              </View>
            </Animated.View>

            {/* Fixed center indicator - always points up (device direction) */}
            <View style={styles.centerIndicator}>
              <View style={[styles.centerArrow, { borderBottomColor: theme.primary }]} />
              <View style={[styles.centerDot, { backgroundColor: theme.primary }]} />
            </View>
          </View>

          {/* Status Card */}
          <View style={[styles.statusCard, { backgroundColor: theme.surface }, SHADOWS.md]}>
            <Ionicons 
              name={!sensorAvailable ? 'location' : sensorType === 'gps' ? 'walk-outline' : (isAligned ? 'checkmark-circle' : 'navigate-outline')} 
              size={28}
              color={isAligned && sensorAvailable ? theme.success : theme.primary} 
            />
            <View style={styles.statusTextContainer}>
              <Text style={[
                styles.statusText, 
                { color: isAligned && sensorAvailable ? theme.success : theme.text }
              ]}>
                {!sensorAvailable 
                  ? 'Qiblah Direction Found' 
                  : sensorType === 'gps'
                    ? (isAligned ? 'You are facing the Qiblah!' : 'Walk to detect your heading')
                    : (isAligned ? 'You are facing the Qiblah!' : 'Rotate towards the Kaaba')}
              </Text>
              <Text style={[styles.statusSubtext, { color: theme.textSecondary }]}>
                {!sensorAvailable
                  ? `Point your device ${qiblahCompassLabel} (${Math.round(qiblahAngle)}° from North)`
                  : `Qiblah is ${qiblahCompassLabel} (${Math.round(qiblahAngle)}°)`}
              </Text>
            </View>
          </View>

          {/* Direction Details */}
          <View style={styles.detailsRow}>
            <View style={[styles.detailCard, { backgroundColor: theme.surface }]}>
              <Ionicons name={sensorType === 'gps' ? 'navigate-outline' : 'compass-outline'} size={20} color={theme.primary} />
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                {sensorAvailable ? (sensorType === 'gps' ? 'GPS Heading' : 'Heading') : 'Manual Heading'}
              </Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {Math.round(effectiveHeading)}° {compassHeadingLabel}
              </Text>
            </View>
            <View style={[styles.detailCard, { backgroundColor: theme.surface }]}>
              <Text style={styles.kaabaSmall}>🕋</Text>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Qiblah Direction</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {Math.round(qiblahAngle)}° {qiblahCompassLabel}
              </Text>
            </View>
          </View>

          {/* Recalibrate Button - show when sensor or GPS is available */}
          {sensorAvailable && (
            <TouchableOpacity 
              style={[styles.recalibrateButton, { borderColor: theme.border }]}
              onPress={handleRecalibrate}
              disabled={isCalibrating}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-circle-outline" size={22} color={theme.primary} />
              <Text style={[styles.recalibrateText, { color: theme.primary }]}>
                {isCalibrating ? 'Calibrating...' : 'Recalibrate Compass'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Calibration tip - only when hardware sensor available (not GPS) */}
          {sensorAvailable && sensorType !== 'gps' && (
            <TouchableOpacity onPress={() => setShowCalibrationTip(true)}>
              <Text style={[styles.tipText, { color: theme.textTertiary }]}>
                Tip: Move your device in a figure-8 pattern to improve accuracy
              </Text>
            </TouchableOpacity>
          )}

          {/* GPS mode tip */}
          {sensorAvailable && sensorType === 'gps' && (
            <Text style={[styles.tipText, { color: theme.textTertiary }]}>
              Tip: Walk 5-10 steps in any direction, then turn towards the Qiblah indicator
            </Text>
          )}

          {/* Static mode instruction */}
          {!sensorAvailable && (
            <View style={[styles.staticInstructionCard, { backgroundColor: `${theme.primary}10` }]}>
              <Ionicons name="information-circle" size={20} color={theme.primary} />
              <Text style={[styles.staticInstructionText, { color: theme.text }]}>
                Qiblah is {Math.round(qiblahAngle)}° from North ({qiblahCompassLabel}). 
                Drag the compass above to simulate rotation, or use a physical compass. 
                Tap ↻ at the top to retry sensor detection.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  safeArea: { 
    flex: 1 
  },
  
  // Loading styles
  loadingWrap: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 40
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  loadingText: { 
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center'
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  
  // Header styles
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 10 
  },
  backBtn: { 
    padding: 8 
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700' 
  },
  calibrateBtn: {
    padding: 8
  },
  
  // Heading display
  headingDisplay: {
    alignItems: 'center',
    paddingVertical: 10
  },
  headingDegree: {
    fontSize: 36,
    fontWeight: '700'
  },
  headingLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 2
  },
  headingSubLabel: {
    fontSize: 12,
    marginTop: 2
  },
  
  // Compass wrapper
  compassWrap: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20 
  },
  
  // Calibrating overlay
  calibratingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  calibratingText: {
    marginTop: 10,
    fontSize: 14
  },
  
  // Compass outer ring
  compassOuter: { 
    width: 300, 
    height: 300, 
    borderRadius: 150, 
    borderWidth: 4, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.03)'
  },
  compassAligned: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10
  },
  compassInteractive: {
    borderStyle: 'dashed'
  },
  
  // Drag hint for manual rotation
  dragHint: {
    position: 'absolute',
    top: -30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10
  },
  dragHintText: {
    fontSize: 12
  },
  
  // Rotating compass
  compass: { 
    width: 280, 
    height: 280, 
    borderRadius: 140, 
    alignItems: 'center', 
    justifyContent: 'center'
  },
  cardinalContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%'
  },
  cardinal: { 
    position: 'absolute', 
    fontSize: 16, 
    fontWeight: '700',
    width: 30,
    textAlign: 'center'
  },
  cardN: { top: 12, left: '50%', marginLeft: -15 },
  cardNE: { top: 45, right: 30, fontSize: 12 },
  cardE: { right: 12, top: '50%', marginTop: -10 },
  cardSE: { bottom: 45, right: 30, fontSize: 12 },
  cardS: { bottom: 12, left: '50%', marginLeft: -15 },
  cardSW: { bottom: 45, left: 30, fontSize: 12 },
  cardW: { left: 12, top: '50%', marginTop: -10 },
  cardNW: { top: 45, left: 30, fontSize: 12 },
  
  // Tick marks
  tickMark: {
    position: 'absolute',
    width: 2,
    top: 5,
    left: '50%',
    marginLeft: -1,
    transformOrigin: 'center 135px'
  },
  
  // Qiblah indicator
  qiblahIndicator: { 
    position: 'absolute', 
    width: 280, 
    height: 280, 
    alignItems: 'center'
  },
  qiblahArrow: { 
    position: 'absolute', 
    top: 0
  },
  qiblahArrowInner: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    alignItems: 'center', 
    justifyContent: 'center',
    ...SHADOWS.md
  },
  kaabaIcon: { 
    fontSize: 24 
  },
  qiblahLine: {
    position: 'absolute',
    width: 2,
    height: 95,
    top: 44,
    opacity: 0.5
  },
  
  // Center indicator (fixed)
  centerIndicator: {
    position: 'absolute',
    alignItems: 'center'
  },
  centerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    top: -80
  },
  centerDot: { 
    width: 16, 
    height: 16, 
    borderRadius: 8,
    ...SHADOWS.sm
  },
  
  // Status card
  statusCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    paddingHorizontal: 20,
    paddingVertical: 16, 
    borderRadius: RADIUS.md, 
    marginTop: 30,
    width: '100%'
  },
  statusTextContainer: {
    flex: 1
  },
  statusText: { 
    fontSize: 16, 
    fontWeight: '600' 
  },
  statusSubtext: {
    fontSize: 13,
    marginTop: 2
  },
  
  // Details row
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%'
  },
  detailCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.sm,
    gap: 4
  },
  detailLabel: {
    fontSize: 12
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600'
  },
  kaabaSmall: {
    fontSize: 18
  },
  
  // Recalibrate button
  recalibrateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 20
  },
  recalibrateText: {
    fontSize: 15,
    fontWeight: '500'
  },
  
  // Tip text
  tipText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20
  },
  
  // Error styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  errorIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12
  },
  errorMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: RADIUS.md
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  },
  settingsHint: {
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center'
  },
  
  // Settings button for permission denied
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 12
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: '500'
  },
  
  // Static mode banner
  staticModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: RADIUS.md,
    gap: 12
  },
  staticModeTextContainer: {
    flex: 1
  },
  staticModeTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  staticModeSubtext: {
    fontSize: 12,
    marginTop: 2
  },
  
  // Calibration tip popup
  calibrationTipCard: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 100,
    borderRadius: RADIUS.lg,
    padding: 20
  },
  calibrationTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  calibrationTipTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600'
  },
  calibrationTipText: {
    fontSize: 14,
    lineHeight: 20
  },
  figure8Container: {
    alignItems: 'center',
    marginTop: 16
  },
  figure8Icon: {
    fontSize: 60,
    color: '#888',
    transform: [{ rotate: '90deg' }]
  },
  
  // Static instruction card
  staticInstructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: RADIUS.md,
    marginTop: 20,
    width: '100%'
  },
  staticInstructionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  }
});
