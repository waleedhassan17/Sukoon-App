/**
 * SettingsScreen - App Configuration
 * Refined design matching Sukoon aesthetic system
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { QuranService } from '@/lib/quranService';

/* ─── Staggered entry hook ─── */
function useStaggeredEntry(count: number, baseDelay = 70) {
  const opacities = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  const slides = useRef(Array.from({ length: count }, () => new Animated.Value(16))).current;

  useEffect(() => {
    const animations = opacities.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: i * baseDelay + 200,
          useNativeDriver: true,
        }),
        Animated.timing(slides[i], {
          toValue: 0,
          duration: 400,
          delay: i * baseDelay + 200,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(0, animations).start();
  }, []);

  return opacities.map((opacity, i) => ({ opacity, transform: [{ translateY: slides[i] }] }));
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, mode, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [dailyAyah, setDailyAyah] = useState(true);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  // 4 section groups + credits + closing card = 6
  const sectionAnims = useStaggeredEntry(6, 80);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Clear all cached data? Your saved verses will be kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        onPress: () => {
          QuranService.clearCache();
          Alert.alert('Done', 'Cache cleared successfully');
        },
      },
    ]);
  };

  const switchTrack = { false: theme.border, true: theme.primaryMuted };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ═══════════════ HEADER ═══════════════ */}
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          {/* Decorative circles */}
          <View style={styles.headerPattern}>
            {[...Array(5)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.patternCircle,
                  {
                    width: 100 + i * 50,
                    height: 100 + i * 50,
                    top: -10 + i * 8,
                    right: -30 + i * 12,
                    opacity: 0.03 + i * 0.008,
                  },
                ]}
              />
            ))}
          </View>

          <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="settings-outline" size={18} color="#fff" />
              </View>
            </View>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSub}>Customize your Sukoon experience</Text>
          </Animated.View>
        </LinearGradient>

        <View style={styles.body}>

          {/* ═══════════════ APPEARANCE ═══════════════ */}
          <Animated.View style={sectionAnims[0]}>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>APPEARANCE</Text>
            <View style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted + '14' }]}>  
                    <Ionicons
                      name={mode === 'dark' ? 'moon' : 'sunny'}
                      size={18}
                      color={theme.primaryMuted}
                    />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>Dark Mode</Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{mode === 'dark' ? 'Currently on' : 'Currently off'}</Text>
                  </View>
                </View>
                <Switch
                  value={mode === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={switchTrack}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </Animated.View>

          {/* ═══════════════ NOTIFICATIONS ═══════════════ */}
          <Animated.View style={sectionAnims[1]}>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>NOTIFICATIONS</Text>
            <View style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
              {/* Push */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.accent + '14' }]}>
                    <Ionicons name="notifications-outline" size={18} color={theme.accent} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>Push Notifications</Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Receive daily reminders</Text>
                  </View>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={switchTrack}
                  thumbColor="#fff"
                />
              </View>

              <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

              {/* Daily Ayah */}
              <View style={[styles.row, !notifications && styles.rowDisabled]}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.accent + '14' }]}>
                    <Ionicons name="book-outline" size={18} color={theme.accent} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: theme.text }, !notifications && { color: theme.textTertiary }]}>
                      Daily Ayah
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }, !notifications && { color: theme.textTertiary }]}>
                      Morning spiritual guidance
                    </Text>
                  </View>
                </View>
                <Switch
                  value={dailyAyah}
                  onValueChange={setDailyAyah}
                  disabled={!notifications}
                  trackColor={switchTrack}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </Animated.View>

          {/* ═══════════════ DATA ═══════════════ */}
          <Animated.View style={sectionAnims[2]}>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>DATA</Text>
            <View style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
              <TouchableOpacity
                style={styles.row}
                onPress={handleClearCache}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.error + '14' }]}>
                    <Ionicons name="trash-outline" size={18} color={theme.error} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>Clear Cache</Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Free up storage space</Text>
                  </View>
                </View>
                <View style={[styles.rowArrow, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ═══════════════ ABOUT ═══════════════ */}
          <Animated.View style={sectionAnims[3]}>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>ABOUT</Text>
            <View style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
              {/* Rate */}
              <TouchableOpacity
                style={styles.row}
                onPress={() => Alert.alert('Thank You', 'We appreciate your support!')}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.gold + '14' }]}>
                    <Ionicons name="star-outline" size={18} color={theme.gold} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>Rate the App</Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Share your feedback</Text>
                  </View>
                </View>
                <View style={[styles.rowArrow, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
                </View>
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

              {/* Version */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted + '14' }]}>
                    <Ionicons name="information-circle-outline" size={18} color={theme.primaryMuted} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>Version</Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>1.0.0</Text>
                  </View>
                </View>
                <View style={[styles.versionPill, { backgroundColor: theme.primaryMuted + '12' }]}>
                  <Text style={[styles.versionPillText, { color: theme.primaryMuted }]}>Stable</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ═══════════════ CREDITS ═══════════════ */}
          <Animated.View style={sectionAnims[4]}>
            <View style={styles.dividerRow}>
              <View style={[styles.dividerDot, { backgroundColor: theme.border }]} />
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <View style={[styles.dividerDot, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.credits}>
              <View style={styles.creditsLogoWrap}>
                <LinearGradient
                  colors={[theme.primaryLight, theme.primary]}
                  style={styles.creditsLogo}
                >
                  <Ionicons name="leaf" size={20} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={[styles.creditsTitle, { color: theme.text }]}>Sukoon</Text>
              <Text style={[styles.creditsSub, { color: theme.textSecondary }]}>
                Connecting hearts with Quranic guidance
              </Text>
            </View>
          </Animated.View>

          {/* ═══════════════ CLOSING VERSE ═══════════════ */}
          <Animated.View style={sectionAnims[5]}>
            <View style={styles.closingCard}>
              <LinearGradient
                colors={theme.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.closingGradient}
              >
                <View style={styles.closingDecoTop}>
                  <Text style={styles.closingDecoChar}>﷽</Text>
                </View>
                <Text style={styles.closingArabic}>
                  وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ
                </Text>
                <View style={styles.closingDivider} />
                <Text style={styles.closingEnglish}>
                  "And whoever relies upon Allah,{'\n'}then He is sufficient for him."
                </Text>
                <Text style={styles.closingRef}>Surah At-Talaq · 65:3</Text>
              </LinearGradient>
            </View>
          </Animated.View>

        </View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* ─── Header ─── */
  header: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  headerPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fff',
  },
  headerIconRow: {
    marginBottom: 14,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    letterSpacing: 0.2,
  },

  /* ─── Body ─── */
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  /* ─── Section Label ─── */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4,
  },

  /* ─── Group Card ─── */
  group: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },

  /* ─── Row ─── */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 12,
  },
  rowDivider: {
    height: 1,
    marginLeft: 64,
  },
  rowArrow: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* ─── Version Pill ─── */
  versionPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* ─── Divider Row ─── */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
    gap: 8,
  },
  dividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  dividerLine: {
    width: 40,
    height: 1,
  },

  /* ─── Credits ─── */
  credits: {
    alignItems: 'center',
    marginBottom: 24,
  },
  creditsLogoWrap: {
    marginBottom: 14,
  },
  creditsLogo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  creditsSub: {
    fontSize: 13,
    letterSpacing: 0.2,
  },

  /* ─── Closing Verse ─── */
  closingCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  closingGradient: {
    padding: 28,
    alignItems: 'center',
  },
  closingDecoTop: {
    marginBottom: 16,
    opacity: 0.4,
  },
  closingDecoChar: {
    fontSize: 28,
    color: '#D4A373', // accent color, visible on gradient
  },
  closingArabic: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 14,
  },
  closingDivider: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(212,163,115,0.35)',
    borderRadius: 1,
    marginBottom: 14,
  },
  closingEnglish: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 10,
  },
  closingRef: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});