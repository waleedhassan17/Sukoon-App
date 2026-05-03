/**
 * Friends tab — real-time list of the user's Salah Buddies.
 *
 * State machine (mutually exclusive):
 *   ▸ loading      → skeleton rows
 *   ▸ error        → tap-to-retry banner
 *   ▸ empty        → warm illustration + "Invite a friend"
 *   ▸ data         → list with pull-to-refresh
 *
 * Listener teardown: we hold the unsubscribe in a ref and call it from the cleanup,
 * so navigating away tears down the Firestore listener immediately (battery rule).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { t, useLocale } from '@/lib/i18n';
import { FriendsService, FriendListEntry } from '@/lib/friendsService';
import { PrayerTimesService } from '@/lib/prayerTimes';
import SalahTopTabs from '@/components/friends/SalahTopTabs';
import FriendListItem from '@/components/friends/FriendListItem';

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'data'; entries: FriendListEntry[] };

export default function SalahFriendsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocale();

  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [todaySelfCount, setTodaySelfCount] = useState(0);
  const [pastMaghribLocal, setPastMaghribLocal] = useState(false);
  const unsubRef = useRef<() => void>(() => {});

  const subscribe = useCallback(() => {
    unsubRef.current?.();
    setState({ kind: 'loading' });
    unsubRef.current = FriendsService.subscribeToFriends(
      entries => {
        setState({ kind: 'data', entries });
        // Header X/5 — derive from any entry (todayCountSelf is the same for all).
        setTodaySelfCount(entries.length > 0 ? entries[0].todayCountSelf : 0);
      },
      err => setState({ kind: 'error', message: err.message ?? t('common.error') }),
    );
  }, []);

  // Subscribe on mount, tear down on unmount.
  useEffect(() => {
    subscribe();
    return () => unsubRef.current?.();
  }, [subscribe]);

  // Compute pastMaghribLocal once + on every refocus.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await PrayerTimesService.getCachedPrayerTimes();
        if (!mounted || !cached?.data?.Maghrib) return;
        const [h, m] = cached.data.Maghrib.split(':').map(Number);
        const now = new Date();
        setPastMaghribLocal(now.getHours() * 60 + now.getMinutes() >= h * 60 + m);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    subscribe();
    // Visual refresh feel — listener will populate within ~200ms typically.
    setTimeout(() => setRefreshing(false), 600);
  }, [subscribe]);

  const goInvite = () => router.replace('/tools/salah-invites' as any);
  const goDetail = (uid: string) => router.push(`/friends/${uid}` as any);

  return (
    <View style={[st.root, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[st.header, { paddingTop: insets.top + 6 }]}
      >
        <View style={st.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={st.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>{t('friends.tab')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={st.headerStats}>
          <View style={st.headerRing}>
            <Text style={st.headerRingText}>{todaySelfCount}/5</Text>
          </View>
          <Text style={st.headerSub}>{t('friends.headerTodayProgress', { count: todaySelfCount })}</Text>
        </View>
      </LinearGradient>

      <SalahTopTabs />

      {/* CTA */}
      <TouchableOpacity
        onPress={goInvite}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={t('friends.inviteFriendCta')}
        style={[st.cta, { backgroundColor: theme.primary }]}
      >
        <Ionicons name="person-add" size={18} color="#fff" />
        <Text style={st.ctaText}>{t('friends.inviteFriendCta')}</Text>
      </TouchableOpacity>

      {state.kind === 'loading' && (
        <View style={st.center}><ActivityIndicator color={theme.primary} /></View>
      )}

      {state.kind === 'error' && (
        <TouchableOpacity onPress={subscribe} style={[st.errBox, { borderColor: theme.error }]}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.error} />
          <Text style={[st.errText, { color: theme.error }]}>{state.message}</Text>
          <Text style={[st.retry, { color: theme.primary }]}>{t('friends.errorRetry')}</Text>
        </TouchableOpacity>
      )}

      {state.kind === 'data' && state.entries.length === 0 && (
        <View style={st.empty}>
          <Ionicons name="people-circle-outline" size={64} color={theme.textTertiary} />
          <Text style={[st.emptyTitle, { color: theme.text }]}>{t('friends.empty.title')}</Text>
          <Text style={[st.emptyBody, { color: theme.textSecondary }]}>{t('friends.empty.body')}</Text>
        </View>
      )}

      {state.kind === 'data' && state.entries.length > 0 && (
        <FlatList
          data={state.entries}
          keyExtractor={e => e.pairId}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 4 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          renderItem={({ item }) => (
            <FriendListItem
              entry={item}
              pastMaghribLocal={pastMaghribLocal}
              onPress={() => goDetail(item.partnerUid)}
            />
          )}
          windowSize={10}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerStats: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerRing: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerRingText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginVertical: 12,
    paddingVertical: 14, borderRadius: 14, minHeight: 48,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, padding: 14, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errText: { flex: 1, fontSize: 13 },
  retry: { fontSize: 13, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
