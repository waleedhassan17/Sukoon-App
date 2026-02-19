/**
 * PrayerTimesScreen - Beautiful prayer schedule
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { PrayerTimesService, PrayerTimesData } from '@/lib/prayerTimes';
import { SHADOWS, RADIUS } from '@/constants/theme';

const PRAYER_ICONS: Record<string, { icon: string; color: string }> = {
  Fajr: { icon: 'moon-outline', color: '#6366F1' },
  Sunrise: { icon: 'sunny-outline', color: '#F59E0B' },
  Dhuhr: { icon: 'sunny', color: '#EAB308' },
  Asr: { icon: 'partly-sunny-outline', color: '#F97316' },
  Maghrib: { icon: 'cloudy-night-outline', color: '#E76F51' },
  Isha: { icon: 'moon', color: '#8B5CF6' },
};

export default function PrayerTimesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [times, setTimes] = useState<PrayerTimesData | null>(null);
  const [nextPrayer, setNextPrayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('');
  const [locationError, setLocationError] = useState(false);
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    loadPrayerTimes();
  }, []);

  const formatLocationName = (geo: Location.LocationGeocodedAddress): string => {
    const city = geo.city || geo.district || geo.subregion || geo.region || '';
    const country = geo.country || '';
    
    if (city && country) {
      return `${city}, ${country}`;
    } else if (city) {
      return city;
    } else if (country) {
      return country;
    }
    return '';
  };

  // Use BigDataCloud API for accurate city-level reverse geocoding (free, no API key needed)
  const reverseGeocodeCity = async (lat: number, lng: number): Promise<string> => {
    try {
      // BigDataCloud free API - very accurate for city names
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      const data = await response.json();
      
      console.log('BigDataCloud response:', JSON.stringify(data)); // Debug
      
      if (data) {
        // BigDataCloud provides clean city name in 'city' or 'locality'
        const city = data.city || data.locality || data.principalSubdivision || '';
        const country = data.countryName || '';
        
        if (city && country) {
          return `${city}, ${country}`;
        } else if (city) {
          return city;
        } else if (country) {
          return country;
        }
      }
      return '';
    } catch (error) {
      console.error('BigDataCloud reverse geocoding error:', error);
      return '';
    }
  };

  // Fallback: OpenStreetMap Nominatim API
  const reverseGeocodeNominatim = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en&zoom=10`,
        {
          headers: {
            'User-Agent': 'SukoonApp/1.0',
            'Accept': 'application/json',
            'Accept-Language': 'en',
          },
        }
      );
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        const city = addr.city || addr.state_district || addr.county || addr.state || addr.town || '';
        const country = addr.country || '';
        
        if (city && country) {
          return `${city}, ${country}`;
        } else if (city) {
          return city;
        }
      }
      return '';
    } catch (error) {
      console.error('Nominatim reverse geocoding error:', error);
      return '';
    }
  };

  const loadPrayerTimes = async () => {
    setLoading(true);
    setLocationError(false);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | null = null;
      let lng: number | null = null;

      if (status === 'granted') {
        try {
          // Use highest accuracy and force fresh location (not cached)
          const loc = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Highest,
            timeInterval: 0, // Force fresh reading
            distanceInterval: 0,
          });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          
          // Store coordinates for display
          setCoordinates({ lat, lng });
          console.log('GPS Coordinates:', lat, lng); // Debug log
          
          // Try BigDataCloud first (most accurate for city names)
          let cityName = await reverseGeocodeCity(lat, lng);
          
          // Fallback to Nominatim if BigDataCloud fails
          if (!cityName) {
            cityName = await reverseGeocodeNominatim(lat, lng);
          }
          
          // Fallback to expo-location if both APIs fail
          if (!cityName) {
            try {
              const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
              if (geo) {
                cityName = formatLocationName(geo);
              }
            } catch {}
          }
          
          // Set the location name or show coordinates
          if (cityName) {
            setLocationName(cityName);
          } else {
            setLocationName(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
          }
        } catch (locError) {
          console.error('Location error:', locError);
          setLocationError(true);
          setLocationName('Location unavailable');
        }
      } else {
        setLocationError(true);
        setLocationName('Location permission denied');
      }

      // Only fetch prayer times if we have valid coordinates
      if (lat !== null && lng !== null) {
        const data = await PrayerTimesService.getByCoordinates(lat, lng);
        if (data) {
          setTimes(data);
          setNextPrayer(PrayerTimesService.getNextPrayer(data));
        }
      }
    } catch (e) {
      console.error('Prayer times error:', e);
      setLocationError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading prayer times...</Text>
        </SafeAreaView>
      </View>
    );
  }

  const prayers = times ? [
    { name: 'Fajr', time: times.Fajr },
    { name: 'Sunrise', time: times.Sunrise },
    { name: 'Dhuhr', time: times.Dhuhr },
    { name: 'Asr', time: times.Asr },
    { name: 'Maghrib', time: times.Maghrib },
    { name: 'Isha', time: times.Isha },
  ] : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Prayer Times</Text>
          <TouchableOpacity onPress={loadPrayerTimes} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Location & Date Card */}
          <View style={[styles.locationCard, { backgroundColor: theme.surface, borderColor: theme.borderLight }, SHADOWS.sm]}>
            <View style={styles.locationHeader}>
              <View style={[styles.locationIconWrap, { backgroundColor: locationError ? (theme.error || '#EF4444') + '15' : theme.primary + '15' }]}>
                <Ionicons 
                  name={locationError ? "warning-outline" : "location"} 
                  size={20} 
                  color={locationError ? theme.error || '#EF4444' : theme.primary} 
                />
              </View>
              <View style={styles.locationInfo}>
                <Text style={[styles.locationText, { color: locationError ? theme.error || '#EF4444' : theme.text }]}>
                  {locationName || 'Detecting location...'}
                </Text>
                {coordinates && (
                  <Text style={[styles.coordsText, { color: theme.textTertiary }]}>
                    {coordinates.lat.toFixed(4)}°N, {coordinates.lng.toFixed(4)}°E
                  </Text>
                )}
              </View>
            </View>
            {times?.date && (
              <View style={[styles.dateRow, { borderTopColor: theme.borderLight }]}>
                <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>{times.date}</Text>
              </View>
            )}
          </View>

          {/* Location Error Message */}
          {locationError && !times && (
            <View style={[styles.errorCard, { backgroundColor: theme.surface, borderColor: theme.error || '#EF4444' }]}>
              <Ionicons name="location-outline" size={48} color={theme.error || '#EF4444'} />
              <Text style={[styles.errorTitle, { color: theme.text }]}>Location Required</Text>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                Please enable location permissions to see accurate prayer times for your area.
              </Text>
              <TouchableOpacity 
                style={[styles.retryBtn, { backgroundColor: theme.primary }]} 
                onPress={loadPrayerTimes}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Next Prayer Highlight */}
          {nextPrayer && (
            <View style={[styles.nextCard, SHADOWS.lg]}>
              <LinearGradient colors={theme.headerGradient} style={styles.nextGradient}>
                <Text style={styles.nextLabel}>Next Prayer</Text>
                <Text style={styles.nextName}>{nextPrayer.name}</Text>
                <Text style={styles.nextTime}>{PrayerTimesService.formatTime(nextPrayer.time)}</Text>
              </LinearGradient>
            </View>
          )}

          {/* All Prayers */}
          <View style={styles.prayersList}>
            {prayers.map((prayer) => {
              const info = PRAYER_ICONS[prayer.name] || { icon: 'time-outline', color: theme.primary };
              const isNext = nextPrayer?.name === prayer.name;
              return (
                <View
                  key={prayer.name}
                  style={[
                    styles.prayerCard,
                    { backgroundColor: theme.surface, borderColor: isNext ? theme.primary : theme.borderLight },
                    SHADOWS.sm,
                    isNext && { borderWidth: 2 },
                  ]}
                >
                  <View style={[styles.prayerIcon, { backgroundColor: info.color + '15' }]}>
                    <Ionicons name={info.icon as any} size={22} color={info.color} />
                  </View>
                  <View style={styles.prayerInfo}>
                    <Text style={[styles.prayerName, { color: theme.text }]}>{prayer.name}</Text>
                    {isNext && <Text style={[styles.prayerBadge, { color: theme.primary }]}>Upcoming</Text>}
                  </View>
                  <Text style={[styles.prayerTime, { color: isNext ? theme.primary : theme.text }]}>
                    {PrayerTimesService.formatTime(prayer.time)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 14, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  refreshBtn: { padding: 8 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  locationCard: { 
    borderRadius: RADIUS.lg, 
    borderWidth: 1, 
    marginBottom: 20,
    overflow: 'hidden',
  },
  locationHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14,
    gap: 12,
  },
  locationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationText: { fontSize: 15, fontWeight: '600' },
  coordsText: { fontSize: 11, marginTop: 2 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  dateText: { fontSize: 13 },
  nextCard: { borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: 24 },
  nextGradient: { padding: 28, alignItems: 'center' },
  nextLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  nextName: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: 4 },
  nextTime: { color: 'rgba(255,255,255,0.9)', fontSize: 24, fontWeight: '600' },
  prayersList: { gap: 10 },
  prayerCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: RADIUS.lg, borderWidth: 1 },
  prayerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  prayerInfo: { flex: 1 },
  prayerName: { fontSize: 16, fontWeight: '600' },
  prayerBadge: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  prayerTime: { fontSize: 18, fontWeight: '700' },
  errorCard: { 
    alignItems: 'center', 
    padding: 32, 
    borderRadius: RADIUS.xl, 
    borderWidth: 1, 
    marginVertical: 20 
  },
  errorTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  errorText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  retryBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: RADIUS.lg, 
    gap: 8 
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
