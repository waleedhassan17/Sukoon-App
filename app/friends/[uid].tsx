/**
 * Friend Detail screen — accessed by tapping a row in the Friends list.
 *
 * Renders:
 *   - Big streak counter, longest streak, joined date.
 *   - Milestones row (small chips for each unlocked milestone).
 *   - Last 14 days mini calendar showing both users' SDC dots.
 *   - Remove + Block (each behind a confirmation Alert).
 *
 * Data: one-shot read of friendship + 14 days of prayer docs for both users
 * (lightweight; ≤ 28 doc reads). No real-time listener — this screen is read-mostly.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import { t, useLocale } from '@/lib/i18n';
import { getFirestore, getAuth } from '@/lib/firebaseConfig';
import { UserProfileService, PublicUserProfile } from '@/lib/userProfileService';
import { FirebaseFunctions } from '@/lib/firebaseFunctions';

interface Detail {
  partner: PublicUserProfile;
  currentStreak: number;
  longestStreak: number;
  acceptedAt: number | null;
  milestones: number[];
  selfDays: Record<string, number>;
  partnerDays: Record<string, number>;
  todayKeys: string[]; // last 14 date keys (oldest → newest)
}

function pairIdOf(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push([
      x.getFullYear(),
      String(x.getMonth() + 1).padStart(2, '0'),
      String(x.getDate()).padStart(2, '0'),
    ].join('-'));
  }
  return out;
}

export default function FriendDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocale();
  const params = useLocalSearchParams<{ uid: string }>();
  const partnerUid = Array.isArray(params.uid) ? params.uid[0] : params.uid ?? '';

  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<'load' | 'remove' | 'block' | null>('load');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    setError(null);
    try {
      const auth = await getAuth();
      const db = await getFirestore();
      const selfUid = auth?.currentUser?.uid;
      if (!selfUid || !db) throw new Error(t('common.signedOut'));

      const pid = pairIdOf(selfUid, partnerUid);
      const todayKeys = lastNDays(14);

      const [partner, friendshipSnap, selfDocs, partnerDocs] = await Promise.all([
        UserProfileService.readPublicProfile(partnerUid),
        db.collection('friendships').doc(pid).get(),
        Promise.all(todayKeys.map(k =>
          db.collection('prayers').doc(selfUid).collection('days').doc(k).get())),
        Promise.all(todayKeys.map(k =>
          db.collection('prayers').doc(partnerUid).collection('days').doc(k).get())),
      ]);

      if (!partner) throw new Error(t('common.error'));

      const friendship = friendshipSnap.exists ? friendshipSnap.data() ?? {} : {};
      const selfDays: Record<string, number> = {};
      const partnerDays: Record<string, number> = {};
      todayKeys.forEach((k, i) => {
        selfDays[k] = Number(selfDocs[i].get('prayerCount') ?? 0);
        partnerDays[k] = Number(partnerDocs[i].get('prayerCount') ?? 0);
      });

      setDetail({
        partner,
        currentStreak: Number(friendship.currentStreak ?? 0),
        longestStreak: Number(friendship.longestStreak ?? 0),
        acceptedAt: friendship.acceptedAt?.toMillis ? friendship.acceptedAt.toMillis() : null,
        milestones: Array.isArray(friendship.milestonesAchieved) ? friendship.milestonesAchieved : [],
        selfDays,
        partnerDays,
        todayKeys,
      });
    } catch (e) {
      setError((e as Error).message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  }, [partnerUid]);

  useEffect(() => { load(); }, [load]);

  const confirmRemove = () => {
    Alert.alert(
      t('friends.detail.removeConfirm.title'),
      t('friends.detail.removeConfirm.body'),
      [
        { text: t('friends.detail.removeConfirm.cancel'), style: 'cancel' },
        {
          text: t('friends.detail.removeConfirm.confirm'),
          style: 'destructive',
          onPress: async () => {
            setBusy('remove');
            try {
              await FirebaseFunctions.removeFriend(partnerUid);
              router.back();
            } catch (e) {
              setBusy(null);
              Alert.alert(t('common.error'), (e as Error).message);
            }
          },
        },
      ],
    );
  };

  const confirmBlock = () => {
    Alert.alert(
      t('friends.detail.blockConfirm.title'),
      t('friends.detail.blockConfirm.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.detail.blockConfirm.confirm'),
          style: 'destructive',
          onPress: async () => {
            setBusy('block');
            try {
              await FirebaseFunctions.blockFriend(partnerUid);
              router.back();
            } catch (e) {
              setBusy(null);
              Alert.alert(t('common.error'), (e as Error).message);
            }
          },
        },
      ],
    );
  };

  if (busy === 'load') {
    return (
      <View style={[st.root, { backgroundColor: theme.surface }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[st.root, { backgroundColor: theme.surface, padding: 24, justifyContent: 'center' }]}>
        <Text style={[st.errTxt, { color: theme.text }]}>{error ?? t('common.error')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[st.primaryBtn, { backgroundColor: theme.primary }]}>
          <Text style={st.primaryBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const joinedLabel = detail.acceptedAt
    ? new Date(detail.acceptedAt).toLocaleDateString()
    : '—';

  return (
    <ScrollView
      style={[st.root, { backgroundColor: theme.surface }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[st.header, { paddingTop: insets.top + 6 }]}
      >
        <View style={st.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={st.headerBtn} accessibilityLabel={t('common.cancel')}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle} numberOfLines={1}>{detail.partner.displayName}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={st.heroRow}>
          {detail.partner.photoURL ? (
            <Image source={{ uri: detail.partner.photoURL }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 28 }}>
                {(detail.partner.displayName[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={st.streakBig}>{detail.currentStreak}</Text>
          <Text style={st.streakBigLabel}>🔥 {t('friends.streakDays', { count: detail.currentStreak })}</Text>
        </View>
      </LinearGradient>

      <View style={[st.statsRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={st.stat}>
          <Text style={[st.statLabel, { color: theme.textTertiary }]}>{t('friends.detail.longestStreak')}</Text>
          <Text style={[st.statValue, { color: theme.text }]}>{detail.longestStreak}</Text>
        </View>
        <View style={[st.statDivider, { backgroundColor: theme.border }]} />
        <View style={st.stat}>
          <Text style={[st.statLabel, { color: theme.textTertiary }]}>{t('friends.detail.joinedOn')}</Text>
          <Text style={[st.statValue, { color: theme.text, fontSize: 14 }]} numberOfLines={1}>{joinedLabel}</Text>
        </View>
      </View>

      {detail.milestones.length > 0 && (
        <View style={st.milestonesWrap}>
          <Text style={[st.sectionTitle, { color: theme.textSecondary }]}>{t('friends.detail.milestones')}</Text>
          <View style={st.milestonesRow}>
            {detail.milestones.map(m => (
              <View key={m} style={[st.milestoneChip, { backgroundColor: `${theme.gold}25`, borderColor: `${theme.gold}40` }]}>
                <Text style={[st.milestoneTxt, { color: theme.text }]}>✨ {m}d</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[st.calendar, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Text style={[st.sectionTitle, { color: theme.textSecondary }]}>{t('friends.detail.last14')}</Text>
        <View style={st.calRow}>
          {detail.todayKeys.map(k => {
            const day = Number(k.split('-')[2]);
            const selfDone = detail.selfDays[k] === 5;
            const partnerDone = detail.partnerDays[k] === 5;
            return (
              <View key={k} style={st.calCell}>
                <Text style={[st.calDay, { color: theme.textTertiary }]}>{day}</Text>
                <View style={[st.calDot, { backgroundColor: selfDone ? theme.primary : `${theme.textTertiary}30` }]} />
                <View style={[st.calDot, { backgroundColor: partnerDone ? theme.gold : `${theme.textTertiary}30` }]} />
              </View>
            );
          })}
        </View>
        <View style={st.calLegend}>
          <View style={[st.calDot, { backgroundColor: theme.primary }]} />
          <Text style={[st.calLegendTxt, { color: theme.textSecondary }]}>You</Text>
          <View style={[st.calDot, { backgroundColor: theme.gold, marginLeft: 14 }]} />
          <Text style={[st.calLegendTxt, { color: theme.textSecondary }]}>{detail.partner.displayName}</Text>
        </View>
      </View>

      <View style={st.actions}>
        <TouchableOpacity
          onPress={confirmRemove}
          disabled={busy === 'remove' || busy === 'block'}
          style={[st.actionBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('friends.detail.removeFriend')}
        >
          <Ionicons name="person-remove-outline" size={18} color={theme.textSecondary} />
          <Text style={[st.actionBtnText, { color: theme.textSecondary }]}>{t('friends.detail.removeFriend')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmBlock}
          disabled={busy === 'remove' || busy === 'block'}
          style={[st.actionBtn, { backgroundColor: `${theme.error}10`, borderColor: `${theme.error}40` }]}
          accessibilityRole="button"
          accessibilityLabel={t('friends.detail.blockFriend')}
        >
          <Ionicons name="ban-outline" size={18} color={theme.error} />
          <Text style={[st.actionBtnText, { color: theme.error }]}>{t('friends.detail.blockFriend')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  errTxt: { fontSize: 16, textAlign: 'center', marginBottom: 16 },

  header: { paddingHorizontal: 20, paddingBottom: 22 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  heroRow: { alignItems: 'center', marginTop: 16, gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  streakBig: { color: '#fff', fontSize: 64, fontWeight: '900', marginTop: 4 },
  streakBigLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: -12, padding: 16, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 22, fontWeight: '800' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 8,
  },
  milestonesWrap: { paddingHorizontal: 16, marginTop: 18 },
  milestonesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  milestoneChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  milestoneTxt: { fontSize: 13, fontWeight: '700' },

  calendar: {
    marginHorizontal: 16, marginTop: 18, padding: 14, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calRow: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  calCell: { alignItems: 'center', gap: 4, flex: 1 },
  calDay: { fontSize: 11, fontWeight: '600' },
  calDot: { width: 8, height: 8, borderRadius: 4 },
  calLegend: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  calLegendTxt: { fontSize: 12, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 24 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, minHeight: 48,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  primaryBtn: {
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12,
    alignItems: 'center', minHeight: 48,
    ...Platform.select({ ios: {}, android: { elevation: 2 } }),
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
