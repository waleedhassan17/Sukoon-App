/**
 * InsightsScreen — Spiritual Progress Dashboard
 *
 * Displays comprehensive tracking stats:
 *  - Day streak, ayahs read (today/total), saved verses, days active
 *  - Last seen/audio resume cards
 *  - Weekly activity chart
 *  - Daily reading progress bar
 *  - Motivational Islamic quotes
 *  - Empty state for new users
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Platform, LayoutAnimation, UIManager,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useSavedVerses } from '@/contexts/SavedVersesContext';
import { ReadingProgress, LastPosition } from '@/lib/readingProgress';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SW } = Dimensions.get('window');

const QUOTES = [
  { arabic: 'وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ', english: '"And He is with you wherever you are."', ref: 'Al-Hadid (57:4)' },
  { arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', english: '"For indeed, with hardship comes ease."', ref: 'Ash-Sharh (94:5)' },
  { arabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', english: '"So which of the favors of your Lord would you deny?"', ref: 'Ar-Rahman (55:13)' },
  { arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', english: '"Indeed, Allah is with the patient."', ref: 'Al-Baqarah (2:153)' },
  { arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', english: '"And your Lord is going to give you, and you will be satisfied."', ref: 'Ad-Duha (93:5)' },
  { arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي', english: '"My Lord, expand for me my breast [with assurance]."', ref: 'Ta-Ha (20:25)' },
  { arabic: 'وَنَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ الْوَرِيدِ', english: '"And We are closer to him than his jugular vein."', ref: 'Qaf (50:16)' },
  { arabic: 'ادْعُونِي أَسْتَجِبْ لَكُمْ', english: '"Call upon Me; I will respond to you."', ref: 'Ghafir (40:60)' },
  { arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', english: '"Allah does not burden a soul beyond that it can bear."', ref: 'Al-Baqarah (2:286)' },
  { arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', english: '"Verily, in the remembrance of Allah do hearts find rest."', ref: 'Ar-Ra\'d (13:28)' },
];

/* ─── Ornament ─── */
function Ornament() {
  const { theme } = useTheme();
  return (
    <View style={st.ornRow}>
      <View style={[st.ornLine, { backgroundColor: `${theme.gold}4D` }]} />
      <View style={[st.ornDm, { backgroundColor: `${theme.gold}80` }]} />
      <View style={[st.ornLine, { backgroundColor: `${theme.gold}4D` }]} />
    </View>
  );
}

/* ─── Time Formatter ─── */
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  if (isYesterday) return 'Yesterday';
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
}

/* ─── Stats Card ─── */
function StatCard({
  icon, color, number, label,
}: {
  icon: string; color: string; number: number; label: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[st.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
      <View style={[st.statBadge, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[st.statNum, { color: theme.text }]}>{number}</Text>
      <Text style={[st.statLabel, { color: theme.textTertiary }]}>{label}</Text>
    </View>
  );
}

/* ─── Resume Card ─── */
function ResumeCard({
  icon, color, label, name, ayah, time, onPress,
}: {
  icon: string; color: string; label: string; name: string; ayah: number; time: string; onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[st.resumeCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}
    >
      <View style={[st.resumeIcon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={st.resumeInfo}>
        <Text style={[st.resumeLabel, { color: theme.textTertiary }]}>{label}</Text>
        <Text style={[st.resumeName, { color: theme.text }]}>{name}</Text>
        <Text style={[st.resumeAyah, { color: theme.textSecondary }]}>Ayah {ayah}</Text>
      </View>
      <Text style={[st.resumeTime, { color: theme.textTertiary }]}>{time}</Text>
    </TouchableOpacity>
  );
}

/* ─── Week Chart ─── */
function WeekChart({ data }: { data: { date: string; count: number }[] }) {
  const { theme } = useTheme();
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  return (
    <View style={st.weekContainer}>
      <Text style={[st.weekTitle, { color: theme.text }]}>Weekly Activity</Text>
      <View style={st.chartRow}>
        {data.map((item, i) => {
          const d = new Date(item.date);
          const dow = days[d.getDay()];
          const h = (item.count / maxCount) * 100;
          const isToday = new Date().toDateString() === d.toDateString();
          const barColor = isToday ? theme.primary : theme.gold;
          return (
            <View key={i} style={st.chartCol}>
              <View style={st.barWrap}>
                {h > 0 && (
                  <View style={[st.bar, { height: `${h}%`, backgroundColor: barColor, opacity: isToday ? 1 : 0.4 }]} />
                )}
              </View>
              <Text style={[st.dayLabel, { color: theme.textTertiary }]}>{dow}</Text>
              <Text style={[st.countLabel, { color: theme.textSecondary }]}>{item.count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Quote Card ─── */
function QuoteCard() {
  const { theme } = useTheme();
  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);
  
  return (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[st.quoteCard, { shadowColor: theme.shadowColor }]}
    >
      <Ionicons name="chatbox-ellipses-outline" size={24} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
      <Text style={st.quoteArabic}>{quote.arabic}</Text>
      <Text style={st.quoteEnglish}>{quote.english}</Text>
      <Text style={st.quoteRef}>— {quote.ref}</Text>
    </LinearGradient>
  );
}

/* ═══════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════ */
export default function InsightsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getSavedCount, getTodaySavedCount } = useSavedVerses();

  const [streak, setStreak] = useState(0);
  const [todayRead, setTodayRead] = useState(0);
  const [totalRead, setTotalRead] = useState(0);
  const [daysActive, setDaysActive] = useState(0);
  const [lastSeen, setLastSeen] = useState<LastPosition | null>(null);
  const [lastAudio, setLastAudio] = useState<LastPosition | null>(null);
  const [weeklyData, setWeeklyData] = useState<{ date: string; count: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setStreak(await ReadingProgress.getStreak());
        setTodayRead(await ReadingProgress.getTodayReadCount());
        setTotalRead(await ReadingProgress.getTotalReadCount());
        setDaysActive(await ReadingProgress.getDaysActive());
        setLastSeen(await ReadingProgress.getLastSeen());
        setLastAudio(await ReadingProgress.getLastAudio());
        setWeeklyData(await ReadingProgress.getDailyReadCounts(7));
      };
      load();
    }, [])
  );

  const hasAnyData = totalRead > 0 || streak > 0 || daysActive > 0;
  const todayGoal = 20;
  const progressPct = Math.min((todayRead / todayGoal) * 100, 100);

  return (
    <View style={[st.root, { backgroundColor: theme.surface }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        {/* ═══ HEADER ═══ */}
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[st.hdr, { paddingTop: insets.top + 6 }]}
        >


          <View style={st.hdrTop}>
            <TouchableOpacity style={st.hdrBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={st.hdrTitle}>Insights</Text>
            <View style={{ width: 36 }} />
          </View>

          <Ornament />
          <Text style={st.hdrSub}>Your Spiritual Journey</Text>
        </LinearGradient>

        {!hasAnyData ? (
          /* ═══ EMPTY STATE ═══ */
          <View style={st.emptyContainer}>
            <View style={[st.emptyIcon, { backgroundColor: `${theme.primary}14` }]}>
              <Ionicons name="book-outline" size={48} color={theme.primary} />
            </View>
            <Text style={[st.emptyTitle, { color: theme.text }]}>Start Your Journey</Text>
            <Text style={[st.emptySub, { color: theme.textTertiary }]}>
              Read the Quran to see your spiritual progress here
            </Text>
            <TouchableOpacity
              onPress={() => { router.push('/(tabs)/quran'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
              style={[st.emptyBtn, { backgroundColor: theme.primary }]}
              activeOpacity={0.8}
            >
              <Text style={st.emptyBtnText}>Begin Reading</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ═══ RESUME SECTION ═══ */}
            {(lastSeen || lastAudio) && (
              <View style={st.resumeSection}>
                {lastSeen && (
                  <ResumeCard
                    icon="book-outline"
                    color={theme.primary}
                    label="Last Seen"
                    name={lastSeen.surahName}
                    ayah={lastSeen.ayah}
                    time={formatTimestamp(lastSeen.timestamp)}
                    onPress={() => {
                      router.push({
                        pathname: '/quran/[surah]',
                        params: { surah: lastSeen.surah, startAyah: lastSeen.ayah },
                      });
                      Haptics.selectionAsync().catch(() => {});
                    }}
                  />
                )}
                {lastAudio && (
                  <ResumeCard
                    icon="headset-outline"
                    color={theme.gold}
                    label="Last Audio"
                    name={lastAudio.surahName}
                    ayah={lastAudio.ayah}
                    time={formatTimestamp(lastAudio.timestamp)}
                    onPress={() => {
                      router.push({
                        pathname: '/quran/[surah]',
                        params: { surah: lastAudio.surah, startAyah: lastAudio.ayah, autoPlay: 'true' },
                      });
                      Haptics.selectionAsync().catch(() => {});
                    }}
                  />
                )}
              </View>
            )}

            {/* ═══ STATS GRID ═══ */}
            <View style={st.statsGrid}>
              <StatCard icon="flame-outline" color="#F09846" number={streak} label="Day Streak" />
              <StatCard icon="book-outline" color={theme.primary} number={todayRead} label="Ayahs Today" />
              <StatCard icon="bookmark-outline" color={theme.gold} number={getSavedCount()} label="Saved Verses" />
              <StatCard icon="calendar-outline" color="#8B6BBF" number={daysActive} label="Days Active" />
            </View>

            {/* ═══ TODAY'S PROGRESS ═══ */}
            <View style={[st.progressCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
              <View style={st.progressHeader}>
                <Text style={[st.progressTitle, { color: theme.text }]}>Today's Reading</Text>
                <Text style={[st.progressText, { color: theme.textTertiary }]}>
                  {todayRead} / {todayGoal} ayahs
                </Text>
              </View>
              <View style={[st.progressBar, { backgroundColor: `${theme.primary}10` }]}>
                <View style={[st.progressFill, { width: `${progressPct}%`, backgroundColor: theme.primary }]} />
              </View>
              {progressPct >= 100 && (
                <View style={st.progressBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                  <Text style={[st.progressBadgeText, { color: theme.primary }]}>Daily goal reached!</Text>
                </View>
              )}
            </View>

            {/* ═══ WEEKLY CHART ═══ */}
            {weeklyData.length > 0 && (
              <View style={[st.chartCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
                <WeekChart data={weeklyData} />
              </View>
            )}

            {/* ═══ TOTAL STATS ═══ */}
            <View style={[st.totalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
              <Text style={[st.totalTitle, { color: theme.text }]}>Lifetime Stats</Text>
              <View style={st.totalRow}>
                <View>
                  <Text style={[st.totalNum, { color: theme.primary }]}>{totalRead}</Text>
                  <Text style={[st.totalLabel, { color: theme.textTertiary }]}>Total Ayahs Read</Text>
                </View>
                <View style={[st.totalDiv, { backgroundColor: theme.border }]} />
                <View>
                  <Text style={[st.totalNum, { color: theme.gold }]}>{daysActive}</Text>
                  <Text style={[st.totalLabel, { color: theme.textTertiary }]}>Active Days</Text>
                </View>
              </View>
            </View>

            {/* ═══ MOTIVATIONAL QUOTE ═══ */}
            <QuoteCard />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },

  ornRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 4 },
  ornLine: { width: 28, height: 1 },
  ornDm: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },

  /* Header */
  hdr: { paddingHorizontal: 20, paddingBottom: 22, overflow: 'hidden' },

  hdrTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  hdrBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  hdrSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textAlign: 'center', marginTop: 4 },

  /* Empty state */
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, lineHeight: 20, marginBottom: 24, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  /* Resume section */
  resumeSection: { paddingHorizontal: 16, paddingTop: 18, gap: 10 },
  resumeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, gap: 12, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 2 } }) },
  resumeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resumeInfo: { flex: 1, gap: 2 },
  resumeLabel: { fontSize: 11, fontWeight: '600' },
  resumeName: { fontSize: 15, fontWeight: '700' },
  resumeAyah: { fontSize: 12 },
  resumeTime: { fontSize: 11, fontWeight: '600' },

  /* Stats grid */
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 14, gap: 10 },
  statCard: { width: '48%', borderRadius: 16, borderWidth: 1, alignItems: 'center', paddingVertical: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 2 } }) },
  statBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statNum: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '600' },

  /* Progress */
  progressCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, borderWidth: 1, padding: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 2 } }) },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressTitle: { fontSize: 15, fontWeight: '700' },
  progressText: { fontSize: 12, fontWeight: '600' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  progressBadgeText: { fontSize: 12, fontWeight: '700' },

  /* Chart */
  chartCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, borderWidth: 1, padding: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 2 } }) },
  weekContainer: { width: '100%' },
  weekTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-around', height: 120, alignItems: 'flex-end' },
  chartCol: { alignItems: 'center', flex: 1, gap: 6 },
  barWrap: { height: 100, width: '70%', justifyContent: 'flex-end', alignItems: 'center', borderRadius: 4, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4 },
  dayLabel: { fontSize: 10, fontWeight: '600' },
  countLabel: { fontSize: 9, fontWeight: '500' },

  /* Total stats */
  totalCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, borderWidth: 1, padding: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 2 } }) },
  totalTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  totalNum: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  totalLabel: { fontSize: 11, fontWeight: '600' },
  totalDiv: { width: 1, height: 40 },

  /* Quote */
  quoteCard: { marginHorizontal: 16, marginTop: 20, marginBottom: 20, borderRadius: 18, padding: 20, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 }, android: { elevation: 4 } }) },
  quoteArabic: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12, textAlign: 'right', writingDirection: 'rtl', lineHeight: 32, fontFamily: 'AlQalamQuran' },
  quoteEnglish: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 12, textAlign: 'center', lineHeight: 20 },
  quoteRef: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontWeight: '600' },
});
