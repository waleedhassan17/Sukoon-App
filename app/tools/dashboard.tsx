/**
 * DashboardScreen - Spiritual wellness insights
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSavedVerses } from '@/contexts/SavedVersesContext';
import { ReadingProgress } from '@/lib/readingProgress';
import { SHADOWS, RADIUS } from '@/constants/theme';

export default function DashboardScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { savedVerses } = useSavedVerses();
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    ReadingProgress.getStreak().then(setStreak).catch(() => {});
    ReadingProgress.getReadingHistory().then(setHistory).catch(() => {});
  }, []);

  const totalAyahs = history.reduce((sum, d) => sum + d.ayahsRead, 0);
  const totalMinutes = history.reduce((sum, d) => sum + d.minutesRead, 0);
  const daysActive = history.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Insights</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.surface }, SHADOWS.md]}>
              <View style={[styles.statIcon, { backgroundColor: '#E76F5118' }]}>
                <Ionicons name="flame" size={24} color="#E76F51" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{streak}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Day Streak</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface }, SHADOWS.md]}>
              <View style={[styles.statIcon, { backgroundColor: '#40916C18' }]}>
                <Ionicons name="book" size={24} color="#40916C" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{totalAyahs}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ayahs Read</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface }, SHADOWS.md]}>
              <View style={[styles.statIcon, { backgroundColor: '#D4AF3718' }]}>
                <Ionicons name="bookmark" size={24} color="#D4AF37" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{savedVerses.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Saved Verses</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface }, SHADOWS.md]}>
              <View style={[styles.statIcon, { backgroundColor: '#9D4EDD18' }]}>
                <Ionicons name="calendar" size={24} color="#9D4EDD" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{daysActive}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Days Active</Text>
            </View>
          </View>

          {/* Reading History */}
          {history.length > 0 && (
            <View style={[styles.historyCard, { backgroundColor: theme.surface }, SHADOWS.md]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
              {history.slice(-7).reverse().map((day, i) => (
                <View key={i} style={[styles.historyRow, { borderBottomColor: theme.borderLight }]}>
                  <Text style={[styles.historyDate, { color: theme.textSecondary }]}>
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                  <View style={styles.historyStats}>
                    <Text style={[styles.historyStat, { color: theme.text }]}>{day.ayahsRead} ayahs</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {history.length === 0 && (
            <View style={styles.emptyWrap}>
              <Ionicons name="analytics-outline" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Start Your Journey</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Read the Quran to see your spiritual progress here
              </Text>
            </View>
          )}

          {/* Inspirational */}
          <View style={[styles.quoteCard, SHADOWS.md]}>
            <LinearGradient colors={theme.headerGradient} style={styles.quoteGradient}>
              <Text style={styles.quoteArabic}>وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ</Text>
              <Text style={styles.quoteEng}>"And He is with you wherever you are."</Text>
              <Text style={styles.quoteRef}>— Al-Hadid (57:4)</Text>
            </LinearGradient>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: '47%', alignItems: 'center', padding: 18, borderRadius: RADIUS.lg },
  statIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 12 },
  historyCard: { borderRadius: RADIUS.xl, padding: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  historyDate: { fontSize: 13 },
  historyStats: { flexDirection: 'row', gap: 10 },
  historyStat: { fontSize: 13, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  quoteCard: { borderRadius: RADIUS.xl, overflow: 'hidden' },
  quoteGradient: { padding: 24, alignItems: 'center' },
  quoteArabic: { fontSize: 22, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 10 },
  quoteEng: { fontSize: 15, color: '#fff', textAlign: 'center', fontStyle: 'italic', lineHeight: 24, marginBottom: 8 },
  quoteRef: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
});
