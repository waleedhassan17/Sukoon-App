/**
 * HomeScreen - Sukoon Spiritual Dashboard
 * Premium, refined spiritual experience with elegant aesthetics
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useFontSize } from '@/contexts/FontSizeContext';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { ReadingProgress } from '@/lib/readingProgress';
import { QuranService } from '@/lib/quranService';
import { PrayerTimesService, PrayerTimesData, HijriDate, IslamicCalendarData } from '@/lib/prayerTimes';
import { NotificationService } from '@/lib/notificationService';
import { scheduleFromPrayerTimes, RawPrayerTimes } from '@/lib/prayerTimeNotifBridge';
import { SHADOWS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { EmotionService } from '@/lib/emotionService';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Assalamu Alaikum';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Assalamu Alaikum';
}

/* ─── Staggered fade-in hook ─── */
function useStaggeredEntry(count: number, baseDelay = 80) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  const slides = useRef(Array.from({ length: count }, () => new Animated.Value(24))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          delay: i * baseDelay + 200,
          useNativeDriver: true,
        }),
        Animated.timing(slides[i], {
          toValue: 0,
          duration: 500,
          delay: i * baseDelay + 200,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(0, animations).start();
  }, []);

  return anims.map((opacity, i) => ({ opacity, transform: [{ translateY: slides[i] }] }));
}

/* ─── Divider ─── */
const SectionDivider = ({ borderColor }: { borderColor: string }) => (
  <View style={styles.divider}>
    <View style={[styles.dividerDot, { backgroundColor: borderColor }]} />
    <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
    <View style={[styles.dividerDot, { backgroundColor: borderColor }]} />
  </View>
);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { sizes } = useFontSize();
  const router = useRouter();

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(30)).current;

  const [emotionText, setEmotionText] = useState('');
  const [dailyAyah, setDailyAyah] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [lastSeen, setLastSeen] = useState<any>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesData | null>(null);
  const [nextPrayer, setNextPrayer] = useState<any>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [islamicDate, setIslamicDate] = useState<IslamicCalendarData | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // 8 staggered sections
  const sectionAnims = useStaggeredEntry(8, 90);

  const quickEmotions = useMemo(() => [
    { name: 'Peaceful', icon: 'leaf-outline' as const, color: theme.emotionPeaceful },
    { name: 'Grateful', icon: 'heart-outline' as const, color: theme.emotionGrateful },
    { name: 'Anxious', icon: 'thunderstorm-outline' as const, color: theme.emotionAnxious },
    { name: 'Sad', icon: 'rainy-outline' as const, color: theme.emotionSad },
    { name: 'Hopeful', icon: 'sunny-outline' as const, color: theme.emotionHopeful },
    { name: 'Lost', icon: 'compass-outline' as const, color: theme.emotionLost },
  ], [theme]);

  const quickActions = useMemo(() => [
    { label: 'Tasbeeh', icon: 'ellipse-outline' as const, route: '/tools/tasbeeh', gradient: theme.actionGradient1 },
    { label: 'Qiblah', icon: 'navigate-outline' as const, route: '/tools/qiblah', gradient: theme.actionGradient2 },
    { label: 'Prayer', icon: 'time-outline' as const, route: '/tools/prayer', gradient: theme.actionGradient3 },
    { label: 'Insights', icon: 'bar-chart-outline' as const, route: '/insights', gradient: theme.actionGradient4 },
  ], [theme]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(heroSlide, { toValue: 0, tension: 40, friction: 10, useNativeDriver: true }),
    ]).start();
    loadData();
  }, []);

  const loadData = async () => {
    ReadingProgress.getStreak().then(setStreak).catch(() => {});
    ReadingProgress.getLastSeen().then(setLastSeen).catch(() => {});
    QuranService.getRandomAyah().then(setDailyAyah).catch(() => {});
    PrayerTimesService.getIslamicDate().then(setIslamicDate).catch(() => {});
    EmotionService.warmUp().catch(() => {}); // Pre-warm ML API
    loadPrayerTimes();
  };

  const loadPrayerTimes = async () => {
    try {
      // ── Cache-first: instant load from today's cached data ──
      const cached = await PrayerTimesService.getCachedPrayerTimes();
      if (cached) {
        setPrayerTimes(cached.data);
        setNextPrayer(PrayerTimesService.getNextPrayer(cached.data));
        return; // Done — no GPS or API needed
      }

      // ── No cache: fetch fresh ──
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Use cached location if available (avoids GPS delay)
      let lat: number;
      let lng: number;
      const cachedLoc = await PrayerTimesService.getCachedLocation();
      if (cachedLoc) {
        lat = cachedLoc.lat;
        lng = cachedLoc.lng;
      } else {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        // Cache location for next time
        await PrayerTimesService.cacheLocation(lat, lng, '');
      }

      const times = await PrayerTimesService.getByCoordinates(lat, lng);
      if (times) {
        setPrayerTimes(times);
        setNextPrayer(PrayerTimesService.getNextPrayer(times));

        // Cache prayer times for instant load
        await PrayerTimesService.cachePrayerTimes(times, '');

        // Schedule notifications if enabled
        try {
          const prefs = await NotificationService.getPreferences();
          if (prefs.enabled) {
            const rawTimes: RawPrayerTimes = {
              Fajr: times.Fajr?.split(' ')[0] || '05:00',
              Sunrise: times.Sunrise?.split(' ')[0] || '06:30',
              Dhuhr: times.Dhuhr?.split(' ')[0] || '12:00',
              Asr: times.Asr?.split(' ')[0] || '15:30',
              Maghrib: times.Maghrib?.split(' ')[0] || '18:00',
              Isha: times.Isha?.split(' ')[0] || '19:30',
            };
            await scheduleFromPrayerTimes(rawTimes);
          }
        } catch (notifErr) {
          if (__DEV__) console.warn('Failed to schedule prayer notifications:', notifErr);
        }
      }
    } catch (e) {
      if (__DEV__) console.error('Prayer times error:', e);
    }
  };

  // Debounce ref to prevent double navigation from rapid taps
  const isNavigatingRef = useRef(false);

  const handleAnalyze = useCallback(() => {
    if (!emotionText.trim()) return;
    if (isNavigatingRef.current) return; // Prevent double-tap
    isNavigatingRef.current = true;
    router.push({ pathname: '/emotion-result', params: { text: emotionText.trim() } });
    // Reset after a short delay so the user can navigate again when returning
    setTimeout(() => { isNavigatingRef.current = false; }, 1000);
  }, [emotionText]);

  const handleEmotionQuick = useCallback((name: string) => {
    // Guard against rapid double-taps causing duplicate navigation
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    // Static 6 emotions bypass the ML API — use curated verses directly
    router.push({ pathname: '/emotion-result', params: { text: `I'm feeling ${name.toLowerCase()}`, staticEmotion: name } });
    // Reset after a short delay
    setTimeout(() => { isNavigatingRef.current = false; }, 1000);
  }, []);

  const canAnalyze = emotionText.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ═══════════════ HERO HEADER ═══════════════ */}
        <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroSlide }] }}>
          <LinearGradient
            colors={theme.headerGradient as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroGradient, { paddingTop: insets.top + 16 }]}
          >
            {/* Decorative pattern overlay */}
            <View style={styles.heroPattern}>
              {[...Array(6)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.heroPatternCircle,
                    {
                      width: 120 + i * 60,
                      height: 120 + i * 60,
                      top: -20 + i * 10,
                      right: -40 + i * 15,
                      opacity: 0.03 + i * 0.008,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Top bar */}
            <View style={styles.heroTopBar}>
              <View>
                <Text style={styles.heroDate}>
                  {islamicDate 
                    ? `${islamicDate.hijri.day} ${islamicDate.hijri.month} ${islamicDate.hijri.year} AH`
                    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.heroTopRight}>
                <TouchableOpacity style={styles.heroIconBtn} activeOpacity={0.7} onPress={() => router.push('/notifications' as any)}>
                  <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Greeting */}
            <View style={styles.heroGreeting}>
              <Text style={styles.heroGreetingText}>{getGreeting()}</Text>
              <Text style={styles.heroSubtitle}>Find peace through Quranic guidance</Text>
            </View>

            {/* ── Guidance Input ── */}
            <View style={[styles.guidanceCard, { backgroundColor: theme.surfaceElevated }, inputFocused && { shadowColor: theme.gold }]}>
              <View style={[styles.guidanceInputRow, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="search-outline" size={18} color={theme.textTertiary} />
                <TextInput
                  style={[styles.guidanceInput, { color: theme.text }]}
                  placeholder="What's on your heart today?"
                  placeholderTextColor={theme.textTertiary}
                  value={emotionText}
                  onChangeText={(text) => {
                    setEmotionText(text);
                    setVoiceError(null); // Clear error when user types
                  }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onSubmitEditing={handleAnalyze}
                  returnKeyType="search"
                  multiline={false}
                />
                <VoiceInputButton
                  currentText={emotionText}
                  onTextAppended={(newText) => {
                    setEmotionText(newText);
                    setVoiceError(null);
                  }}
                  onError={(error) => setVoiceError(error)}
                  iconSize={18}
                  iconColor={theme.textTertiary}
                  disabled={false}
                />
              </View>
              {voiceError && (
                <Text style={[styles.errorText, { color: theme.emotionAnxious }]}>
                  {voiceError}
                </Text>
              )}
              <TouchableOpacity
                onPress={handleAnalyze}
                disabled={!canAnalyze}
                activeOpacity={0.8}
                style={{ opacity: canAnalyze ? 1 : 0.4 }}
              >
                <LinearGradient
                  colors={['#2D6A4F', '#1B4332']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.guidanceBtn}
                >
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={styles.guidanceBtnText}>Find Guidance</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.body}>

          {/* ═══════════════ STATS STRIP ═══════════════ */}
          <Animated.View style={[styles.statsStrip, { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadowColor }, sectionAnims[0]]}>
            {/* Next Prayer */}
            {nextPrayer ? (
              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: theme.primaryMuted + '20' }]}>
                  <Ionicons name="moon-outline" size={16} color={theme.primary} />
                </View>
                <View style={styles.statTextWrap}>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]} numberOfLines={1}>NEXT PRAYER</Text>
                  <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{nextPrayer.name}</Text>
                  <Text style={[styles.statSub, { color: theme.textTertiary }]}>{PrayerTimesService.formatTime(nextPrayer.time)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: theme.primaryMuted + '20' }]}>
                  <Ionicons name="moon-outline" size={16} color={theme.primary} />
                </View>
                <View style={styles.statTextWrap}>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>Prayer</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>—</Text>
                </View>
              </View>
            )}

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            {/* Streak */}
            <View style={styles.statItem}>
              <View style={[styles.statIconWrap, { backgroundColor: theme.goldLight + '30' }]}>
                <Ionicons name="flame-outline" size={16} color={theme.gold} />
              </View>
              <View style={styles.statTextWrap}>
                <Text style={[styles.statLabel, { color: theme.textTertiary }]}>Streak</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {streak} <Text style={[styles.statUnit, { color: theme.textTertiary }]}>days</Text>
                </Text>
              </View>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            {/* Quran */}
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push('/(tabs)/quran')}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconWrap, { backgroundColor: theme.emotionLost + '20' }]}>
                <Ionicons name="book-outline" size={16} color={theme.emotionLost} />
              </View>
              <View style={styles.statTextWrap}>
                <Text style={[styles.statLabel, { color: theme.textTertiary }]}>Quran</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>114</Text>
                <Text style={[styles.statSub, { color: theme.textTertiary }]}>Surahs</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ═══════════════ RESUME READING ═══════════════ */}
          {lastSeen && (
            <Animated.View style={sectionAnims[1]}>
              <TouchableOpacity
                onPress={() => router.push(`/quran/${lastSeen.surah}?startAyah=${lastSeen.ayah}`)}
                activeOpacity={0.85}
                style={[styles.resumeCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              >
                <View style={styles.resumeLeft}>
                  <View style={[styles.resumeIconWrap, { backgroundColor: theme.primaryMuted + '20' }]}>
                    <Ionicons name="bookmark" size={18} color={theme.primary} />
                  </View>
                  <View style={styles.resumeTextWrap}>
                    <Text style={[styles.resumeTitle, { color: theme.text }]}>Continue Reading</Text>
                    <Text style={[styles.resumeSub, { color: theme.textSecondary }]}>Surah {lastSeen.surah} · Ayah {lastSeen.ayah}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ═══════════════ QUICK EMOTIONS ═══════════════ */}
          <Animated.View style={[styles.section, sectionAnims[2]]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>How are you feeling?</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Tap for Quranic guidance</Text>
            </View>
            <View style={styles.emotionsGrid}>
              {quickEmotions.map((em, i) => (
                <TouchableOpacity
                  key={em.name}
                  onPress={() => handleEmotionQuick(em.name)}
                  activeOpacity={0.75}
                  style={[styles.emotionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                >
                  <View style={[styles.emotionIconWrap, { backgroundColor: em.color + '14' }]}>
                    <Ionicons name={em.icon} size={22} color={em.color} />
                  </View>
                  <Text style={[styles.emotionLabel, { color: theme.text }]}>{em.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <SectionDivider borderColor={theme.border} />

          {/* ═══════════════ DAILY AYAH ═══════════════ */}
          {dailyAyah && (
            <Animated.View style={[styles.section, sectionAnims[3]]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Daily Ayah</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  {dailyAyah.surahName} ({dailyAyah.surah}:{dailyAyah.ayah})
                </Text>
              </View>
              <View style={styles.ayahCard}>
                <LinearGradient
                  colors={[theme.headerGradient[0], theme.headerGradient[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ayahGradient}
                >
                  {/* Decorative corner */}
                  <View style={styles.ayahCornerDecor}>
                    <Ionicons name="sparkles" size={14} color={theme.gold + '80'} />
                  </View>

                  <Text style={[styles.ayahArabic, { fontSize: sizes.arabic, lineHeight: sizes.arabicLine }]}>{dailyAyah.arabic}</Text>

                  <View style={[styles.ayahDividerLine, { backgroundColor: theme.gold + '4D' }]} />

                  <Text style={[styles.ayahEnglish, { fontSize: sizes.english, lineHeight: sizes.englishLine }]}>{dailyAyah.english}</Text>

                  {dailyAyah.urdu && (
                    <Text style={[styles.ayahUrdu, { fontSize: sizes.urdu, lineHeight: sizes.urduLine }]}>{dailyAyah.urdu}</Text>
                  )}

                  <View style={styles.ayahFooter}>
                    <View style={styles.ayahRefPill}>
                      <Ionicons name="book-outline" size={12} color={theme.gold} />
                      <Text style={[styles.ayahRefText, { color: theme.gold + 'D9' }]}>
                        {dailyAyah.surahName} · {dailyAyah.surah}:{dailyAyah.ayah}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </Animated.View>
          )}

          <SectionDivider borderColor={theme.border} />

          {/* ═══════════════ QUICK ACTIONS ═══════════════ */}
          <Animated.View style={[styles.section, sectionAnims[4]]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Access</Text>
            </View>
            <View style={styles.actionsRow}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.8}
                  style={[styles.actionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                >
                  <LinearGradient
                    colors={action.gradient as [string, string]}
                    style={styles.actionIconWrap}
                  >
                    <Ionicons name={action.icon} size={20} color={theme.textOnDark} />
                  </LinearGradient>
                  <Text style={[styles.actionLabel, { color: theme.text }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <SectionDivider borderColor={theme.border} />

          {/* ═══════════════ GUIDANCE TIPS ═══════════════ */}
          <Animated.View style={[styles.section, sectionAnims[5]]}>
            <View style={[styles.tipsCard, { backgroundColor: theme.surfaceWarm, borderColor: theme.gold + '26' }]}>
              <View style={styles.tipsIconRow}>
                <View style={[styles.tipsIconWrap, { backgroundColor: theme.gold + '1F' }]}>
                  <Ionicons name="bulb-outline" size={18} color={theme.gold} />
                </View>
                <Text style={[styles.tipsTitle, { color: theme.text }]}>Tips for Better Guidance</Text>
              </View>
              {[
                'Be specific about your emotions',
                'Describe your current situation',
                'Express what kind of guidance you seek',
              ].map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={[styles.tipDot, { backgroundColor: theme.gold }]} />
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ═══════════════ CLOSING VERSE ═══════════════ */}
          <Animated.View style={[styles.section, sectionAnims[6]]}>
            <View style={styles.closingCard}>
              <LinearGradient
                colors={theme.headerGradient as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.closingGradient}
              >
                <View style={styles.closingDecoTop}>
                  <Text style={[styles.closingDecoChar, { color: theme.gold }]}>﷽</Text>
                </View>

                <Text style={styles.closingArabic}>
                  أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ
                </Text>

                <View style={[styles.closingQuoteLine, { backgroundColor: theme.gold + '59' }]} />

                <Text style={styles.closingEnglish}>
                  "Verily, in the remembrance of Allah{'\n'}do hearts find rest."
                </Text>
                <Text style={styles.closingRef}>Surah Ar-Ra'd · 13:28</Text>
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

  /* ─── Hero ─── */
  heroGradient: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroPatternCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fff',
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  heroTopRight: {
    flexDirection: 'row',
    gap: 6,
  },
  heroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGreeting: {
    marginBottom: 24,
  },
  heroGreetingText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    letterSpacing: 0.2,
  },

  /* ─── Guidance Input Card ─── */
  guidanceCard: {
    borderRadius: 20,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.12)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  guidanceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  guidanceInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '400',
  },
  guidanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  guidanceBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 2,
    marginBottom: 8,
  },

  /* ─── Body ─── */
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  /* ─── Stats Strip ─── */
  statsStrip: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: { elevation: 3 },
    }),
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextWrap: {
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  statSub: {
    fontSize: 11,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 8,
  },

  /* ─── Resume Card ─── */
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  resumeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resumeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  resumeTextWrap: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  resumeSub: {
    fontSize: 13,
  },

  /* ─── Section ─── */
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '400',
  },

  /* ─── Divider ─── */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
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

  /* ─── Emotions Grid ─── */
  emotionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
  },
  emotionCard: {
    width: (width - 40 - 16) / 3,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  emotionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emotionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* ─── Ayah Card ─── */
  ayahCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  ayahGradient: {
    padding: 24,
  },
  ayahCornerDecor: {
    position: 'absolute',
    top: 16,
    right: 20,
    opacity: 0.7,
  },
  ayahArabic: {
    fontSize: 24,
    lineHeight: 44,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'right',
    marginBottom: 16,
    fontWeight: '400',
  },
  ayahDividerLine: {
    width: 40,
    height: 1.5,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  ayahEnglish: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
    marginBottom: 10,
    fontWeight: '400',
  },
  ayahUrdu: {
    fontSize: 16,
    lineHeight: 28,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  ayahFooter: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  ayahRefPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  ayahRefText: {
    fontSize: 12,
    color: 'rgba(212,163,115,0.85)',
    fontWeight: '500',
  },

  /* ─── Quick Actions ─── */
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* ─── Tips ─── */
  tipsCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  tipsIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  tipsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  /* ─── Closing Verse ─── */
  closingCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  closingGradient: {
    padding: 32,
    alignItems: 'center',
  },
  closingDecoTop: {
    marginBottom: 20,
    opacity: 0.4,
  },
  closingDecoChar: {
    fontSize: 28,
  },
  closingArabic: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 16,
  },
  closingQuoteLine: {
    width: 32,
    height: 2,
    borderRadius: 1,
    marginBottom: 16,
  },
  closingEnglish: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 12,
  },
  closingRef: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});