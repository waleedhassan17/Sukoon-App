/**
 * FriendListItem — one row in the Friends tab. Pure presentational.
 *
 * Status icon precedence (most recent / important wins):
 *   ✨ milestone (within last 24h of unlock — milestoneJustHit prop)
 *   💔 broken (within 24h of break)
 *   🔥 active (both on track today)
 *   ⏳ at risk (after Maghrib local time and either user not yet 5/5)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { t } from '@/lib/i18n';
import type { FriendListEntry } from '@/lib/friendsService';

interface Props {
  entry: FriendListEntry;
  /** `true` after device-local Maghrib; passed by parent so we don't recompute per row. */
  pastMaghribLocal: boolean;
  onPress: () => void;
}

type StatusKind = 'milestone' | 'broken' | 'active' | 'atRisk';

function deriveStatus(entry: FriendListEntry, pastMaghribLocal: boolean): StatusKind {
  // 24h broken window
  if (entry.lastBrokenAt && Date.now() - entry.lastBrokenAt < 24 * 60 * 60 * 1000) {
    return 'broken';
  }
  // Recent milestone (last achievement reached within 24h)
  if (entry.milestonesAchieved.length > 0
      && entry.lastStreakDate
      && entry.currentStreak === entry.milestonesAchieved[entry.milestonesAchieved.length - 1]) {
    return 'milestone';
  }
  if (pastMaghribLocal && (entry.todayCountSelf < 5 || entry.todayCountPartner < 5)) {
    return 'atRisk';
  }
  return 'active';
}

export default function FriendListItem({ entry, pastMaghribLocal, onPress }: Props) {
  const { theme } = useTheme();
  const status = deriveStatus(entry, pastMaghribLocal);
  const icon = STATUS_GLYPH[status];
  const statusLabel = t(STATUS_LABEL[status], { milestone: entry.currentStreak });

  const initials = entry.partner.displayName
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'F';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${entry.partner.displayName}, ${entry.currentStreak} day streak, ${statusLabel}`}
      style={[
        st.row,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadowColor },
      ]}
    >
      {/* Avatar with initials fallback */}
      <View style={[st.avatarWrap, { backgroundColor: theme.surfaceMuted }]}>
        {entry.partner.photoURL ? (
          <Image source={{ uri: entry.partner.photoURL }} style={st.avatar} />
        ) : (
          <Text style={[st.avatarInitials, { color: theme.primary }]}>{initials}</Text>
        )}
      </View>

      <View style={st.center}>
        <Text style={[st.name, { color: theme.text }]} numberOfLines={1}>
          {entry.partner.displayName}
        </Text>
        <Text style={[st.streak, { color: theme.textSecondary }]} numberOfLines={1}>
          🔥 {t('friends.streakDays', { count: entry.currentStreak })}
        </Text>
        <Text style={[st.progress, { color: theme.textTertiary }]} numberOfLines={1}>
          {t('friends.todayProgress', {
            self: entry.todayCountSelf,
            partner: entry.todayCountPartner,
          })}
        </Text>
      </View>

      <View style={[st.statusBadge, { backgroundColor: STATUS_BG[status](theme) }]}>
        <Text style={st.statusIcon} accessibilityElementsHidden>{icon}</Text>
      </View>
    </TouchableOpacity>
  );
}

const STATUS_GLYPH: Record<StatusKind, string> = {
  milestone: '✨',
  broken: '💔',
  active: '🔥',
  atRisk: '⏳',
};

const STATUS_LABEL: Record<StatusKind, string> = {
  milestone: 'friends.statusMilestone',
  broken: 'friends.statusBroken',
  active: 'friends.statusActive',
  atRisk: 'friends.statusAtRisk',
};

const STATUS_BG: Record<StatusKind, (t: any) => string> = {
  milestone: t => `${t.gold}25`,
  broken: t => `${t.error}1A`,
  active: t => `${t.primary}18`,
  atRisk: t => `${t.warning}1F`,
};

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 4,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 44, height: 44 },
  avatarInitials: { fontSize: 16, fontWeight: '700' },
  center: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  streak: { fontSize: 13, fontWeight: '600' },
  progress: { fontSize: 11, fontWeight: '500' },
  statusBadge: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  statusIcon: { fontSize: 18 },
});
