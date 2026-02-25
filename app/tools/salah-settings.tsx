/**
 * SalahTrackerSettingsScreen v2 - Prayer Tracker Settings
 *
 * DESIGN:
 *  - Gradient header matching main tracker
 *  - Grouped settings in elevated cards with section titles
 *  - Per-prayer notification toggles with gradient badges
 *  - Data: export CSV, reset history with confirmation
 *  - About: interactive tips with tinted icons
 *  - Sukoon green/gold palette
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet,
  Platform, Alert, Share, LayoutAnimation, UIManager, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationService, NotificationPreferences, PrayerName } from '@/lib/notificationService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAYOUT_ANIM = {
  duration: 280,
  update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleY },
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

const PRAYER_LIST = [
  { key: 'fajr', name: 'Fajr', icon: 'sunny-outline', gradient: ['#56A8E2', '#3D8FCC'] as [string, string] },
  { key: 'zuhr', name: 'Zuhr', icon: 'sunny', gradient: ['#F0C146', '#DBA830'] as [string, string] },
  { key: 'asr', name: 'Asr', icon: 'partly-sunny-outline', gradient: ['#F09846', '#DB7F30'] as [string, string] },
  { key: 'maghrib', name: 'Maghrib', icon: 'cloudy-night-outline', gradient: ['#9B72CF', '#7C56B2'] as [string, string] },
  { key: 'isha', name: 'Isha', icon: 'moon-outline', gradient: ['#4568B8', '#3350A0'] as [string, string] },
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

/* ─── Section ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[st.section, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor }]}>
      <Text style={[st.sectionTitle, { color: theme.textTertiary }]}>{title}</Text>
      {children}
    </View>
  );
}

/* ─── Pre-Alert Selector ─── */
function PreAlertSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { theme } = useTheme();
  const options = [
    { label: 'Off', value: 0 },
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => {
            onChange(opt.value);
            Haptics.selectionAsync().catch(() => {});
          }}
          style={{
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
            backgroundColor: value === opt.value ? theme.primary : theme.surfaceMuted,
          }}
        >
          <Text style={{
            fontSize: 12, fontWeight: '600',
            color: value === opt.value ? '#fff' : theme.textSecondary,
          }}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─── Time Picker Placeholder ─── */
function TimePickerButton({ time, onChange }: { time: string; onChange: (t: string) => void }) {
  const { theme } = useTheme();
  const handlePress = () => {
    // Simple time picker: show alert with options
    const [h, m] = time.split(':').map(Number);
    Alert.prompt(
      'Set Time',
      'Enter time in HH:MM format (24-hour)',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'OK',
          onPress: (input: string | undefined) => {
            if (input && /^\d{2}:\d{2}$/.test(input)) {
              onChange(input);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } else {
              Alert.alert('Invalid Format', 'Please use HH:MM format');
            }
          },
        },
      ],
      'plain-text',
      time,
    );
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
        backgroundColor: theme.surfaceMuted,
        borderColor: theme.borderLight,
        borderWidth: 1,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>{time}</Text>
    </TouchableOpacity>
  );
}

/* ─── Row ─── */
function SettingRow({
  icon, iconBg, label, subtitle, right, onPress, last,
}: {
  icon: string; iconBg: string; label: string; subtitle?: string;
  right?: React.ReactNode; onPress?: () => void; last?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <>
      <TouchableOpacity
        onPress={onPress} disabled={!onPress && !right} activeOpacity={onPress ? 0.7 : 1}
        style={st.row}
      >
        <View style={[st.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={16} color="#fff" />
        </View>
        <View style={st.rowInfo}>
          <Text style={[st.rowLabel, { color: theme.text }]}>{label}</Text>
          {subtitle && <Text style={[st.rowSub, { color: theme.textTertiary }]}>{subtitle}</Text>}
        </View>
        {right || (onPress && <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />)}
      </TouchableOpacity>
      {!last && <View style={[st.rowDiv, { backgroundColor: theme.border }]} />}
    </>
  );
}

/* ═══════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════ */
export default function SalahTrackerSettingsScreen() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Other settings
  const [jamaahDefault, setJamaahDefault] = useState(false);
  const [weekStart, setWeekStart] = useState<'sun' | 'mon'>('sun');

  // Load notification preferences on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const prefs = await NotificationService.getPreferences();
        setNotifPrefs(prefs);
      } catch (e) {
        console.warn('Failed to load notification preferences:', e);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, []);

  // Master notification toggle
  const toggleMasterNotif = useCallback(async (val: boolean) => {
    if (!notifPrefs) return;
    
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (val) {
      // Enable notifications
      const granted = await NotificationService.enableNotifications();
      if (!granted) {
        Alert.alert(
          'Notifications Blocked',
          'Please enable notifications in your device settings to receive prayer reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'android') {
                  Linking.openSettings();
                } else {
                  Linking.openURL('app-settings:');
                }
              },
            },
          ],
        );
        return;
      }
      const updated = { ...notifPrefs, enabled: true };
      setNotifPrefs(updated);
    } else {
      // Disable notifications
      await NotificationService.disableNotifications();
      const updated = { ...notifPrefs, enabled: false };
      setNotifPrefs(updated);
    }
  }, [notifPrefs]);

  // Toggle individual prayer alert
  const togglePrayerAlert = useCallback(async (prayer: PrayerName) => {
    if (!notifPrefs) return;
    const updated = {
      ...notifPrefs,
      prayerAlerts: {
        ...notifPrefs.prayerAlerts,
        [prayer]: !notifPrefs.prayerAlerts[prayer],
      },
    };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
    Haptics.selectionAsync().catch(() => {});
  }, [notifPrefs]);

  // Set pre-alert minutes
  const setPreAlertMinutes = useCallback(async (minutes: number) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, preAlertMinutes: minutes };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
  }, [notifPrefs]);

  // Toggle azan sound
  const toggleAzanSound = useCallback(async (enabled: boolean) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, azanSound: enabled };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
    Haptics.selectionAsync().catch(() => {});
  }, [notifPrefs]);

  // Toggle Fajr special sound
  const toggleFajrSound = useCallback(async (enabled: boolean) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, fajrSpecialSound: enabled };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
    Haptics.selectionAsync().catch(() => {});
  }, [notifPrefs]);

  // Toggle salah tracker reminder
  const toggleTrackerReminder = useCallback(async (enabled: boolean) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, salahTrackerReminder: enabled };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
    Haptics.selectionAsync().catch(() => {});
  }, [notifPrefs]);

  // Set tracker reminder time
  const setTrackerTime = useCallback(async (time: string) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, salahTrackerTime: time };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
  }, [notifPrefs]);

  // Toggle Quran reminder
  const toggleQuranReminder = useCallback(async (enabled: boolean) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, quranReminder: enabled };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
    Haptics.selectionAsync().catch(() => {});
  }, [notifPrefs]);

  // Set Quran reminder time
  const setQuranTime = useCallback(async (time: string) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, quranReminderTime: time };
    setNotifPrefs(updated);
    await NotificationService.savePreferences(updated);
  }, [notifPrefs]);



  const handleReset = () => {
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
              const all = await AsyncStorage.getAllKeys();
              const salah = all.filter((k) => k.startsWith('sukoon_salah_'));
              if (salah.length > 0) await AsyncStorage.multiRemove(salah);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert('Done', `Cleared ${salah.length} days of tracking data.`);
            } catch { Alert.alert('Error', 'Could not clear data. Please try again.'); }
          },
        },
      ],
    );
  };

  const handleExport = async () => {
    try {
      const all = await AsyncStorage.getAllKeys();
      const salah = all.filter((k) => k.startsWith('sukoon_salah_')).sort();
      if (salah.length === 0) { Alert.alert('No Data', 'Start tracking your prayers first!'); return; }
      const pairs = await AsyncStorage.multiGet(salah);

      let csv = 'Date,Fajr,Zuhr,Asr,Maghrib,Isha,Total Prayed\n';
      pairs.forEach(([k, v]) => {
        if (v) {
          const date = k.replace('sukoon_salah_', '');
          let d: any;
          try { d = JSON.parse(v); } catch { return; } // skip corrupt entries
          if (!d || typeof d !== 'object') return;
          const prayed = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'].filter(
            (p) => d[p] === 'prayed' || d[p] === 'jamaah' || d[p] === 'qasr',
          ).length;
          csv += `${date},${d.fajr},${d.zuhr},${d.asr},${d.maghrib},${d.isha},${prayed}/5\n`;
        }
      });

      await Share.share({ message: csv, title: 'Sukoon - Salah Tracker Export' });
    } catch {}
  };

  return (
    <View style={[st.root, { backgroundColor: theme.surface }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* ═══ HEADER ═══ */}
        <LinearGradient
          colors={theme.headerGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[st.hdr, { paddingTop: insets.top + 6 }]}
        >
          <View style={st.hdrPat}>
            {[...Array(4)].map((_, i) => (
              <View key={i} style={[st.hdrCircle, {
                width: 80 + i * 50, height: 80 + i * 50,
                top: -10 + i * 10, right: -20 + i * 15, opacity: 0.03 + i * 0.008,
              }]} />
            ))}
          </View>
          <View style={st.hdrRow}>
            <TouchableOpacity style={st.hdrBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={st.hdrCenter}>
              <Text style={st.hdrTitle}>Tracker Settings</Text>
              <Ornament />
            </View>
            <View style={{ width: 36 }} />
          </View>
        </LinearGradient>

        {/* ═══ NOTIFICATIONS ═══ */}
        {!loading && notifPrefs && (
          <>
            <Section title="PRAYER NOTIFICATIONS">
              <SettingRow
                icon="notifications-outline"
                iconBg="#40916C"
                label="Prayer Time Alerts"
                subtitle={notifPrefs.enabled ? 'Enabled - Get azan at prayer time' : 'Disabled'}
                right={
                  <Switch
                    value={notifPrefs.enabled}
                    onValueChange={toggleMasterNotif}
                    trackColor={{ false: `${theme.textTertiary}30`, true: `${theme.primary}50` }}
                    thumbColor={notifPrefs.enabled ? theme.primary : theme.textTertiary}
                  />
                }
                last={!notifPrefs.enabled}
              />

              {notifPrefs.enabled && (
                <View style={st.reminderList}>
                  <Text style={[st.reminderHint, { color: theme.textTertiary }]}>Choose which prayers to alert for</Text>
                  {[
                    { key: 'fajr', name: 'Fajr', icon: 'sunny-outline', gradient: ['#56A8E2', '#3D8FCC'] as [string, string] },
                    { key: 'dhuhr', name: 'Dhuhr', icon: 'sunny', gradient: ['#F0C146', '#DBA830'] as [string, string] },
                    { key: 'asr', name: 'Asr', icon: 'partly-sunny-outline', gradient: ['#F09846', '#DB7F30'] as [string, string] },
                    { key: 'maghrib', name: 'Maghrib', icon: 'cloudy-night-outline', gradient: ['#9B72CF', '#7C56B2'] as [string, string] },
                    { key: 'isha', name: 'Isha', icon: 'moon-outline', gradient: ['#4568B8', '#3350A0'] as [string, string] },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => togglePrayerAlert(p.key as PrayerName)}
                      activeOpacity={0.7}
                      style={st.reminderRow}
                    >
                      <LinearGradient colors={p.gradient} style={st.reminderBadge}>
                        <Ionicons name={p.icon as any} size={13} color="#fff" />
                      </LinearGradient>
                      <Text style={[st.reminderName, { color: theme.text }]}>{p.name}</Text>
                      <View style={[
                        st.reminderCheck,
                        { borderColor: notifPrefs.prayerAlerts[p.key as PrayerName] ? theme.primary : `${theme.textTertiary}35` },
                        notifPrefs.prayerAlerts[p.key as PrayerName] && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}>
                        {notifPrefs.prayerAlerts[p.key as PrayerName] && <Ionicons name="checkmark-sharp" size={10} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Section>

            {notifPrefs.enabled && (
              <>
                <Section title="AZAN SOUND">
                  <SettingRow
                    icon="volume-high-outline"
                    iconBg="#F0C146"
                    label="Play Azan Sound"
                    subtitle={notifPrefs.azanSound ? 'Playing on prayer time' : 'Silent notifications'}
                    right={
                      <Switch
                        value={notifPrefs.azanSound}
                        onValueChange={toggleAzanSound}
                        trackColor={{ false: `${theme.textTertiary}30`, true: `${theme.primary}50` }}
                        thumbColor={notifPrefs.azanSound ? theme.primary : theme.textTertiary}
                      />
                    }
                  />
                  <SettingRow
                    icon="sunny-outline"
                    iconBg="#56A8E2"
                    label="Special Fajr Azan"
                    subtitle={notifPrefs.fajrSpecialSound ? 'Unique sound for Fajr' : 'Same as other prayers'}
                    right={
                      <Switch
                        value={notifPrefs.fajrSpecialSound}
                        onValueChange={toggleFajrSound}
                        trackColor={{ false: `${theme.textTertiary}30`, true: `${theme.primary}50` }}
                        thumbColor={notifPrefs.fajrSpecialSound ? theme.primary : theme.textTertiary}
                      />
                    }
                    last
                  />
                </Section>

                <Section title="PRE-PRAYER ALERT">
                  <View style={st.row}>
                    <View style={[st.rowIcon, { backgroundColor: '#8B6BBF' }]}>
                      <Ionicons name="time-outline" size={16} color="#fff" />
                    </View>
                    <View style={st.rowInfo}>
                      <Text style={[st.rowLabel, { color: theme.text }]}>Remind Before Prayer</Text>
                      <Text style={[st.rowSub, { color: theme.textTertiary }]}>
                        {notifPrefs.preAlertMinutes > 0 ? `${notifPrefs.preAlertMinutes} minutes before` : 'Disabled'}
                      </Text>
                      <PreAlertSelector value={notifPrefs.preAlertMinutes} onChange={setPreAlertMinutes} />
                    </View>
                  </View>
                </Section>
              </>
            )}

            <Section title="DAILY REMINDERS">
              <SettingRow
                icon="checkmark-circle-outline"
                iconBg="#40916C"
                label="Salah Tracker Reminder"
                subtitle={notifPrefs.salahTrackerReminder ? `Daily at ${notifPrefs.salahTrackerTime}` : 'Disabled'}
                right={
                  <Switch
                    value={notifPrefs.salahTrackerReminder}
                    onValueChange={toggleTrackerReminder}
                    trackColor={{ false: `${theme.textTertiary}30`, true: `${theme.primary}50` }}
                    thumbColor={notifPrefs.salahTrackerReminder ? theme.primary : theme.textTertiary}
                  />
                }
              />
              {notifPrefs.salahTrackerReminder && (
                <View style={[st.row, { paddingBottom: 0 }]}>
                  <View style={[st.rowIcon, { backgroundColor: '#56A8E2', opacity: 0 }]}>
                    <Ionicons name="time" size={16} color="#fff" />
                  </View>
                  <View style={[st.rowInfo, { paddingLeft: 0 }]}>
                    <Text style={[st.rowLabel, { color: theme.text, marginBottom: 8 }]}>Time</Text>
                    <TimePickerButton time={notifPrefs.salahTrackerTime} onChange={setTrackerTime} />
                  </View>
                </View>
              )}
              <View style={[st.rowDiv, { backgroundColor: theme.border }]} />

              <SettingRow
                icon="book-outline"
                iconBg="#F09846"
                label="Quran Reading Reminder"
                subtitle={notifPrefs.quranReminder ? `Daily at ${notifPrefs.quranReminderTime}` : 'Disabled'}
                right={
                  <Switch
                    value={notifPrefs.quranReminder}
                    onValueChange={toggleQuranReminder}
                    trackColor={{ false: `${theme.textTertiary}30`, true: `${theme.primary}50` }}
                    thumbColor={notifPrefs.quranReminder ? theme.primary : theme.textTertiary}
                  />
                }
              />
              {notifPrefs.quranReminder && (
                <View style={[st.row, { paddingBottom: 0 }]}>
                  <View style={[st.rowIcon, { backgroundColor: '#56A8E2', opacity: 0 }]}>
                    <Ionicons name="time" size={16} color="#fff" />
                  </View>
                  <View style={[st.rowInfo, { paddingLeft: 0 }]}>
                    <Text style={[st.rowLabel, { color: theme.text, marginBottom: 8 }]}>Time</Text>
                    <TimePickerButton time={notifPrefs.quranReminderTime} onChange={setQuranTime} />
                  </View>
                </View>
              )}
            </Section>

          </>
        )}

        {/* ═══ PREFERENCES ═══ */}
        <Section title="PREFERENCES">
          <SettingRow
            icon="people-outline"
            iconBg="#8B6BBF"
            label="Default to Jamaah"
            subtitle="First tap marks as congregation prayer"
            right={
              <Switch
                value={jamaahDefault}
                onValueChange={(v) => { setJamaahDefault(v); Haptics.selectionAsync().catch(() => {}); }}
                trackColor={{ false: `${theme.textTertiary}30`, true: `${theme.primary}50` }}
                thumbColor={jamaahDefault ? theme.primary : theme.textTertiary}
              />
            }
          />
          <SettingRow
            icon="calendar-outline"
            iconBg="#F0C146"
            label="Week Starts On"
            subtitle={weekStart === 'sun' ? 'Sunday' : 'Monday'}
            onPress={() => {
              setWeekStart((p) => p === 'sun' ? 'mon' : 'sun');
              Haptics.selectionAsync().catch(() => {});
            }}
            last
          />
        </Section>

        {/* ═══ DATA ═══ */}
        <Section title="DATA MANAGEMENT">
          <SettingRow
            icon="share-outline"
            iconBg="#56A8E2"
            label="Export Tracking Data"
            subtitle="Share your history as a CSV file"
            onPress={handleExport}
          />
          <SettingRow
            icon="trash-outline"
            iconBg="#D04040"
            label="Reset All Data"
            subtitle="Permanently delete all tracking history"
            onPress={handleReset}
            last
          />
        </Section>

        {/* ═══ HOW TO USE ═══ */}
        <Section title="HOW TO USE">
          {[
            { icon: 'hand-left-outline', color: '#40916C', text: 'Tap any prayer card to cycle through tracking states' },
            { icon: 'finger-print-outline', color: '#8B6BBF', text: 'Long press a prayer for a detailed status picker' },
            { icon: 'ellipse', color: '#F0C146', text: 'Calendar dots show how many prayers you completed each day' },
            { icon: 'flame-outline', color: '#F09846', text: 'Maintain your daily streak by logging all 5 prayers' },
            { icon: 'checkmark-done-circle-outline', color: '#1B6B3C', text: 'A filled dot means all 5 prayers are logged for that day' },
          ].map((tip, i) => (
            <View key={i} style={[st.tipRow, i < 4 && { marginBottom: 14 }]}>
              <View style={[st.tipIcon, { backgroundColor: `${tip.color}14` }]}>
                <Ionicons name={tip.icon as any} size={15} color={tip.color} />
              </View>
              <Text style={[st.tipText, { color: theme.textSecondary }]}>{tip.text}</Text>
            </View>
          ))}
        </Section>

        {/* Version */}
        <View style={st.footer}>
          <LinearGradient colors={theme.headerGradient} style={st.footerBadge}>
            <Ionicons name="moon-outline" size={12} color="#fff" />
          </LinearGradient>
          <Text style={[st.footerText, { color: theme.textTertiary }]}>Sukoon Salah Tracker v1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },

  ornRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  ornLine: { width: 28, height: 1 },
  ornDm: { width: 7, height: 7, borderRadius: 1, transform: [{ rotate: '45deg' }] },

  /* Header */
  hdr: { paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden' },
  hdrPat: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  hdrCircle: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  hdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hdrBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  hdrCenter: { alignItems: 'center' },
  hdrTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  /* Section */
  section: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, borderWidth: 1, padding: 16,
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 }, android: { elevation: 2 } }),
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },

  /* Setting row */
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  rowDiv: { height: StyleSheet.hairlineWidth, marginLeft: 46 },

  /* Reminders */
  reminderList: { marginTop: 8, paddingTop: 10 },
  reminderHint: { fontSize: 11, fontWeight: '500', marginBottom: 10, marginLeft: 4 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 2 },
  reminderBadge: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  reminderName: { flex: 1, fontSize: 14, fontWeight: '600' },
  reminderCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  /* Tips */
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },

  /* Footer */
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28 },
  footerBadge: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  footerText: { fontSize: 11, fontWeight: '500' },
});
