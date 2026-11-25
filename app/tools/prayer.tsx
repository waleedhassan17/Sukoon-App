/**
 * PrayerTimesScreen — today's times, in the Salah Tracker's visual language.
 *
 *   header   back · title · azan settings, the gold ornament, where the times
 *            are for and today's Gregorian · Hijri date, and a stats-style
 *            panel: next prayer · begins · time left
 *   cards    the six times as Tracker-style cards; a bell per prayer toggles
 *            its azan alert
 *
 * Nothing else — and no calculation settings: the method and Asr school are
 * worked out from the user's location (lib/prayerEngine), so the times shown are
 * simply the correct ones for where they are.
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
import { t, useLocale } from '@/lib/i18n';
import { usePrayerTimes } from '@/lib/usePrayerTimes';
import { formatCoords } from '@/lib/locationName';
import { PrayerKey } from '@/lib/prayerEngine';
import { prayerNameKey } from '@/lib/prayerFormat';
import { NotificationService, NotificationPreferences } from '@/lib/notificationService';
import { PrayerTimesService } from '@/lib/prayerTimes';
import PrayerHeader from '@/components/prayer/PrayerHeader';
import NextPrayerPanel, { NextPrayerPanelSkeleton } from '@/components/prayer/NextPrayerPanel';
import PrayerRow, { RowState } from '@/components/prayer/PrayerRow';
import { prayerArabicName } from '@/components/prayer/prayerStyle';
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
  const dateLine = times
    ? [
        `${times.hijriDate?.weekday ? `${times.hijriDate.weekday}, ` : ''}${times.date}`,
        times.hijriDate?.fullDate,
      ].filter(Boolean).join('  ·  ')
    : '';

  return (
    <View style={[s.root, { backgroundColor: theme.surface }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        refreshControl={
          <RefreshControl
            refreshing={p.refreshing}
            onRefresh={p.refresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.surfaceElevated}
          />
        }
      >
        {/* ═══ HEADER ═══ */}
        <PrayerHeader
          title={t('prayer.title')}
          onBack={goBack}
          right={{
            icon: 'notifications-outline',
            label: t('prayer.notifSettings'),
            onPress: () => router.push('/tools/salah-settings'),
          }}
        >
          <View style={s.location} accessible accessibilityLabel={locationText}>
            <Ionicons name="location" size={13} color={theme.goldLight} />
            <Text style={s.locationText} numberOfLines={1}>{locationText}</Text>
          </View>
          {!!dateLine && (
            <Text style={s.dateLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {dateLine}
            </Text>
          )}

          {status === 'loading' && <NextPrayerPanelSkeleton />}
          {status === 'ready' && next && <NextPrayerPanel next={next} />}
        </PrayerHeader>

        {/* ═══ BODY ═══ */}
        <View style={s.list}>
          {status === 'loading' && ORDER.map((k) => (
            <View key={k} style={[s.skeletonCard, { backgroundColor: theme.surfaceMuted }]} />
          ))}

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

          {status === 'ready' && times && ORDER.map((key) => {
            const at = new Date(times.ts[key]);
            return (
              <PrayerRow
                key={key}
                prayerKey={key}
                label={t(prayerNameKey(key, at))}
                arabic={prayerArabicName(key, at)}
                time={PrayerTimesService.formatInstant(times.ts[key])}
                state={rowState(key)}
                alertOn={key === 'sunrise' ? null : !!(prefs?.enabled && prefs.prayerAlerts[key])}
                onToggleAlert={() => toggleAlert(key)}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  location: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    maxWidth: '92%', marginTop: 6,
  },
  locationText: { marginStart: 5, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', flexShrink: 1 },

  dateLine: { marginTop: 4, textAlign: 'center', fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.62)' },

  // Tracker's pList, with the gap the Tracker leaves below its header.
  list: { paddingHorizontal: 16, paddingTop: 18, gap: 8 },
  skeletonCard: { height: 68, borderRadius: 16 },
});
