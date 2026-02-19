/**
 * TasbeehScreen - Premium digital dhikr counter
 */

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { SHADOWS, RADIUS } from '@/constants/theme';

const PRESETS = [
  { label: 'سُبْحَانَ اللَّهِ', eng: 'SubhanAllah', target: 33 },
  { label: 'الْحَمْدُ لِلَّهِ', eng: 'Alhamdulillah', target: 33 },
  { label: 'اللَّهُ أَكْبَرُ', eng: 'Allahu Akbar', target: 34 },
  { label: 'لَا إِلَٰهَ إِلَّا اللَّهُ', eng: 'La Ilaha IllAllah', target: 100 },
  { label: 'أَسْتَغْفِرُ اللَّهَ', eng: 'Astaghfirullah', target: 100 },
];

export default function TasbeehScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [sessions, setSessions] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  const preset = PRESETS[selectedPreset];

  const handleTap = () => {
    const newCount = count + 1;
    setCount(newCount);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 50, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();

    // Ripple
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    // Completion
    if (newCount >= preset.target) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSessions(s => s + 1);
      setCount(0);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCount(0);
  };

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
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <Ionicons name="refresh" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Dhikr Label */}
        <View style={styles.dhikrWrap}>
          <Text style={[styles.dhikrArabic, { color: theme.arabicText }]}>{preset.label}</Text>
          <Text style={[styles.dhikrEng, { color: theme.textSecondary }]}>{preset.eng}</Text>
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
          {sessions > 0 ? `${sessions} session${sessions > 1 ? 's' : ''} completed` : 'Tap the circle to count'}
        </Text>

        {/* Presets */}
        <View style={styles.presetsWrap}>
          <Text style={[styles.presetsTitle, { color: theme.text }]}>Dhikr Presets</Text>
          {PRESETS.map((p, i) => (
            <TouchableOpacity
              key={i}
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
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
  dhikrArabic: { fontSize: 28, lineHeight: 44, marginBottom: 4 },
  dhikrEng: { fontSize: 14 },
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
  presetsWrap: { flex: 1, paddingHorizontal: 20 },
  presetsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  presetCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: RADIUS.md, borderWidth: 1.5, marginBottom: 8 },
  presetArabic: { fontSize: 18, flex: 1 },
  presetInfo: { alignItems: 'flex-end' },
  presetEng: { fontSize: 12, marginBottom: 2 },
  presetTarget: { fontSize: 13, fontWeight: '700' },
});
