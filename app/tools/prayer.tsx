/**
 * PrayerTimesScreen — deliberately simple.
 *
 *   header      back · title · settings
 *   location    where the times are for, plus today's date
 *   next card   what is next, its time and a live countdown
 *   list        the six times; a bell per prayer toggles its azan alert
 *
 * Nothing else — and no calculation settings: the method and Asr school are
 * worked out from the user's location (lib/prayerEngine), so the times shown are
 * simply the correct ones for where they are. The header button opens the azan &
 * reminder settings.
 *
 * Times are computed on the device, so the screen paints instantly, works
 * offline and is correct anywhere in the world. Pull down to refresh the
 * location. Data/logic: lib/usePrayerTimes + lib/notificationService.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, Alert, Linking, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeBack } from '@/lib/useSafeBack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { SHADOWS } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { usePrayerTimes } from '@/lib/usePrayerTimes';
import { formatCoords } from '@/lib/locationName';
import { PrayerKey } from '@/lib/prayerEngine';
import { prayerNameKey } from '@/lib/prayerFormat';
import { NotificationService, NotificationPreferences } from '@/lib/notificationService';
import { PrayerTimesService } from '@/lib/prayerTimes';
import NextPrayerCard from '@/components/prayer/NextPrayerCard';
import PrayerRow, { RowState } from '@/components/prayer/PrayerRow';
import ToolHero, { HeroIconButton } from '@/components/ToolHero';
import ToolStateCard from '@/components/ToolStateCard';

const ORDER: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

function openSystemSettings() {
  if (Platform.OS === 'android') Linking.openSettings().catch(() => {});
  else Linking.openURL('app-settings:').catch(() => {});
}

export default function PrayerTimesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/');
  const insets = useSafeAreaInsets();
  useLocale();

  const p = usePrayerTimes({ askPermission: 'ifNoLocation' });
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useFocusEffect(
    useCallback(() => {
      NotificationService.getPreferences().then(setPrefs).catch(() => {});
    }, []),
  );

  // ── Bell: toggles one prayer's azan, asking for permission the first time ──
  const toggleAlert = useCallback(async (key: PrayerKey) => {
    Haptics.selectionAsync().catch(() => {});
    const current = prefs ?? (await NotificationService.getPreferences());

    if (!current.enabled) {
      const ok = await NotificationService.enableNotifications();
      if (!ok) {
        Alert.alert(t('prayer.notifBlocked.title'), t('prayer.notifBlocked.body'), [
          { text: t('prayer.cancel'), style: 'cancel' },
          { text: t('prayer.openSettings'), onPress: openSystemSettings },
        ]);
        return;
      }
      const fresh = await NotificationService.getPreferences();
      const updated = { ...fresh, prayerAlerts: { ...fresh.prayerAlerts, [key]: true } };
      setPrefs(updated);
      await NotificationService.savePreferences(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }

    const updated = { ...current, prayerAlerts: { ...current.prayerAlerts, [key]: !current.prayerAlerts[key] } };
    setPrefs(updated); // optimistic
    await NotificationService.savePreferences(updated);
  }, [prefs]);

  const { times, next, status } = p;
  const nowMs = Date.now();

  const rowState = (key: PrayerKey): RowState => {
    if (!times) return 'upcoming';
    if (next && !next.isTomorrow && next.key === key) return 'next';
    return times.ts[key] <= nowMs ? 'past' : 'upcoming';
  };

  const locationText = p.locationName
    || (p.coords ? formatCoords(p.coords.lat, p.coords.lng) : t('prayer.locating'));

  return (
    <View style={[s.root, { backgroundColor: theme.surface }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={p.refreshing}
            onRefresh={p.refresh}
            tintColor="#FFFFFF"
            colors={[theme.primary]}
            progressBackgroundColor={theme.surfaceElevated}
          />
        }
      >
        {/* ═══ HEADER ═══ */}
        <ToolHero
          title={t('prayer.title')}
          onBack={goBack}
          right={
            <HeroIconButton
              icon="notifications-outline"
              label={t('prayer.notifSettings')}
              onPress={() => router.push('/tools/salah-settings')}
            />
          }
        >
          <View style={s.chip} accessible accessibilityLabel={locationText}>
            <Ionicons name="location" size={14} color="#F6E27A" />
            <Text style={s.chipText} numberOfLines={1}>{locationText}</Text>
          </View>

          {times && (
            <View style={s.dates}>
              <Text style={s.dateMain}>
                {times.hijriDate?.weekday ? `${times.hijriDate.weekday}, ` : ''}{times.date}
              </Text>
              {!!times.hijriDate?.fullDate && <Text style={s.dateHijri}>{times.hijriDate.fullDate}</Text>}
            </View>
          )}

          {status === 'loading' && <View style={s.skeletonCard} />}
          {status === 'ready' && next && <NextPrayerCard next={next} />}
        </ToolHero>

        {/* ═══ BODY ═══ */}
        <View style={s.body}>
          {status === 'loading' && (
            <View style={[s.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, padding: 16 }]}>
              {ORDER.map((k) => (
                <View key={k} style={[s.skeletonRow, { backgroundColor: theme.surfaceMuted }]} />
              ))}
            </View>
          )}

          {(status === 'denied' || status === 'unavailable') && (
            <ToolStateCard
              icon={status === 'denied' ? 'location-outline' : 'cloud-offline-outline'}
              title={t(status === 'denied' ? 'prayer.denied.title' : 'prayer.unavailable.title')}
              body={t(status === 'denied' ? 'prayer.denied.body' : 'prayer.unavailable.body')}
              primaryLabel={t(status === 'denied' ? 'prayer.denied.allow' : 'prayer.tryAgain')}
              onPrimary={() => { p.refresh(); }}
              secondaryLabel={status === 'denied' ? t('prayer.openSettings') : undefined}
              onSecondary={status === 'denied' ? openSystemSettings : undefined}
            />
          )}

          {status === 'ready' && times && (
            <View style={[s.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, SHADOWS.sm]}>
              {ORDER.map((key, i) => (
                <PrayerRow
                  key={key}
                  prayerKey={key}
                  label={t(prayerNameKey(key, new Date(times.ts[key])))}
                  time={PrayerTimesService.formatInstant(times.ts[key])}
                  state={rowState(key)}
                  alertOn={key === 'sunrise' ? null : !!(prefs?.enabled && prefs.prayerAlerts[key])}
                  onToggleAlert={() => toggleAlert(key)}
                  last={i === ORDER.length - 1}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  chip: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', marginTop: 14,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, maxWidth: '92%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipText: { marginStart: 6, fontSize: 14, fontWeight: '600', color: '#FFFFFF', flexShrink: 1 },
  dates: { alignItems: 'center', marginTop: 12 },
  dateMain: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.92)' },
  dateHijri: { fontSize: 13, marginTop: 2, color: 'rgba(255,255,255,0.72)' },
  skeletonCard: { height: 132, borderRadius: 22, marginTop: 20, backgroundColor: 'rgba(255,255,255,0.12)' },

  body: { paddingHorizontal: 16, paddingTop: 20 },
  group: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  skeletonRow: { height: 44, borderRadius: 12, marginBottom: 12 },
});
