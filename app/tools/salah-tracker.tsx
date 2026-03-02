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
  Dimensions, Platform, Animated, LayoutAnimation, UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { DataSyncService } from '@/lib/dataSyncService';
import { PrayerTimesService, PrayerTimesData } from '@/lib/prayerTimes';
import { NotificationService } from '@/lib/notificationService';
import { ReadingProgress } from '@/lib/readingProgress';

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

/**
 * TIME-BASED PRAYER ACTIVATION LOGIC
 * Returns which prayers should be enabled based on current time.
 * Before Fajr → none clickable
 * At Fajr time → only Fajr clickable
 * At Dhuhr time → Fajr + Dhuhr clickable
 * And so on until all prayers are clickable after Isha time
 */
const getEnabledPrayers = (prayerTimes: PrayerTimesData | null): Record<PrayerKey, boolean> => {
  const result: Record<PrayerKey, boolean> = {
    fajr: false, zuhr: false, asr: false, maghrib: false, isha: false,
  };
  
  if (!prayerTimes) {
    // If no prayer times available, enable all (fallback)
    return { fajr: true, zuhr: true, asr: true, maghrib: true, isha: true };
  }
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const parseTime = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  
  const fajrMins = parseTime(prayerTimes.Fajr);
  const zuhrMins = parseTime(prayerTimes.Dhuhr);
  const asrMins = parseTime(prayerTimes.Asr);
  const maghribMins = parseTime(prayerTimes.Maghrib);
  const ishaMins = parseTime(prayerTimes.Isha);
  
  // Enable prayers progressively based on current time
  if (currentMinutes >= fajrMins) result.fajr = true;
  if (currentMinutes >= zuhrMins) result.zuhr = true;
  if (currentMinutes >= asrMins) result.asr = true;
  if (currentMinutes >= maghribMins) result.maghrib = true;
  if (currentMinutes >= ishaMins) result.isha = true;
  
  return result;
};

/**
 * Check if a date is in the future (cannot mark prayers for future dates)
 */
const isDateInFuture = (year: number, month: number, day: number): boolean => {
  const today = new Date();
  const checkDate = new Date(year, month, day);
  today.setHours(0, 0, 0, 0);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate > today;
};

/** Safe JSON parse — returns null on corrupt data instead of crashing */
function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

/** Validate that an object is a valid DayData (all 5 prayer keys present with valid status) */
const VALID_STATUSES = new Set<string>(['none', 'prayed', 'jamaah', 'qasr', 'missed']);
function validateDayData(obj: any): DayData {
  if (!obj || typeof obj !== 'object') return { ...EMPTY_DAY };
  const result = { ...EMPTY_DAY };
  for (const key of ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]) {
    if (obj[key] && VALID_STATUSES.has(obj[key])) {
      result[key] = obj[key] as PrayerStatus;
    }
  }
  return result;
}

/**
 * Unwrap salah data that may be stored in {data: {...}, updatedAt} wrapper
 * from DataSyncService.saveLocal. Handles both wrapped and flat formats.
 */
function unwrapSalahData(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  // DataSyncService.saveLocal wraps as {data: actualPayload, updatedAt: ts}
  if (raw.data !== undefined && typeof raw.data === 'object' && !('fajr' in raw)) {
    return raw.data;
  }
  return raw;
}

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
  prayer, status, onTap, onLong, disabled = false,
}: {
  prayer: typeof PRAYERS[0]; status: PrayerStatus;
  onTap: () => void; onLong: () => void; disabled?: boolean;
}) {
  const { theme } = useTheme();
  const info = STATUS_INFO[status];
  const done = status === 'prayed' || status === 'jamaah' || status === 'qasr';
  const missed = status === 'missed';
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (disabled) return; // Prevent interaction when disabled
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onTap();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.5 : 1 }}>
      <TouchableOpacity
        onPress={press}
        onLongPress={disabled ? undefined : onLong}
        delayLongPress={350}
        activeOpacity={disabled ? 1 : 0.9}
        disabled={disabled}
        style={[
          st.pCard,
          { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor },
          done && { borderColor: `${info.color}25` },
          missed && { borderColor: `${info.color}20` },
          disabled && { borderColor: `${theme.textTertiary}20` },
        ]}
      >
        {/* Gradient accent bar */}
        <LinearGradient
          colors={prayer.gradient}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[st.pAccentBar, done && { opacity: 1 }, missed && { opacity: 0.4 }, disabled && { opacity: 0.3 }]}
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
/* ═══ Error Boundary — catches any render crash in this screen ═══ */
class SalahErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) {
    if (__DEV__) console.error('[SalahTracker] Render crash caught:', err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export default function SalahTrackerScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SalahErrorBoundary
      fallback={
        <View style={[st.root, { backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
          <Ionicons name="warning-outline" size={48} color={theme.textTertiary} />
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 16 }}>Something went wrong</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            The Salah Tracker encountered an error. Please go back and try again.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 24, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <SalahTrackerInner />
    </SalahErrorBoundary>
  );
}

function SalahTrackerInner() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  // Use a ref for "now" so it's fresh on re-renders but stable within a render
  const nowRef = useRef(new Date());
  const now = nowRef.current;

  const [vYear, setVYear] = useState(now.getFullYear());
  const [vMonth, setVMonth] = useState(now.getMonth());
  const [selDay, setSelDay] = useState(now.getDate());
  const [dayData, setDayData] = useState<DayData>({ ...EMPTY_DAY });
  const [cache, setCache] = useState<Record<string, DayData>>({});
  const [pickerPrayer, setPickerPrayer] = useState<typeof PRAYERS[0] | null>(null);
  const [streak, setStreak] = useState(0);
  const [ready, setReady] = useState(false);
  
  // NEW: Prayer times for time-based activation logic
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesData | null>(null);

  // Ref to track locally-saved prayer data — survives cache resets from loadMonth/cloud sync
  const savedRef = useRef<Record<string, DayData>>({});
  // Ref to always point to the latest loadMonth function (fixes stale closure in cloud sync)
  const loadMonthRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const selKey = dk(vYear, vMonth, selDay);
  const isToday = vYear === now.getFullYear() && vMonth === now.getMonth() && selDay === now.getDate();
  
  // NEW: Check if selected date is in the future (disable prayer marking)
  const isFutureDate = isDateInFuture(vYear, vMonth, selDay);
  
  // NEW: Get which prayers are enabled based on current time (only for today)
  const enabledPrayers = useMemo(() => {
    if (isFutureDate) {
      // Future dates: all prayers disabled
      return { fajr: false, zuhr: false, asr: false, maghrib: false, isha: false };
    }
    if (!isToday) {
      // Past dates: all prayers enabled
      return { fajr: true, zuhr: true, asr: true, maghrib: true, isha: true };
    }
    // Today: time-based activation
    return getEnabledPrayers(prayerTimes);
  }, [isFutureDate, isToday, prayerTimes]);
  const completed = countDone(dayData);

  // Cleanup: mark unmounted to prevent stale setState calls
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // NEW: Load prayer times for time-based activation
  useEffect(() => {
    const loadPrayerTimes = async () => {
      try {
        const cached = await PrayerTimesService.getCachedPrayerTimes();
        if (cached && isMounted.current) {
          setPrayerTimes(cached.data);
        }
      } catch (e) {
        if (__DEV__) console.warn('[SalahTracker] loadPrayerTimes error:', e);
      }
    };
    loadPrayerTimes();
    
    // Update enabled prayers every minute for real-time activation
    const interval = setInterval(() => {
      if (isMounted.current && isToday) {
        setPrayerTimes((prev) => prev ? { ...prev } : null); // Trigger re-render
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [isToday]);

  // NEW: End-of-day reminder - check after Isha if any prayers are untracked
  useEffect(() => {
    const checkEndOfDayReminder = async () => {
      if (!prayerTimes || !isToday) return;
      
      // Parse Isha time
      const [ishaH, ishaM] = prayerTimes.Isha.split(':').map(Number);
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const ishaMinutes = ishaH * 60 + ishaM;
      
      // Only check after Isha time (30 min buffer to allow marking Isha)
      if (currentMinutes < ishaMinutes + 30) return;
      
      // Count untracked prayers for today
      const untrackedCount = Object.values(dayData).filter(
        (status) => status === 'none'
      ).length;
      
      // Send reminder if there are untracked prayers
      if (untrackedCount > 0) {
        await NotificationService.sendEndOfDayReminder(untrackedCount);
      }
    };
    
    // Check once when component mounts/updates, and set up periodic check
    checkEndOfDayReminder();
    const interval = setInterval(checkEndOfDayReminder, 30 * 60 * 1000); // Every 30 min
    
    return () => clearInterval(interval);
  }, [prayerTimes, isToday, dayData]);

  /* ─── Data ─── */
  const loadMonth = async () => {
    try {
      const days = daysIn(vYear, vMonth);
      const keys = Array.from({ length: days }, (_, i) => sk(dk(vYear, vMonth, i + 1)));
      
      // Load from local AsyncStorage first (instant)
      const res = await AsyncStorage.multiGet(keys);
      if (!isMounted.current) return;

      const c: Record<string, DayData> = {};
      for (const [k, v] of res) {
        if (!v) continue;
        const parsed = safeJsonParse<any>(v);
        if (parsed) {
          const dateKey = k.replace('sukoon_salah_', '');
          c[dateKey] = validateDayData(unwrapSalahData(parsed));
        }
      }
      
      // Merge with cloud data in background (handles data restored from another device)
      DataSyncService.loadSalahMonthFromCloud(vYear, vMonth).then((cloudData) => {
        if (!isMounted.current) return;
        if (Object.keys(cloudData).length > 0) {
          const merged = { ...c };
          let hasNewData = false;
          
          for (const [dateKey, dayData] of Object.entries(cloudData)) {
            if (!merged[dateKey]) {
              // Cloud has data we don't have locally - add it
              merged[dateKey] = validateDayData(dayData);
              hasNewData = true;
              // Also save to AsyncStorage for offline access
              AsyncStorage.setItem(sk(dateKey), JSON.stringify(dayData)).catch(() => {});
            }
          }
          
          if (hasNewData) {
            setCache((prev) => {
              const result = { ...prev, ...merged };
              // Preserve locally-saved data
              for (const [key, val] of Object.entries(savedRef.current)) {
                result[key] = val;
              }
              return result;
            });
          }
        }
      }).catch(() => {});
      
      setCache(prev => {
        const merged = { ...prev, ...c };
        // Preserve any locally-saved data that might not be in AsyncStorage yet
        for (const [key, val] of Object.entries(savedRef.current)) {
          merged[key] = val;
        }
        return merged;
      });
    } catch (e) {
      if (__DEV__) console.warn('[SalahTracker] loadMonth error:', e);
    } finally {
      if (isMounted.current && !ready) setReady(true);
    }
  };

  const loadDay = async () => {
    try {
      // 1) Check locally-saved ref first (highest priority, survives cache resets)
      const localSave = savedRef.current[selKey];
      if (localSave) {
        if (isMounted.current) {
          setDayData(localSave);
          setCache(prev => ({ ...prev, [selKey]: localSave }));
        }
        return;
      }

      // 2) Check in-memory cache next
      if (cache[selKey]) {
        if (isMounted.current) setDayData(cache[selKey]);
        return;
      }
      
      // Try local AsyncStorage next
      const v = await AsyncStorage.getItem(sk(selKey));
      if (!isMounted.current) return;
      
      let dayDataResult: DayData;
      const parsed = safeJsonParse<any>(v);
      
      if (parsed) {
        dayDataResult = validateDayData(unwrapSalahData(parsed));
      } else {
        // No local data - try cloud
        const cloudData = await DataSyncService.loadSalahDay(selKey);
        if (cloudData && isMounted.current) {
          dayDataResult = validateDayData(cloudData);
          // Cache locally
          await AsyncStorage.setItem(sk(selKey), JSON.stringify(dayDataResult));
        } else {
          dayDataResult = { ...EMPTY_DAY };
        }
      }
      
      setDayData(dayDataResult);
      // Also update cache to keep in sync
      setCache((prev) => ({ ...prev, [selKey]: dayDataResult }));
    } catch (e) {
      if (__DEV__) console.warn('[SalahTracker] loadDay error:', e);
      if (isMounted.current) setDayData({ ...EMPTY_DAY });
    }
  };

  // save uses functional setState to always operate on latest dayData (prevents stale closure race)
  const save = useCallback(async (data: DayData) => {
    setDayData(data);
    setCache((prev) => ({ ...prev, [selKey]: data }));
    // Persist in ref so data survives any cache resets from loadMonth / cloud sync
    savedRef.current = { ...savedRef.current, [selKey]: data };
    
    // Add timestamp for cloud sync conflict resolution
    const dataWithTimestamp = { ...data, updatedAt: Date.now() };
    
    // SINGLE SAVE PATH: DataSyncService handles both local + cloud persistence
    // This avoids the previous double-write bug where saveLocal() wrapped data
    // in {data: {...}, updatedAt} and overwrote the direct AsyncStorage save.
    try {
      await DataSyncService.saveSalahData(selKey, dataWithTimestamp);
    } catch (e) {
      if (__DEV__) console.warn('[SalahTracker] primary save failed, using fallback:', e);
      // Emergency fallback: direct AsyncStorage save if DataSyncService fails
      try {
        await AsyncStorage.setItem(sk(selKey), JSON.stringify(dataWithTimestamp));
      } catch (e2) {
        if (__DEV__) console.error('[SalahTracker] fallback save also failed:', e2);
      }
    }
    
    // Record completion for insights/streak tracking
    const completedCount = countDone(data);
    ReadingProgress.recordSalahCompletion(selKey, completedCount).catch(() => {});
  }, [selKey]);

  const calcStreak = useCallback(() => {
    let cnt = 0;
    // Use fresh Date() for streak calc — not the stale `now` from initial render
    const today = new Date();
    const d = new Date(today);
    for (let i = 0; i < 365; i++) {
      const k = dk(d.getFullYear(), d.getMonth(), d.getDate());
      const data = cache[k];
      if (data && countDone(data) === 5) {
        cnt++;
        d.setDate(d.getDate() - 1);
      } else if (i === 0) {
        // Today might not be complete yet — skip to yesterday
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    if (isMounted.current) setStreak(cnt);
  }, [cache]);

  // Keep loadMonth ref up-to-date so cloud sync always uses latest version
  loadMonthRef.current = loadMonth;

  // Initial sync from cloud on mount
  useEffect(() => {
    const syncFromCloud = async () => {
      try {
        await DataSyncService.init();
        // Sync current month from Firestore
        await DataSyncService.syncSalahMonth(vYear, vMonth);
        // Reload after sync — use ref to get the latest loadMonth (avoids stale closure)
        await loadMonthRef.current();
      } catch (e) {
        if (__DEV__) console.warn('[SalahTracker] Cloud sync error:', e);
      }
    };
    syncFromCloud();
  }, []); // Only on mount

  useEffect(() => { loadMonth(); }, [vYear, vMonth]);
  useEffect(() => { loadDay(); }, [selKey]);
  useEffect(() => { calcStreak(); }, [cache]);

  // cycle uses functional update to guarantee latest dayData
  const cycle = useCallback((key: PrayerKey) => {
    setDayData((prev) => {
      const cur = prev[key];
      const idx = STATUS_CYCLE.indexOf(cur);
      const next = { ...prev, [key]: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] };
      save(next);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [save]);

  const setStatus = useCallback((key: PrayerKey, s: PrayerStatus) => {
    setDayData((prev) => {
      const next = { ...prev, [key]: s };
      save(next);
      return next;
    });
    setPickerPrayer(null);
  }, [save]);

  const changeMonth = useCallback((d: number) => {
    let m = vMonth + d, y = vYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    setVYear(y); setVMonth(m); setSelDay(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [vMonth, vYear]);

  const goToday = useCallback(() => {
    const t = new Date();
    setVYear(t.getFullYear()); setVMonth(t.getMonth()); setSelDay(t.getDate());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  /* Calendar */
  const gridDays: (number | null)[] = useMemo(() => {
    const first = firstDow(vYear, vMonth);
    const total = daysIn(vYear, vMonth);
    const arr: (number | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  }, [vYear, vMonth]);

  /* Calendar - REMOVED weekDates since weekly view was removed */
  const isFuture = useCallback((day: number) => {
    const today = new Date();
    return new Date(vYear, vMonth, day) > today;
  }, [vYear, vMonth]);
  const monthPrayed = useMemo(() => Object.values(cache).reduce((s, d) => s + countDone(d), 0), [cache]);

  // Show loading state on first mount while AsyncStorage loads
  if (!ready) {
    return (
      <View style={[st.root, { backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: theme.primary, borderTopColor: 'transparent' }} />
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: theme.surface }]}>
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
          {/* Month navigation - REMOVED weekly toggle button */}
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
              <TouchableOpacity onPress={() => changeMonth(1)} style={st.calNavBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar body: MONTH GRID ONLY (removed weekly strip) */}
          <View>
          {/* Weekday headers */}
          <View style={st.dowRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={d} style={[st.dowText, { color: i === 5 ? theme.primary : theme.textTertiary }]}>{d}</Text>
            ))}
          </View>

          {/* MONTH GRID - display-only, only selected day allows prayer interaction */}
          <View style={st.calGrid}>
            {gridDays.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={st.calCell} />;
              const key = dk(vYear, vMonth, day);
              const data = cache[key];
              const prayed = data ? countDone(data) : 0;
              const sel = day === selDay;
              const td = new Date();
              const isT = vYear === td.getFullYear() && vMonth === td.getMonth() && day === td.getDate();
              const fut = isFuture(day);

              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => { 
                    // Allow selecting any day to view, but prayers can only be marked for past/today
                    setSelDay(day); 
                    Haptics.selectionAsync().catch(() => {}); 
                  }}
                  activeOpacity={0.7}
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
          {/* Show message if future date selected */}
          {isFutureDate && (
            <View style={[st.futureNotice, { backgroundColor: `${theme.gold}14`, borderColor: `${theme.gold}25` }]}>
              <Ionicons name="time-outline" size={16} color={theme.gold} />
              <Text style={[st.futureNoticeText, { color: theme.textSecondary }]}>
                Cannot mark prayers for future dates
              </Text>
            </View>
          )}
          {PRAYERS.map((p) => (
            <PrayerCard
              key={p.key}
              prayer={p}
              status={dayData[p.key]}
              onTap={() => cycle(p.key)}
              onLong={() => { setPickerPrayer(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }}
              disabled={!enabledPrayers[p.key]}
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
  
  /* Future date notice */
  futureNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  futureNoticeText: { fontSize: 13, fontWeight: '500' },

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
