/**
 * SalahTopTabs — tiny segmented control rendered at the top of every Salah-related
 * screen (tracker, friends list, invites). Tapping a segment routes to that screen
 * without losing the user's place in the Salah stack.
 *
 * Why navigate (not local-state-switch) between three views:
 *   - The existing tracker is 1100 lines of single-screen layout. Folding two new
 *     tabs into the same render tree would risk regressions in the calendar +
 *     prayer-card logic that's already battle-tested.
 *   - expo-router already manages stack history; pushReplacement keeps "back"
 *     leaving the Salah area entirely, matching what tabs do natively.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { t, useLocale } from '@/lib/i18n';

type TabKey = 'today' | 'friends' | 'invites';

const TABS: { key: TabKey; route: string; icon: string; labelKey: string }[] = [
  { key: 'today',    route: '/tools/salah-tracker', icon: 'calendar-outline', labelKey: 'friends.todayTab' },
  { key: 'friends',  route: '/tools/salah-friends', icon: 'people-outline',   labelKey: 'friends.tab' },
  { key: 'invites',  route: '/tools/salah-invites', icon: 'mail-outline',     labelKey: 'friends.invitesTab' },
];

function activeKeyFromPath(pathname: string | null): TabKey {
  if (pathname?.includes('salah-friends')) return 'friends';
  if (pathname?.includes('salah-invites')) return 'invites';
  return 'today';
}

export default function SalahTopTabs() {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  useLocale(); // re-render on locale change
  const active = activeKeyFromPath(pathname);

  const onPress = (key: TabKey, route: string) => {
    if (key === active) return;
    Haptics.selectionAsync().catch(() => {});
    // replace() — feels like switching tabs rather than stacking three screens deep.
    router.replace(route as any);
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        st.row,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
    >
      {TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onPress(tab.key, tab.route)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(tab.labelKey)}
            style={[
              st.tab,
              isActive && [st.tabActive, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }],
            ]}
          >
            <Ionicons
              name={(isActive ? tab.icon.replace('-outline', '') : tab.icon) as any}
              size={15}
              color={isActive ? theme.primary : theme.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={[
                st.label,
                { color: isActive ? theme.primary : theme.textSecondary },
                isActive && st.labelActive,
              ]}
            >
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    minHeight: 44, // a11y: meets 48dp tap target with parent padding
    borderRadius: 10,
  },
  tabActive: {
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  label: { fontSize: 13, fontWeight: '600' },
  labelActive: { fontWeight: '700' },
});
