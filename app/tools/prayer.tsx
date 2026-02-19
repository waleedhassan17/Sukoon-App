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

  useEffect(() => {
    loadPrayerTimes();
  }, []);

  const loadPrayerTimes = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 31.5204, lng = 74.3587; // Default: Lahore

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (geo) setLocationName(`${geo.city || geo.district || ''}, ${geo.country || ''}`);
        } catch {}
      } else {
        setLocationName('Lahore, Pakistan');
      }

      const data = await PrayerTimesService.getByCoordinates(lat, lng);
      if (data) {
        setTimes(data);
        setNextPrayer(PrayerTimesService.getNextPrayer(data));
      }
    } catch (e) {
      console.error('Prayer times error:', e);
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
          {/* Location & Date */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.locationText, { color: theme.textSecondary }]}>{locationName || 'Unknown Location'}</Text>
          </View>
          {times?.date && <Text style={[styles.dateText, { color: theme.textTertiary }]}>{times.date}</Text>}

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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  locationText: { fontSize: 14 },
  dateText: { fontSize: 12, marginBottom: 20 },
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
});
