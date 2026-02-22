/**
 * SalahTrackerScreen v2 - Premium Prayer Tracker
 *
 * KEY DESIGN DECISIONS:
 *  - No react-native-svg: completion ring uses pure RN Animated views
 *  - Gradient header with live stats (today/streak/monthly)
 *  - Calendar card: month grid with color-coded dots, weekly strip toggle
 *  - Prayer cards: gradient accent + Arabic name + tap-to-cycle + long-press picker
 *  - Bottom-sheet status picker (not centered modal)
 *  - AsyncStorage persistence keyed by date
 *  - Sukoon green/gold palette (#1B4332→#40916C + #D4A373)
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Platform, Animated, LayoutAnimation, UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { DataSyncService } from '@/lib/dataSyncService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SW } = Dimensions.get('window');

/* ═══ Types & Data ═══ */
type PrayerStatus = 'none' | 'prayed' | 'jamaah' | 'qasr' | 'missed';
type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha';

interface DayData {
  fajr: PrayerStatus;
  zuhr: PrayerStatus;
  asr: PrayerStatus;
  maghrib: PrayerStatus;
  isha: PrayerStatus;
}

const EMPTY_DAY: DayData = { fajr: 'none', zuhr: 'none', asr: 'none', maghrib: 'none', isha: 'none' };

const PRAYERS: { key: PrayerKey; name: string; arabic: string; icon: string; gradient: [string, string] }[] = [
  { key: 'fajr', name: 'Fajr', arabic: 'الفجر', icon: 'sunny-outline', gradient: ['#56A8E2', '#3D8FCC'] },
  { key: 'zuhr', name: 'Zuhr', arabic: 'الظُّهر', icon: 'sunny', gradient: ['#F0C146', '#DBA830'] },
  { key: 'asr', name: 'Asr', arabic: 'العصر', icon: 'partly-sunny-outline', gradient: ['#F09846', '#DB7F30'] },
  { key: 'maghrib', name: 'Maghrib', arabic: 'المغرب', icon: 'cloudy-night-outline', gradient: ['#9B72CF', '#7C56B2'] },
  { key: 'isha', name: 'Isha', arabic: 'العِشاء', icon: 'moon-outline', gradient: ['#4568B8', '#3350A0'] },
];

const STATUS_CYCLE: PrayerStatus[] = ['none', 'prayed', 'jamaah', 'qasr', 'missed'];

const STATUS_INFO: Record<PrayerStatus, { label: string; icon: string; color: string }> = {
  none: { label: 'Not Tracked', icon: 'radio-button-off', color: '#AAA' },
  prayed: { label: 'Prayed Alone', icon: 'checkmark-circle', color: '#40916C' },
  jamaah: { label: 'Prayed in Jamaah', icon: 'people-circle', color: '#1B6B3C' },
  qasr: { label: 'Qasr (Shortened)', icon: 'airplane-outline', color: '#56A8E2' },
  missed: { label: 'Missed', icon: 'close-circle', color: '#D04040' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const LAYOUT_ANIM = {
  duration: 250,
  update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

/* ═══ Helpers ═══ */
const dk = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const sk = (key: string) => `sukoon_salah_${key}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const firstDow = (y: number, m: number) => new Date(y, m, 1).getDay();
const countDone = (d: DayData) =>
  Object.values(d).filter((v) => v === 'prayed' || v === 'jamaah' || v === 'qasr').length;

/* ═══ Ornament ═══ */
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

/* ═══ Completion Ring (pure RN, no SVG) ═══ */
function CompletionRing({ count, total = 5, size = 54 }: { count: number; total?: number; size?: number }) {
  const { theme } = useTheme();
  const pct = total > 0 ? count / total : 0;
  const full = count === total && total > 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View style={[st.ringBg, { width: size, height: size, borderRadius: size / 2, borderColor: `${theme.gold}25` }]} />
      {/* 5 segment dots around the circle */}
      {Array.from({ length: total }, (_, i) => {
        const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
        const r = (size - 8) / 2;
        const x = size / 2 + r * Math.cos(angle) - 4;
        const y = size / 2 + r * Math.sin(angle) - 4;
        const done = i < count;
        return (
          <View
            key={i}
            style={[
              st.ringDot,
              {
                left: x, top: y,
                backgroundColor: done ? (full ? theme.primary : theme.gold) : `${theme.textTertiary}30`,
                width: 8, height: 8, borderRadius: 4,
              },
            ]}
          />
        );
      })}
      <Text style={[st.ringText, { color: full ? theme.primary : '#fff', fontSize: size * 0.26 }]}>
        {count}/{total}
      </Text>
    </View>
  );
}

/* ═══ Prayer Card ═══ */
function PrayerCard({
  prayer, status, onTap, onLong,
}: {
  prayer: typeof PRAYERS[0]; status: PrayerStatus;
  onTap: () => void; onLong: () => void;
}) {
  const { theme } = useTheme();
  const info = STATUS_INFO[status];
  const done = status === 'prayed' || status === 'jamaah' || status === 'qasr';
  const missed = status === 'missed';
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onTap();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={press}
        onLongPress={onLong}
        delayLongPress={350}
        activeOpacity={0.9}
        style={[
          st.pCard,
          { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor },
          done && { borderColor: `${info.color}25` },
          missed && { borderColor: `${info.color}20` },
        ]}
      >
        {/* Gradient accent bar */}
        <LinearGradient
          colors={prayer.gradient}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[st.pAccentBar, done && { opacity: 1 }, missed && { opacity: 0.4 }]}
        />

        {/* Icon badge */}
        <LinearGradient colors={prayer.gradient} style={st.pBadge}>
          <Ionicons name={prayer.icon as any} size={18} color="#fff" />
        </LinearGradient>

        {/* Center info */}
        <View style={st.pCenter}>
          <View style={st.pNameRow}>
            <Text style={[st.pName, { color: theme.text }]}>{prayer.name}</Text>
            <Text style={[st.pArabic, { color: `${theme.textTertiary}90` }]}>{prayer.arabic}</Text>
          </View>
          <View style={[st.pStatusRow, { backgroundColor: done ? `${info.color}10` : missed ? `${info.color}08` : theme.surfaceMuted }]}>
            <Ionicons name={info.icon as any} size={13} color={info.color} />
            <Text style={[st.pStatusText, { color: info.color }]}>{info.label}</Text>
          </View>
        </View>

        {/* Right: quick status dots */}
        <View style={st.pDots}>
          {STATUS_CYCLE.slice(1).map((s) => {
            const active = status === s;
            const c = STATUS_INFO[s].color;
            return (
              <View
                key={s}
                style={[
                  st.pDot,
                  { borderColor: active ? c : `${theme.textTertiary}25` },
                  active && { backgroundColor: c },
                ]}
              >
                {active && <Ionicons name="checkmark-sharp" size={7} color="#fff" />}
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ═══ Bottom Sheet Status Picker ═══ */
function StatusSheet({
  visible, prayer, current, onSelect, onClose,
}: {
  visible: boolean; prayer: typeof PRAYERS[0] | null;
  current: PrayerStatus; onSelect: (s: PrayerStatus) => void; onClose: () => void;
}) {
  const { theme } = useTheme();
  const translateY = useRef(new Animated.Value(400)).current;
  const bgOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.timing(bgOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(bgOp, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !prayer) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[st.sheetBg, { opacity: bgOp }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[st.sheetWrap, { transform: [{ translateY }] }]}>
        <View style={[st.sheet, { backgroundColor: theme.surfaceElevated, shadowColor: theme.shadowColor }]}>
          {/* Handle */}
          <View style={[st.sheetHandle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={st.sheetHeader}>
            <LinearGradient colors={prayer.gradient} style={st.sheetBadge}>
              <Ionicons name={prayer.icon as any} size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[st.sheetTitle, { color: theme.text }]}>{prayer.name}</Text>
              <Text style={[st.sheetArabic, { color: theme.textTertiary }]}>{prayer.arabic}</Text>
            </View>
          </View>

          {/* Options */}
          <View style={st.sheetOpts}>
            {STATUS_CYCLE.map((s) => {
              const inf = STATUS_INFO[s];
              const active = current === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => { onSelect(s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                  activeOpacity={0.7}
                  style={[
                    st.sheetOpt,
                    { backgroundColor: active ? `${inf.color}12` : theme.surfaceMuted, borderColor: active ? `${inf.color}35` : 'transparent' },
                  ]}
                >
                  <View style={[st.sheetOptIcon, { backgroundColor: `${inf.color}18` }]}>
                    <Ionicons name={inf.icon as any} size={18} color={inf.color} />
                  </View>
                  <Text style={[st.sheetOptLabel, { color: active ? inf.color : theme.textSecondary }]}>{inf.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={inf.color} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════ */
export default function SalahTrackerScreen() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const now = new Date();
  const [vYear, setVYear] = useState(now.getFullYear());
  const [vMonth, setVMonth] = useState(now.getMonth());
  const [selDay, setSelDay] = useState(now.getDate());
  const [weekly, setWeekly] = useState(false);
  const [dayData, setDayData] = useState<DayData>({ ...EMPTY_DAY });
  const [cache, setCache] = useState<Record<string, DayData>>({});
  const [pickerPrayer, setPickerPrayer] = useState<typeof PRAYERS[0] | null>(null);
  const [streak, setStreak] = useState(0);

  const selKey = dk(vYear, vMonth, selDay);
  const isToday = vYear === now.getFullYear() && vMonth === now.getMonth() && selDay === now.getDate();
  const completed = countDone(dayData);

  /* ─── Data ─── */
  useEffect(() => { loadMonth(); }, [vYear, vMonth]);
  useEffect(() => { loadDay(); }, [selKey]);
  useEffect(() => { calcStreak(); }, [cache]);

  const loadMonth = async () => {
    const days = daysIn(vYear, vMonth);
    const keys = Array.from({ length: days }, (_, i) => sk(dk(vYear, vMonth, i + 1)));
    try {
      const res = await AsyncStorage.multiGet(keys);
      const c: Record<string, DayData> = {};
      res.forEach(([k, v]) => { if (v) c[k.replace('sukoon_salah_', '')] = JSON.parse(v); });
      setCache(c);
    } catch {}
  };

  const loadDay = async () => {
    try {
      const v = await AsyncStorage.getItem(sk(selKey));
      setDayData(v ? JSON.parse(v) : { ...EMPTY_DAY });
    } catch { setDayData({ ...EMPTY_DAY }); }
  };

  const save = async (data: DayData) => {
    setDayData(data);
    setCache((p) => ({ ...p, [selKey]: data }));
    try { await AsyncStorage.setItem(sk(selKey), JSON.stringify(data)); } catch {}
    // Background cloud sync
    DataSyncService.saveSalahData(selKey, data).catch(() => {});
  };

  const calcStreak = () => {
    let cnt = 0;
    const d = new Date(now);
    for (let i = 0; i < 365; i++) {
      const k = dk(d.getFullYear(), d.getMonth(), d.getDate());
      const data = cache[k];
      if (data && countDone(data) === 5) { cnt++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }
      else break;
    }
    setStreak(cnt);
  };

  const cycle = useCallback((key: PrayerKey) => {
    const cur = dayData[key];
    const idx = STATUS_CYCLE.indexOf(cur);
    save({ ...dayData, [key]: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [dayData, selKey]);

  const setStatus = useCallback((key: PrayerKey, s: PrayerStatus) => {
    save({ ...dayData, [key]: s });
    setPickerPrayer(null);
  }, [dayData, selKey]);

  const changeMonth = (d: number) => {
    let m = vMonth + d, y = vYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    setVYear(y); setVMonth(m); setSelDay(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const goToday = () => {
    setVYear(now.getFullYear()); setVMonth(now.getMonth()); setSelDay(now.getDate());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  /* Calendar */
  const gridDays: (number | null)[] = useMemo(() => {
    const first = firstDow(vYear, vMonth);
    const total = daysIn(vYear, vMonth);
    const arr: (number | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  }, [vYear, vMonth]);

  const weekDates = useMemo(() => {
    const d = new Date(vYear, vMonth, selDay);
    const dow = d.getDay();
    const start = new Date(d); start.setDate(start.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const w = new Date(start); w.setDate(w.getDate() + i); return w; });
  }, [vYear, vMonth, selDay]);

  const isFuture = (day: number) => new Date(vYear, vMonth, day) > now;
  const monthPrayed = Object.values(cache).reduce((s, d) => s + countDone(d), 0);

  return (
    <View style={[st.root, { backgroundColor: theme.surface }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        {/* ═══ HEADER ═══ */}
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[st.hdr, { paddingTop: insets.top + 6 }]}
        >
          <View style={st.hdrPat}>
            {[...Array(5)].map((_, i) => (
              <View key={i} style={[st.hdrCircle, {
                width: 100 + i * 50, height: 100 + i * 50,
                top: -10 + i * 8, right: -30 + i * 12, opacity: 0.03 + i * 0.008,
              }]} />
            ))}
          </View>

          <View style={st.hdrTop}>
            <TouchableOpacity style={st.hdrBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={st.hdrTitle}>Salah Tracker</Text>
            <TouchableOpacity style={st.hdrBtn} onPress={() => router.push('/tools/salah-settings')} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>

          <Ornament />

          {/* Stats */}
          <View style={st.statsRow}>
            <View style={st.statBox}>
              <CompletionRing count={completed} />
              <Text style={st.statLabel}>Today</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statBox}>
              <Text style={st.statBigNum}>{streak}</Text>
              <Text style={st.statLabel}>Day Streak 🔥</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statBox}>
              <Text style={st.statBigNum}>{monthPrayed}</Text>
              <Text style={st.statLabel}>This Month</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ═══ CALENDAR CARD ═══ */}
        <View style={[st.calCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
          {/* Month navigation */}
          <View style={st.calNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={st.calNavBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToday} activeOpacity={0.7}>
              <Text style={[st.calMonthText, { color: theme.text }]}>
                {MONTHS[vMonth]} <Text style={{ color: theme.textTertiary, fontWeight: '400' }}>{vYear}</Text>
              </Text>
            </TouchableOpacity>
            <View style={st.calNavRight}>
              <TouchableOpacity
                onPress={() => { LayoutAnimation.configureNext(LAYOUT_ANIM); setWeekly(!weekly); Haptics.selectionAsync().catch(() => {}); }}
                activeOpacity={0.7}
                style={[st.viewToggle, { backgroundColor: `${theme.primaryMuted}14` }]}
              >
                <Ionicons name={weekly ? 'grid-outline' : 'calendar-outline'} size={12} color={theme.primaryMuted} />
                <Text style={[st.viewToggleT, { color: theme.primaryMuted }]}>{weekly ? 'Month' : 'Week'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeMonth(1)} style={st.calNavBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar body: fixed minHeight prevents layout jump on toggle */}
          <View style={{ minHeight: weekly ? 90 : undefined }}>
          {/* Weekday headers */}
          <View style={st.dowRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={d} style={[st.dowText, { color: i === 5 ? theme.primary : theme.textTertiary }]}>{d}</Text>
            ))}
          </View>

          {/* MONTH GRID or WEEK STRIP */}
          {weekly ? (
            <View style={st.weekStrip}>
              {weekDates.map((wd, i) => {
                const key = dk(wd.getFullYear(), wd.getMonth(), wd.getDate());
                const data = cache[key];
                const prayed = data ? countDone(data) : 0;
                const sel = wd.getDate() === selDay && wd.getMonth() === vMonth && wd.getFullYear() === vYear;
                const isT = wd.toDateString() === now.toDateString();
                const fut = wd > now;

                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setVYear(wd.getFullYear()); setVMonth(wd.getMonth()); setSelDay(wd.getDate());
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    activeOpacity={0.7}
                    style={[st.wDay, sel && { backgroundColor: theme.primary, borderRadius: 16 }]}
                  >
                    <Text style={[st.wDayLabel, { color: sel ? 'rgba(255,255,255,0.7)' : theme.textTertiary }]}>{WEEKDAYS[i]}</Text>
                    <Text style={[st.wDayNum, { color: sel ? '#fff' : fut ? `${theme.textTertiary}50` : theme.text }, isT && !sel && { color: theme.primary }]}>{wd.getDate()}</Text>
                    {prayed > 0 && !fut && (
                      <View style={st.wDots}>
                        {prayed === 5 ? (
                          <View style={[st.wDotFull, { backgroundColor: sel ? 'rgba(255,255,255,0.8)' : theme.primary }]} />
                        ) : (
                          Array.from({ length: prayed }, (_, j) => (
                            <View key={j} style={[st.wDotSmall, { backgroundColor: sel ? 'rgba(255,255,255,0.6)' : theme.gold }]} />
                          ))
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={st.calGrid}>
              {gridDays.map((day, i) => {
                if (day === null) return <View key={`e-${i}`} style={st.calCell} />;
                const key = dk(vYear, vMonth, day);
                const data = cache[key];
                const prayed = data ? countDone(data) : 0;
                const sel = day === selDay;
                const isT = vYear === now.getFullYear() && vMonth === now.getMonth() && day === now.getDate();
                const fut = isFuture(day);

                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => { if (!fut) { setSelDay(day); Haptics.selectionAsync().catch(() => {}); } }}
                    activeOpacity={fut ? 1 : 0.7}
                    style={[
                      st.calCell,
                      sel && [st.calSel, { backgroundColor: theme.primary }],
                      isT && !sel && [st.calToday, { borderColor: theme.primaryMuted }],
                    ]}
                  >
                    <Text style={[
                      st.calDayT,
                      { color: fut ? `${theme.textTertiary}45` : theme.text },
                      sel && { color: '#fff', fontWeight: '700' },
                      isT && !sel && { color: theme.primary, fontWeight: '700' },
                    ]}>{day}</Text>
                    {prayed > 0 && !fut && (
                      <View style={st.calDots}>
                        {prayed === 5 ? (
                          <View style={[st.calDotFull, { backgroundColor: sel ? 'rgba(255,255,255,0.8)' : theme.primary }]} />
                        ) : (
                          Array.from({ length: Math.min(prayed, 5) }, (_, j) => (
                            <View key={j} style={[st.calDotSm, { backgroundColor: sel ? 'rgba(255,255,255,0.55)' : theme.gold }]} />
                          ))
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          </View>
        </View>

        {/* ═══ SELECTED DATE ═══ */}
        <View style={st.dateLabelRow}>
          <View style={[st.dateChip, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="calendar-outline" size={13} color={theme.primaryMuted} />
            <Text style={[st.dateChipT, { color: theme.text }]}>
              {isToday ? 'Today' : `${MONTHS[vMonth].slice(0, 3)} ${selDay}, ${vYear}`}
            </Text>
            {completed === 5 && (
              <View style={[st.doneBadge, { backgroundColor: `${theme.primary}12` }]}>
                <Ionicons name="checkmark-circle" size={12} color={theme.primary} />
                <Text style={[st.doneBadgeT, { color: theme.primary }]}>Complete</Text>
              </View>
            )}
          </View>
        </View>

        {/* ═══ PRAYER CARDS ═══ */}
        <View style={st.pList}>
          {PRAYERS.map((p) => (
            <PrayerCard
              key={p.key}
              prayer={p}
              status={dayData[p.key]}
              onTap={() => cycle(p.key)}
              onLong={() => { setPickerPrayer(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }}
            />
          ))}
        </View>

        {/* ═══ LEGEND ═══ */}
        <View style={[st.legend, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[st.legendHint, { color: theme.textTertiary }]}>TAP TO CYCLE  •  LONG PRESS FOR OPTIONS</Text>
          <View style={st.legendGrid}>
            {STATUS_CYCLE.filter((x) => x !== 'none').map((s) => {
              const inf = STATUS_INFO[s];
              return (
                <View key={s} style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: `${inf.color}18` }]}>
                    <Ionicons name={inf.icon as any} size={13} color={inf.color} />
                  </View>
                  <Text style={[st.legendLabel, { color: theme.textTertiary }]}>{inf.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Status picker bottom sheet */}
      <StatusSheet
        visible={!!pickerPrayer}
        prayer={pickerPrayer}
        current={pickerPrayer ? dayData[pickerPrayer.key] : 'none'}
        onSelect={(s) => pickerPrayer && setStatus(pickerPrayer.key, s)}
        onClose={() => setPickerPrayer(null)}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },

  /* Ornament */
  ornRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 4 },
  ornLine: { width: 28, height: 1 },
  ornDm: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },

  /* Header */
  hdr: { paddingHorizontal: 20, paddingBottom: 22, overflow: 'hidden' },
  hdrPat: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  hdrCircle: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  hdrTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  hdrBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginTop: 6 },
  statBox: { alignItems: 'center', gap: 6, flex: 1 },
  statBigNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.2 },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },

  /* Completion Ring */
  ringBg: { position: 'absolute', borderWidth: 3 },
  ringDot: { position: 'absolute' },
  ringText: { fontWeight: '800' },

  /* Calendar */
  calCard: { marginHorizontal: 16, marginTop: -10, borderRadius: 20, borderWidth: 1, padding: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 }, android: { elevation: 3 } }) },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calNavBtn: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  calMonthText: { fontSize: 16, fontWeight: '700' },
  calNavRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  viewToggleT: { fontSize: 11, fontWeight: '600' },

  dowRow: { flexDirection: 'row', marginBottom: 6 },
  dowText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  calSel: { borderRadius: 14 },
  calToday: { borderRadius: 14, borderWidth: 1.5 },
  calDayT: { fontSize: 14, fontWeight: '500' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 2, height: 6, alignItems: 'center' },
  calDotSm: { width: 4, height: 4, borderRadius: 2 },
  calDotFull: { width: 6, height: 6, borderRadius: 3 },

  /* Week strip */
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  wDay: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, flex: 1, gap: 4 },
  wDayLabel: { fontSize: 10, fontWeight: '600' },
  wDayNum: { fontSize: 16, fontWeight: '700' },
  wDots: { flexDirection: 'row', gap: 2, height: 6 },
  wDotSmall: { width: 3, height: 3, borderRadius: 1.5 },
  wDotFull: { width: 6, height: 6, borderRadius: 3 },

  /* Date label */
  dateLabelRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 18, marginBottom: 6 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  dateChipT: { fontSize: 13, fontWeight: '600' },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 4 },
  doneBadgeT: { fontSize: 10, fontWeight: '700' },

  /* Prayer card */
  pList: { paddingHorizontal: 16, paddingTop: 6, gap: 8 },
  pCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingVertical: 6, paddingLeft: 0, paddingRight: 10, overflow: 'hidden', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 2 } }) },
  pAccentBar: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, opacity: 0.7 },
  pBadge: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 10, marginRight: 12 },
  pCenter: { flex: 1, gap: 5 },
  pNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  pName: { fontSize: 16, fontWeight: '700' },
  pArabic: { fontSize: 15 },
  pStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  pStatusText: { fontSize: 10, fontWeight: '600' },
  pDots: { flexDirection: 'column', gap: 4, paddingLeft: 8 },
  pDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  /* Legend */
  legend: { marginHorizontal: 16, marginTop: 20, borderRadius: 16, borderWidth: 1, padding: 14 },
  legendHint: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', marginBottom: 12 },
  legendGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  legendItem: { alignItems: 'center', gap: 5 },
  legendDot: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  legendLabel: { fontSize: 9, fontWeight: '500' },

  /* Sheet */
  sheetBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 22, paddingBottom: 34, ...Platform.select({ ios: { shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20 }, android: { elevation: 10 } }) },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  sheetBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetArabic: { fontSize: 15, marginTop: 2 },
  sheetOpts: { gap: 8 },
  sheetOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5 },
  sheetOptIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetOptLabel: { fontSize: 14, fontWeight: '600' },
});
