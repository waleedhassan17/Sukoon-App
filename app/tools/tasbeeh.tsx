/**
 * TasbeehScreen - Premium digital dhikr counter
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { SHADOWS, RADIUS } from '@/constants/theme';
import { DhikrTotalsMap, TasbeehStorage } from '@/lib/tasbeehStorage';

const PRESETS = [
  { id: 'subhanallah', label: 'سُبْحَانَ اللَّهِ', eng: 'SubhanAllah', target: 33 },
  { id: 'alhamdulillah', label: 'الْحَمْدُ لِلَّهِ', eng: 'Alhamdulillah', target: 33 },
  { id: 'allahu-akbar', label: 'اللَّهُ أَكْبَرُ', eng: 'Allahu Akbar', target: 34 },
  { id: 'la-ilaha-illallah', label: 'لَا إِلَٰهَ إِلَّا اللَّهُ', eng: 'La Ilaha IllAllah', target: 100 },
  { id: 'astaghfirullah', label: 'أَسْتَغْفِرُ اللَّهَ', eng: 'Astaghfirullah', target: 100 },
];

function formatNumber(n: number): string {
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

export default function TasbeehScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [sessionRounds, setSessionRounds] = useState(0);
  const [totals, setTotals] = useState<DhikrTotalsMap>({});
  const [totalsLoaded, setTotalsLoaded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef<DhikrTotalsMap | null>(null);

  const preset = PRESETS[selectedPreset];

  const queuePersistTotals = useCallback((nextTotals: DhikrTotalsMap) => {
    pendingPersistRef.current = nextTotals;
    if (persistTimerRef.current) return;

    persistTimerRef.current = setTimeout(async () => {
      const toSave = pendingPersistRef.current;
      pendingPersistRef.current = null;
      persistTimerRef.current = null;
      if (!toSave) return;
      await TasbeehStorage.saveTotals(toSave);
    }, 600);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await TasbeehStorage.loadTotals();
      if (!alive) return;
      setTotals(loaded);
      setTotalsLoaded(true);
    })();
    return () => {
      alive = false;
      // Flush any pending persistence
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (pendingPersistRef.current) {
        TasbeehStorage.saveTotals(pendingPersistRef.current).catch(() => {});
        pendingPersistRef.current = null;
      }
    };
  }, []);

  // Reset session count when switching dhikr
  useEffect(() => {
    setSessionRounds(0);
  }, [selectedPreset]);

  const currentTotals = useMemo(() => {
    return totals[preset.id] || { taps: 0, rounds: 0, updatedAt: 0 };
  }, [totals, preset.id]);

  const handleTap = useCallback(() => {
    const newCount = count + 1;
    const completed = newCount >= preset.target;

    setCount(completed ? 0 : newCount);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 50, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();

    // Ripple
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    // Persist lifetime totals (per dhikr)
    setTotals(prev => {
      const prevTotals = prev[preset.id] || { taps: 0, rounds: 0, updatedAt: 0 };
      const nextTotals: DhikrTotalsMap = {
        ...prev,
        [preset.id]: {
          taps: prevTotals.taps + 1,
          rounds: prevTotals.rounds + (completed ? 1 : 0),
          updatedAt: Date.now(),
        },
      };
      queuePersistTotals(nextTotals);
      return nextTotals;
    });

    // Completion
    if (completed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSessionRounds(s => s + 1);
    }
  }, [count, preset.id, preset.target, queuePersistTotals]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCount(0);
  }, []);

  const handleResetTotal = useCallback(() => {
    Alert.alert(
      'Reset lifetime total?',
      `This will clear the saved lifetime count for ${preset.eng}.` ,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setTotals(prev => {
              const next = { ...prev };
              next[preset.id] = { taps: 0, rounds: 0, updatedAt: Date.now() };
              queuePersistTotals(next);
              return next;
            });
          },
        },
      ]
    );
  }, [preset.eng, preset.id, queuePersistTotals]);

  const progress = count / preset.target;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Tasbeeh</Text>
          <TouchableOpacity
            onPress={handleReset}
            onLongPress={handleResetTotal}
            delayLongPress={350}
            style={styles.resetBtn}
          >
            <Ionicons name="refresh" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Dhikr Label */}
          <View style={styles.dhikrWrap}>
          <Text style={[styles.dhikrArabic, { color: theme.arabicText }]}>{preset.label}</Text>
          <Text style={[styles.dhikrEng, { color: theme.textSecondary }]}>{preset.eng}</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
              <Text style={[styles.statLabel, { color: theme.textTertiary }]}>LIFETIME</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {totalsLoaded ? formatNumber(currentTotals.taps) : '—'}
                <Text style={[styles.statUnit, { color: theme.textSecondary }]}> taps</Text>
              </Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
              <Text style={[styles.statLabel, { color: theme.textTertiary }]}>ROUNDS</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {totalsLoaded ? formatNumber(currentTotals.rounds) : '—'}
                <Text style={[styles.statUnit, { color: theme.textSecondary }]}> total</Text>
              </Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
              <Text style={[styles.statLabel, { color: theme.textTertiary }]}>SESSION</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatNumber(sessionRounds)}
                <Text style={[styles.statUnit, { color: theme.textSecondary }]}> rounds</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Counter */}
        <View style={styles.counterWrap}>
          <Animated.View style={[styles.counterOuter, { transform: [{ scale: scaleAnim }] }]}>
            {/* Ripple */}
            <Animated.View style={[styles.ripple, {
              opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
              transform: [{ scale: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            }]} />

            <TouchableOpacity onPress={handleTap} activeOpacity={0.85} style={styles.counterButton}>
              <LinearGradient colors={theme.headerGradient} style={styles.counterGradient}>
                {/* Progress Ring */}
                <View style={styles.progressRing}>
                  <View style={[styles.progressTrack, { borderColor: 'rgba(255,255,255,0.15)' }]} />
                  <View style={[styles.progressFill, {
                    borderColor: theme.gold,
                    borderTopColor: progress > 0.25 ? theme.gold : 'transparent',
                    borderRightColor: progress > 0.5 ? theme.gold : 'transparent',
                    borderBottomColor: progress > 0.75 ? theme.gold : 'transparent',
                    borderLeftColor: progress > 0 ? theme.gold : 'transparent',
                    transform: [{ rotate: `${progress * 360}deg` }],
                  }]} />
                </View>
                <Text style={styles.countText}>{count}</Text>
                <Text style={styles.targetText}>/ {preset.target}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Sessions */}
        <Text style={[styles.sessionsText, { color: theme.textSecondary }]}>
          {sessionRounds > 0
            ? `${sessionRounds} round${sessionRounds > 1 ? 's' : ''} completed this session`
            : 'Tap the circle to count'}
        </Text>

        {/* Presets */}
        <View style={styles.presetsWrap}>
          <Text style={[styles.presetsTitle, { color: theme.text }]}>Dhikr Presets</Text>
          {PRESETS.map((p, i) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.presetCard,
                { backgroundColor: theme.surface, borderColor: selectedPreset === i ? theme.primary : theme.borderLight },
                SHADOWS.sm,
              ]}
              onPress={() => { setSelectedPreset(i); setCount(0); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetArabic, { color: theme.arabicText }]}>{p.label}</Text>
              <View style={styles.presetInfo}>
                <Text style={[styles.presetEng, { color: theme.textSecondary }]}>{p.eng}</Text>
                <Text style={[styles.presetTarget, { color: theme.primary }]}>×{p.target}</Text>
                <Text style={[styles.presetTotal, { color: theme.textTertiary }]}>
                  Total {totalsLoaded ? formatNumber((totals[p.id]?.taps ?? 0)) : '—'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
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
  resetBtn: { padding: 8 },
  dhikrWrap: { alignItems: 'center', paddingVertical: 16 },
  dhikrArabic: { fontSize: 28, lineHeight: 44, marginBottom: 4, fontFamily: 'AlQalamQuran', writingDirection: 'rtl' },
  dhikrEng: { fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 96,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  statUnit: { fontSize: 11, fontWeight: '600' },
  counterWrap: { alignItems: 'center', paddingVertical: 20 },
  counterOuter: { width: 200, height: 200 },
  ripple: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(20,184,166,0.2)' },
  counterButton: { width: 200, height: 200, borderRadius: 100, overflow: 'hidden' },
  counterGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressRing: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  progressTrack: { position: 'absolute', width: '100%', height: '100%', borderRadius: 95, borderWidth: 3 },
  progressFill: { position: 'absolute', width: '100%', height: '100%', borderRadius: 95, borderWidth: 3 },
  countText: { color: '#fff', fontSize: 56, fontWeight: '800' },
  targetText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 2 },
  sessionsText: { textAlign: 'center', fontSize: 14, marginBottom: 20 },
  presetsWrap: { paddingHorizontal: 20 },
  presetsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  presetCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: RADIUS.md, borderWidth: 1.5, marginBottom: 8 },
  presetArabic: { fontSize: 18, flex: 1, fontFamily: 'AlQalamQuran', writingDirection: 'rtl' },
  presetInfo: { alignItems: 'flex-end' },
  presetEng: { fontSize: 12, marginBottom: 2 },
  presetTarget: { fontSize: 13, fontWeight: '700' },
  presetTotal: { fontSize: 11, marginTop: 6 },
});
