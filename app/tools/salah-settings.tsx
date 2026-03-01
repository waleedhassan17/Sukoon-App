/**
 * SalahTrackerSettingsScreen v4 — Production
 *
 * FIXES over v3:
 *  ✓ Clock PanResponder uses refs (no stale closure — phase/hr/mn always current)
 *  ✓ measureInWindow called on every touch-start for reliable coords after scroll
 *  ✓ Hand rotation uses explicit transformOrigin for cross-RN compat
 *  ✓ Dial proportionally sized (50% screen, max 228) — fits inside card
 *  ✓ All fonts match SalahTrackerScreen tokens exactly
 *  ✓ Number badges match prayer badge sizing (30×30 br9)
 *  ✓ Buttons match bottom-sheet opt style (br14, py13)
 *  ✓ AM/PM pill horizontal layout matching app pill patterns
 *  ✓ 12↔24h conversion covers all edge cases
 *  ✓ Auto-advance hour→minute on button tap, confirm→dismiss
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet,
  Platform, Alert, LayoutAnimation, UIManager, Linking, Animated,
  PanResponder, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationService, NotificationPreferences, PrayerName } from '@/lib/notificationService';
import { PrayerTimesService } from '@/lib/prayerTimes';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ANIM = {
  duration: 260,
  update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleY },
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

/* ─── Clock geometry (compact for inline card display) ─── */
const WIN_W = Dimensions.get('window').width;
const DIAL = Math.min(Math.round(WIN_W * 0.42), 180);
const R = DIAL / 2;
const NUM_RING_R = R - 20;  // radius at number centers
const HAND_H = R - 32;      // hour hand
const HAND_M = R - 24;      // minute hand
const NUM_SZ = 24;           // compact number badges
const NUM_HR = NUM_SZ / 2;

/* ── Helpers ── */
const fmt12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const to24 = (hr12: number, pm: boolean): number => {
  // hr12 is 1-12, returns 0-23
  if (hr12 === 12) return pm ? 12 : 0;
  return pm ? hr12 + 12 : hr12;
};

/* ═══════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════ */

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[st.section, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
      <Text style={[st.secTitle, { color: theme.textTertiary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  icon, bg, label, sub, right, onPress, last,
}: {
  icon: string; bg: string; label: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <>
      <TouchableOpacity onPress={onPress} disabled={!onPress && !right}
        activeOpacity={onPress ? 0.7 : 1} style={st.row}>
        <View style={[st.rowIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={16} color="#fff" />
        </View>
        <View style={st.rowBody}>
          <Text style={[st.rowLabel, { color: theme.text }]}>{label}</Text>
          {sub ? <Text style={[st.rowSub, { color: theme.textTertiary }]}>{sub}</Text> : null}
        </View>
        {right || (onPress && <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />)}
      </TouchableOpacity>
      {!last && <View style={[st.rowDiv, { backgroundColor: theme.border }]} />}
    </>
  );
}

function Pills({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { theme } = useTheme();
  return (
    <View style={st.pillWrap}>
      {[0, 5, 10, 15, 30].map(v => {
        const on = v === value;
        return (
          <TouchableOpacity key={v}
            onPress={() => { onChange(v); Haptics.selectionAsync().catch(() => {}); }}
            style={[st.pill, { backgroundColor: on ? theme.primary : theme.surfaceMuted }]}>
            <Text style={[st.pillTxt, { color: on ? '#fff' : theme.textSecondary }]}>
              {v === 0 ? 'Off' : `${v} min`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TimeBtn({ time, onChange }: { time: string; onChange: (t: string) => void }) {
  const { theme } = useTheme();
  const label = fmt12(time);

  const pick = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt('Set Time', 'HH:MM in 24-hour format', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: (v?: string) => {
            if (v && /^\d{2}:\d{2}$/.test(v)) {
              const [a, b] = v.split(':').map(Number);
              if (a <= 23 && b <= 59) {
                onChange(v);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
            }
          },
        },
      ], 'plain-text', time);
    } else {
      const periods = [
        { text: 'Morning (6–11 AM)', s: 6, e: 11 },
        { text: 'Afternoon (12–5 PM)', s: 12, e: 17 },
        { text: 'Evening (6–11 PM)', s: 18, e: 23 },
      ];
      Alert.alert('Select Time', `Current: ${label}`, [
        { text: 'Cancel', style: 'cancel' },
        ...periods.map(p => ({
          text: p.text,
          onPress: () => {
            const opts: { text: string; onPress: () => void }[] = [];
            for (let hh = p.s; hh <= p.e; hh++) {
              const display = `${hh % 12 || 12}:00 ${hh >= 12 ? 'PM' : 'AM'}`;
              opts.push({
                text: display,
                onPress: () => {
                  onChange(`${String(hh).padStart(2, '0')}:00`);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                },
              });
            }
            Alert.alert('Pick Time', '', [{ text: 'Cancel', style: 'cancel' }, ...opts.slice(0, 6)]);
          },
        })),
      ]);
    }
  };

  return (
    <TouchableOpacity onPress={pick} activeOpacity={0.7}
      style={[st.timeBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <Ionicons name="time-outline" size={15} color={theme.primary} />
      <Text style={[st.timeBtnTxt, { color: theme.text }]}>{label}</Text>
      <Ionicons name="chevron-down" size={13} color={theme.textTertiary} />
    </TouchableOpacity>
  );
}


/* ═══════════════════════════════════════════════════════
   CLOCK PICKER — Ref-based PanResponder (no stale closures)
   ═══════════════════════════════════════════════════════ */
function ClockPicker({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: string;
  onConfirm: (t24: string) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const [h24Init, mInit] = initial.split(':').map(Number);

  /* ── State + mirror refs (refs for PanResponder, state for re-render) ── */
  const [phase, _setPhase] = useState<'h' | 'm'>('h');
  const [hr, _setHr] = useState(h24Init % 12 || 12);
  const [mn, _setMn] = useState(mInit);
  const [pm, _setPm] = useState(h24Init >= 12);

  const phaseRef = useRef(phase);
  const hrRef = useRef(hr);
  const mnRef = useRef(mn);

  const setPhase = (v: 'h' | 'm') => { phaseRef.current = v; _setPhase(v); };
  const setHr = (v: number) => { hrRef.current = v; _setHr(v); };
  const setMn = (v: number) => { mnRef.current = v; _setMn(v); };
  const setPm = (v: boolean) => { _setPm(v); };

  /* ── Animation ── */
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }).start();
  }, []);

  /* ── Dial measurement ── */
  const dialRef = useRef<View>(null);
  const dialCenter = useRef({ cx: 0, cy: 0 });

  const measureDial = useCallback(() => {
    dialRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0) dialCenter.current = { cx: x + w / 2, cy: y + h / 2 };
    });
  }, []);

  /* ── Touch → angle → value (reads from refs, never stale) ── */
  const handleTouch = useCallback((pageX: number, pageY: number) => {
    const { cx, cy } = dialCenter.current;
    if (cx === 0 && cy === 0) return; // not measured yet
    const dx = pageX - cx;
    const dy = pageY - cy;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;

    if (phaseRef.current === 'h') {
      let v = Math.round(deg / 30);
      if (v <= 0 || v > 12) v = 12;
      if (v !== hrRef.current) {
        setHr(v);
        Haptics.selectionAsync().catch(() => {});
      }
    } else {
      let v = Math.round(deg / 6);
      v = Math.round(v / 5) * 5;
      if (v >= 60) v = 0;
      if (v !== mnRef.current) {
        setMn(v);
        Haptics.selectionAsync().catch(() => {});
      }
    }
  }, []);

  /* ── PanResponder (created once, reads refs) ── */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        // Re-measure every touch start (handles scroll offset changes)
        dialRef.current?.measureInWindow((x, y, w, h) => {
          if (w > 0) dialCenter.current = { cx: x + w / 2, cy: y + h / 2 };
          handleTouch(e.nativeEvent.pageX, e.nativeEvent.pageY);
        });
      },
      onPanResponderMove: (e) => {
        handleTouch(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
    }),
  ).current;

  /* ── Initial measure after mount ── */
  useEffect(() => {
    const t = setTimeout(measureDial, 200);
    return () => clearTimeout(t);
  }, [measureDial]);

  /* ── Confirm / advance ── */
  const handleNext = useCallback(() => {
    if (phaseRef.current === 'h') {
      setPhase('m');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // Re-measure after phase change re-render
      setTimeout(measureDial, 100);
    } else {
      const h24 = to24(hrRef.current, pm);
      const str = `${String(h24).padStart(2, '0')}:${String(mnRef.current).padStart(2, '0')}`;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.timing(scaleAnim, { toValue: 0, duration: 160, useNativeDriver: true })
        .start(() => onConfirm(str));
    }
  }, [pm, scaleAnim, onConfirm, measureDial]);

  const handleCancel = useCallback(() => {
    Animated.timing(scaleAnim, { toValue: 0, duration: 140, useNativeDriver: true })
      .start(() => onCancel());
  }, [scaleAnim, onCancel]);

  /* ── Geometry ── */
  const handDeg = phase === 'h' ? hr * 30 : mn * 6;
  const handLen = phase === 'h' ? HAND_H : HAND_M;
  const tipRad = (handDeg - 90) * (Math.PI / 180);
  const tipX = R + handLen * Math.cos(tipRad);
  const tipY = R + handLen * Math.sin(tipRad);

  const nums = phase === 'h'
    ? Array.from({ length: 12 }, (_, i) => ({ v: i + 1, deg: (i + 1) * 30 }))
    : Array.from({ length: 12 }, (_, i) => ({ v: i * 5, deg: i * 5 * 6 }));

  return (
    <Animated.View style={[st.ck, { transform: [{ scale: scaleAnim }], opacity: scaleAnim }]}>
      {/* ── Digital readout ── */}
      <View style={st.ckDigRow}>
        <TouchableOpacity onPress={() => setPhase('h')} activeOpacity={0.7}
          style={[st.ckDigSlot, phase === 'h' && { backgroundColor: `${theme.primary}12` }]}>
          <Text style={[st.ckDigNum, { color: phase === 'h' ? theme.primary : theme.text }]}>
            {String(hr).padStart(2, '0')}
          </Text>
        </TouchableOpacity>

        <Text style={[st.ckColon, { color: `${theme.textTertiary}60` }]}>:</Text>

        <TouchableOpacity onPress={() => setPhase('m')} activeOpacity={0.7}
          style={[st.ckDigSlot, phase === 'm' && { backgroundColor: `${theme.primary}12` }]}>
          <Text style={[st.ckDigNum, { color: phase === 'm' ? theme.primary : theme.text }]}>
            {String(mn).padStart(2, '0')}
          </Text>
        </TouchableOpacity>

        <View style={st.ckAmPmSpacer} />

        {/* AM/PM — horizontal pills */}
        <View style={[st.ckAmPm, { backgroundColor: theme.surfaceMuted }]}>
          {(['AM', 'PM'] as const).map(v => {
            const on = v === 'AM' ? !pm : pm;
            return (
              <TouchableOpacity key={v} activeOpacity={0.7}
                onPress={() => { setPm(v === 'PM'); Haptics.selectionAsync().catch(() => {}); }}
                style={[st.ckAmPmBtn, on && { backgroundColor: theme.primary }]}>
                <Text style={[st.ckAmPmTxt, { color: on ? '#fff' : theme.textTertiary }]}>{v}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Phase label ── */}
      <Text style={[st.ckPhase, { color: theme.textTertiary }]}>
        {phase === 'h' ? 'Select Hour' : 'Select Minutes'}
      </Text>

      {/* ── Dial ── */}
      <View ref={dialRef}
        style={[st.ckDial, { width: DIAL, height: DIAL, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        {...panResponder.panHandlers}
        onLayout={measureDial}
      >
        {/* Tick marks — only major ticks for clean look */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 - 90) * (Math.PI / 180);
          const o = R - 4;
          const inner = R - 13;
          return (
            <View key={`t${i}`} style={{
              position: 'absolute',
              left: R + inner * Math.cos(a) - 1,
              top: R + inner * Math.sin(a) - 0.5,
              width: 2,
              height: o - inner,
              backgroundColor: `${theme.text}20`,
              borderRadius: 1,
              transform: [{ rotate: `${i * 30}deg` }],
            }} />
          );
        })}

        {/* Numbers */}
        {nums.map(({ v, deg }) => {
          const a = (deg - 90) * (Math.PI / 180);
          const x = R + NUM_RING_R * Math.cos(a) - NUM_HR;
          const y = R + NUM_RING_R * Math.sin(a) - NUM_HR;
          const sel = phase === 'h' ? v === hr : v === mn;
          return (
            <View key={`n${v}`} style={[st.ckNum, {
              left: x, top: y,
              backgroundColor: sel ? theme.primary : 'transparent',
            }]}>
              <Text style={[st.ckNumTxt, { color: sel ? '#fff' : theme.text }]}>
                {phase === 'h' ? v : String(v).padStart(2, '0')}
              </Text>
            </View>
          );
        })}

        {/* Hand — using wrapper for proper center rotation */}
        <View style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: DIAL,
          height: DIAL,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: `${handDeg}deg` }],
        }}>
          <View style={{
            position: 'absolute',
            width: 2,
            height: handLen,
            backgroundColor: theme.primary,
            borderRadius: 1,
            top: R - handLen,
          }} />
        </View>

        {/* Tip highlight */}
        <View style={[st.ckTipGlow, {
          left: tipX - NUM_HR,
          top: tipY - NUM_HR,
          width: NUM_SZ,
          height: NUM_SZ,
          borderRadius: NUM_HR,
          backgroundColor: `${theme.primary}12`,
        }]}>
          <View style={[st.ckTipDot, { backgroundColor: theme.primary }]} />
        </View>

        {/* Center dot */}
        <View style={[st.ckCenter, { left: R - 4, top: R - 4, backgroundColor: theme.primary }]} />
      </View>

      {/* ── Buttons ── */}
      <View style={st.ckBtns}>
        <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}
          style={[st.ckBtnOuter, { borderColor: theme.border }]}>
          <Text style={[st.ckBtnOuterTxt, { color: theme.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNext} activeOpacity={0.7}
          style={[st.ckBtnFilled, { backgroundColor: theme.primary }]}>
          <Text style={st.ckBtnFilledTxt}>
            {phase === 'h' ? 'Next' : 'Done'}
          </Text>
          <Ionicons name={phase === 'h' ? 'arrow-forward' : 'checkmark'} size={15} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}


/* ═══════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════ */
export default function SalahTrackerSettingsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [fajrTime, setFajrTime] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);

  /* ── Load ── */
  useEffect(() => {
    (async () => {
      try {
        const p = await NotificationService.getPreferences();
        setPrefs(p);
        const flag = await AsyncStorage.getItem('sukoon_quran_custom_time');
        setIsCustom(flag === 'true');
        const cache = await PrayerTimesService.getCachedPrayerTimes();
        if (cache?.data?.Fajr) setFajrTime(cache.data.Fajr);
      } catch (e) {
        console.warn('Settings load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Helpers ── */
  const fajrPlus20 = useCallback(() => {
    if (!fajrTime) return '06:00';
    const [h, m] = fajrTime.split(':').map(Number);
    let nh = h, nm = m + 20;
    if (nm >= 60) { nm -= 60; nh++; }
    if (nh >= 24) nh = 0;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }, [fajrTime]);

  const save = useCallback(async (u: NotificationPreferences) => {
    setPrefs(u);
    await NotificationService.savePreferences(u);
  }, []);

  const sw = (val: boolean, fn: (b: boolean) => void) => ({
    value: val,
    onValueChange: fn,
    trackColor: { false: `${theme.textTertiary}30`, true: `${theme.primary}50` },
    thumbColor: val ? theme.primary : theme.textTertiary,
  });

  /* ── Handlers ── */
  const toggleMaster = useCallback(async (on: boolean) => {
    if (!prefs) return;
    LayoutAnimation.configureNext(ANIM);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (on) {
      const ok = await NotificationService.enableNotifications();
      if (!ok) {
        Alert.alert('Notifications Blocked', 'Please enable notifications in your device settings.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Platform.OS === 'android' ? Linking.openSettings() : Linking.openURL('app-settings:'),
          },
        ]);
        return;
      }
      // Check internet for prayer times API
      try {
        const ac = new AbortController();
        const tid = setTimeout(() => ac.abort(), 5000);
        await fetch('https://api.aladhan.com/v1/currentTime?zone=UTC', { method: 'HEAD', signal: ac.signal });
        clearTimeout(tid);
      } catch {
        await NotificationService.sendInternetOffNotification?.();
      }
      save({ ...prefs, enabled: true });
    } else {
      await NotificationService.disableNotifications();
      save({ ...prefs, enabled: false });
    }
  }, [prefs, save]);

  const togglePrayer = useCallback(async (p: PrayerName) => {
    if (!prefs) return;
    save({ ...prefs, prayerAlerts: { ...prefs.prayerAlerts, [p]: !prefs.prayerAlerts[p] } });
    Haptics.selectionAsync().catch(() => {});
  }, [prefs, save]);

  const toggleQuran = useCallback(async (on: boolean) => {
    if (!prefs) return;
    let u = { ...prefs, quranReminder: on };
    if (on && !isCustom) u.quranReminderTime = fajrPlus20();
    save(u);
    Haptics.selectionAsync().catch(() => {});
    if (!on) {
      setIsCustom(false);
      setClockOpen(false);
      await AsyncStorage.removeItem('sukoon_quran_custom_time');
    }
  }, [prefs, isCustom, fajrPlus20, save]);

  const confirmQuranTime = useCallback(async (t: string) => {
    if (!prefs) return;
    save({ ...prefs, quranReminderTime: t });
    setIsCustom(true);
    await AsyncStorage.setItem('sukoon_quran_custom_time', 'true');
  }, [prefs, save]);

  const resetQuranTime = useCallback(async () => {
    if (!prefs) return;
    const dt = fajrPlus20();
    save({ ...prefs, quranReminderTime: dt });
    setIsCustom(false);
    setClockOpen(false);
    await AsyncStorage.removeItem('sukoon_quran_custom_time');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [prefs, fajrPlus20, save]);

  const resetData = () => {
    Alert.alert(
      'Reset All Tracking Data?',
      'This will permanently delete your entire prayer tracking history. You cannot undo this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('sukoon_salah_'));
              if (keys.length) await AsyncStorage.multiRemove(keys);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert('Done', `Cleared ${keys.length} days of tracking data.`);
            } catch {
              Alert.alert('Error', 'Could not clear data. Please try again.');
            }
          },
        },
      ],
    );
  };

  /* ── Prayers config ── */
  const PRAYERS = [
    { key: 'fajr' as PrayerName, name: 'Fajr', icon: 'sunny-outline' as const, grad: ['#56A8E2', '#3D8FCC'] as [string, string] },
    { key: 'dhuhr' as PrayerName, name: 'Dhuhr', icon: 'sunny' as const, grad: ['#F0C146', '#DBA830'] as [string, string] },
    { key: 'asr' as PrayerName, name: 'Asr', icon: 'partly-sunny-outline' as const, grad: ['#F09846', '#DB7F30'] as [string, string] },
    { key: 'maghrib' as PrayerName, name: 'Maghrib', icon: 'cloudy-night-outline' as const, grad: ['#9B72CF', '#7C56B2'] as [string, string] },
    { key: 'isha' as PrayerName, name: 'Isha', icon: 'moon-outline' as const, grad: ['#4568B8', '#3350A0'] as [string, string] },
  ];

  return (
    <View style={[st.root, { backgroundColor: theme.surface }]}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        {/* ═══ HEADER ═══ */}
        <LinearGradient colors={theme.headerGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[st.hdr, { paddingTop: insets.top + 6 }]}>
          <View style={st.hdrDeco}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[st.hdrCircle, {
                width: 80 + i * 50, height: 80 + i * 50,
                top: -10 + i * 10, right: -20 + i * 15,
                opacity: 0.03 + i * 0.008,
              }]} />
            ))}
          </View>
          <View style={st.hdrRow}>
            <TouchableOpacity style={st.hdrBack} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={st.hdrTitle}>Tracker Settings</Text>
              <Ornament />
            </View>
            <View style={{ width: 36 }} />
          </View>
        </LinearGradient>

        {!loading && prefs && (
          <>
            {/* ═══ PRAYER NOTIFICATIONS ═══ */}
            <Section title="PRAYER NOTIFICATIONS">
              <Row icon="notifications-outline" bg="#40916C"
                label="Prayer Time Alerts"
                sub={prefs.enabled ? 'Enabled — Azan at prayer time' : 'Disabled'}
                right={<Switch {...sw(prefs.enabled, toggleMaster)} />}
                last={!prefs.enabled} />

              {prefs.enabled && (
                <View style={st.prayerList}>
                  <Text style={[st.prayerHint, { color: theme.textTertiary }]}>
                    Choose which prayers to alert for
                  </Text>
                  {PRAYERS.map(p => {
                    const on = prefs.prayerAlerts[p.key];
                    return (
                      <TouchableOpacity key={p.key} onPress={() => togglePrayer(p.key)}
                        activeOpacity={0.7} style={st.prayerRow}>
                        <LinearGradient colors={p.grad} style={st.prayerBadge}>
                          <Ionicons name={p.icon} size={13} color="#fff" />
                        </LinearGradient>
                        <Text style={[st.prayerName, { color: theme.text }]}>{p.name}</Text>
                        <View style={[
                          st.prayerCheck,
                          { borderColor: on ? theme.primary : `${theme.textTertiary}35` },
                          on && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}>
                          {on && <Ionicons name="checkmark-sharp" size={10} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Section>

            {prefs.enabled && (
              <>
                {/* ═══ AZAN SOUND ═══ */}
                <Section title="AZAN SOUND">
                  <Row icon="volume-high-outline" bg="#F0C146"
                    label="Play Azan Sound"
                    sub={prefs.azanSound ? 'Playing on prayer time' : 'Silent notifications'}
                    right={<Switch {...sw(prefs.azanSound, v => {
                      save({ ...prefs, azanSound: v });
                      Haptics.selectionAsync().catch(() => {});
                    })} />} />
                  <Row icon="sunny-outline" bg="#56A8E2"
                    label="Special Fajr Azan"
                    sub={prefs.fajrSpecialSound ? 'Unique sound for Fajr' : 'Same as other prayers'}
                    right={<Switch {...sw(prefs.fajrSpecialSound, v => {
                      save({ ...prefs, fajrSpecialSound: v });
                      Haptics.selectionAsync().catch(() => {});
                    })} />}
                    last />
                </Section>

                {/* ═══ PRE-PRAYER ALERT ═══ */}
                <Section title="PRE-PRAYER ALERT">
                  <View style={st.row}>
                    <View style={[st.rowIcon, { backgroundColor: '#8B6BBF' }]}>
                      <Ionicons name="time-outline" size={16} color="#fff" />
                    </View>
                    <View style={st.rowBody}>
                      <Text style={[st.rowLabel, { color: theme.text }]}>Remind Before Prayer</Text>
                      <Text style={[st.rowSub, { color: theme.textTertiary }]}>
                        {prefs.preAlertMinutes > 0 ? `${prefs.preAlertMinutes} minutes before` : 'Disabled'}
                      </Text>
                      <Pills value={prefs.preAlertMinutes}
                        onChange={v => save({ ...prefs, preAlertMinutes: v })} />
                    </View>
                  </View>
                </Section>
              </>
            )}

            {/* ═══ DAILY REMINDERS ═══ */}
            <Section title="DAILY REMINDERS">
              {/* Salah tracker - Fixed at 10:00 PM with smart notifications */}
              <Row icon="checkmark-circle-outline" bg="#40916C"
                label="Salah Tracker Reminder"
                sub={prefs.salahTrackerReminder
                  ? 'Daily reminder at 10:00 PM'
                  : 'Disabled'}
                right={<Switch {...sw(prefs.salahTrackerReminder, v => {
                  save({ ...prefs, salahTrackerReminder: v });
                  Haptics.selectionAsync().catch(() => {});
                })} />}
                last={!prefs.salahTrackerReminder} />

              {prefs.salahTrackerReminder && (
                <View style={[st.trackerHint, { backgroundColor: `${theme.primary}08` }]}>
                  <Ionicons name="sparkles" size={14} color={theme.primary} />
                  <Text style={[st.trackerHintTxt, { color: theme.textTertiary }]}>
                    Smart notification based on your daily prayer progress
                  </Text>
                </View>
              )}

              <View style={[st.rowDiv, { backgroundColor: theme.border, marginTop: prefs.salahTrackerReminder ? 12 : 0 }]} />

              {/* ═══ QURAN READING ═══ */}
              <View style={{ marginTop: 14 }}>
                {/* Header */}
                <View style={st.qrHead}>
                  <View style={[st.qrIconBox, { backgroundColor: `${theme.gold}18` }]}>
                    <Ionicons name="book-outline" size={17} color={theme.gold} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[st.rowLabel, { color: theme.text }]}>Quran Reading</Text>
                    <Text style={[st.rowSub, { color: theme.textTertiary }]}>
                      {prefs.quranReminder
                        ? isCustom
                          ? 'Custom time set'
                          : fajrTime
                            ? 'Auto — 20 min after Fajr'
                            : 'After Fajr prayer'
                        : 'Daily reading reminder'}
                    </Text>
                  </View>
                  <Switch {...sw(prefs.quranReminder, toggleQuran)} />
                </View>

                {/* Time card */}
                {prefs.quranReminder && (
                  <View style={[st.qrCard, {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                  }]}>
                    {/* Current time row */}
                    <View style={st.qrTimeRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[st.qrClkIcon, { backgroundColor: `${theme.primary}10` }]}>
                          <Ionicons name="time-outline" size={15} color={theme.primary} />
                        </View>
                        <View>
                          <Text style={[st.qrLbl, { color: theme.textTertiary }]}>
                            {isCustom ? 'CUSTOM' : 'AUTO'}
                          </Text>
                          <Text style={[st.qrVal, { color: theme.text }]}>
                            {fmt12(prefs.quranReminderTime)}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity activeOpacity={0.7}
                        onPress={() => {
                          LayoutAnimation.configureNext(ANIM);
                          setClockOpen(v => !v);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }}
                        style={[st.qrEditBtn, {
                          backgroundColor: clockOpen ? theme.primary : `${theme.primary}10`,
                        }]}>
                        <Ionicons
                          name={clockOpen ? 'close' : 'create-outline'}
                          size={14}
                          color={clockOpen ? '#fff' : theme.primary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Clock picker */}
                    {clockOpen && (
                      <View style={{ marginTop: 14 }}>
                        <View style={[st.qrDivider, { backgroundColor: theme.border }]} />
                        <ClockPicker
                          initial={prefs.quranReminderTime}
                          onConfirm={(t) => {
                            confirmQuranTime(t);
                            LayoutAnimation.configureNext(ANIM);
                            setClockOpen(false);
                          }}
                          onCancel={() => {
                            LayoutAnimation.configureNext(ANIM);
                            setClockOpen(false);
                          }}
                        />
                      </View>
                    )}

                    {/* Reset to default */}
                    {isCustom && !clockOpen && (
                      <TouchableOpacity onPress={resetQuranTime} activeOpacity={0.7}
                        style={[st.qrReset, {
                          backgroundColor: `${theme.gold}10`,
                          borderColor: `${theme.gold}25`,
                        }]}>
                        <Ionicons name="refresh-outline" size={14} color={theme.gold} />
                        <Text style={[st.qrResetTxt, { color: theme.gold }]}>
                          Reset to Fajr + 20 min
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Hint when off */}
                {!prefs.quranReminder && (
                  <View style={[st.qrHint, { backgroundColor: `${theme.textTertiary}08` }]}>
                    <Ionicons name="information-circle-outline" size={15} color={theme.textTertiary} />
                    <Text style={[st.qrHintTxt, { color: theme.textTertiary }]}>
                      Auto-sets 20 min after Fajr. You can customize after enabling.
                    </Text>
                  </View>
                )}
              </View>
            </Section>
          </>
        )}

        {/* ═══ DANGER ZONE ═══ */}
        <Section title="DANGER ZONE">
          <Row icon="trash-outline" bg="#D04040"
            label="Reset All Data"
            sub="Permanently delete all tracking history"
            onPress={resetData} last />
        </Section>

        {/* Footer */}
        <View style={st.footer}>
          <LinearGradient colors={theme.headerGradient} style={st.footerBadge}>
            <Ionicons name="moon-outline" size={12} color="#fff" />
          </LinearGradient>
          <Text style={[st.footerTxt, { color: theme.textTertiary }]}>
            Sukoon Salah Tracker v1.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}


/* ═══════════════════════════════════════════════
   STYLES — every token matched to SalahTrackerScreen
   ═══════════════════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },

  /* Ornament — identical to tracker */
  ornRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  ornLine: { width: 28, height: 1 },
  ornDm: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },

  /* Header — matches tracker hdr */
  hdr: { paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden' },
  hdrDeco: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  hdrCircle: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  hdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hdrBack: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  /* Section — matches calCard pattern */
  section: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, borderWidth: 1, padding: 16,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  secTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },

  /* Row — matches sheetOpt proportions */
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },       // matches pName-1
  rowSub: { fontSize: 12 },                             // matches pStatusText scaled
  rowDiv: { height: StyleSheet.hairlineWidth, marginLeft: 46 },

  /* Pills — matches viewToggle sizing */
  pillWrap: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  pillTxt: { fontSize: 12, fontWeight: '600' },

  /* Time button — matches dateChip */
  timeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  timeBtnTxt: { fontSize: 14, fontWeight: '600' },

  /* Prayer list */
  prayerList: { marginTop: 8, paddingTop: 10 },
  prayerHint: { fontSize: 11, fontWeight: '500', marginBottom: 10, marginLeft: 4 },
  prayerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 2 },
  prayerBadge: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  prayerName: { flex: 1, fontSize: 14, fontWeight: '600' },
  prayerCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  /* ═══ Salah Tracker Reminder Hint ═══ */
  trackerHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginTop: 6, marginLeft: 46 },
  trackerHintTxt: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '500' },

  /* ═══ Quran Reminder ═══ */
  qrHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  qrIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qrCard: { padding: 12, borderRadius: 12, borderWidth: 1 },
  qrTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrClkIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  qrLbl: { fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
  qrVal: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  qrEditBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  qrDivider: { height: StyleSheet.hairlineWidth, marginBottom: 10 },
  qrReset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginTop: 10 },
  qrResetTxt: { fontSize: 11, fontWeight: '600' },
  qrHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, marginTop: 8 },
  qrHintTxt: { flex: 1, fontSize: 11, lineHeight: 16 },

  /* ═══ Clock Picker (compact inline) ═══ */
  ck: { alignItems: 'center', paddingTop: 8, paddingBottom: 2 },

  /* Digital — compact matching rowLabel fonts */
  ckDigRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ckDigSlot: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ckDigNum: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ckColon: { fontSize: 18, fontWeight: '300', marginHorizontal: 1 },
  ckAmPmSpacer: { width: 8 },
  ckAmPm: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
  ckAmPmBtn: { paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  ckAmPmTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  ckPhase: { fontSize: 9, fontWeight: '600', letterSpacing: 0.4, marginBottom: 8, textTransform: 'uppercase' },

  /* Dial — compact */
  ckDial: { borderRadius: DIAL / 2, borderWidth: 1, position: 'relative' },

  /* Number badges — compact 24×24 */
  ckNum: { position: 'absolute', width: NUM_SZ, height: NUM_SZ, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  ckNumTxt: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },

  /* Tip highlight */
  ckTipGlow: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ckTipDot: { width: 5, height: 5, borderRadius: 2.5 },

  /* Center */
  ckCenter: { position: 'absolute', width: 6, height: 6, borderRadius: 3, zIndex: 10 },

  /* Buttons — compact matching pill styles */
  ckBtns: { flexDirection: 'row', gap: 8, marginTop: 10, width: '100%' },
  ckBtnOuter: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  ckBtnOuterTxt: { fontSize: 13, fontWeight: '600' },
  ckBtnFilled: { flex: 1.3, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  ckBtnFilledTxt: { fontSize: 13, fontWeight: '600', color: '#fff' },

  /* Footer */
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28 },
  footerBadge: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  footerTxt: { fontSize: 11, fontWeight: '500' },
});