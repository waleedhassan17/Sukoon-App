/**
 * NotificationsScreen — Persistent Notification History
 *
 * Reads from NotificationStorage (@notifications key in AsyncStorage).
 * Displays all notifications in reverse chronological order.
 * Supports:
 *  - Per-item mark as read (tap to toggle)
 *  - Mark all as read
 *  - Type badges (azan, reminder, general)
 *  - Empty state with enable-notifications CTA
 *  - Clear all with confirmation
 *  - Data survives app restart
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationService } from '@/lib/notificationService';
import {
  NotificationStorage,
  StoredNotification,
  NotificationType,
} from '@/lib/notificationStorage';

// ══════════════════════════════════════════════
// LEGACY EXPORT — kept so _layout.tsx import doesn't break
// New code should use NotificationStorage from lib/notificationStorage.ts.
// ══════════════════════════════════════════════
const LEGACY_KEY = 'sukoon_notification_history';
export const NotificationHistory = {
  async getAll(): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  async add(notification: any): Promise<void> {
    try {
      const existing = await this.getAll();
      const newItem = {
        id: notification?.request?.identifier || `notif-${Date.now()}`,
        title: notification?.request?.content?.title || 'Sukoon',
        body: notification?.request?.content?.body || '',
        data: notification?.request?.content?.data,
        receivedAt: Date.now(),
        read: false,
      };
      const updated = [newItem, ...existing].slice(0, 100);
      await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(updated));
    } catch {}
  },
  async markAllRead(): Promise<void> {
    try {
      const items = await this.getAll();
      const updated = items.map((n: any) => ({ ...n, read: true }));
      await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(updated));
    } catch {}
  },
  async clearAll(): Promise<void> {
    try { await AsyncStorage.removeItem(LEGACY_KEY); } catch {}
  },
  async getUnreadCount(): Promise<number> {
    try {
      const items = await this.getAll();
      return items.filter((n: any) => !n.read).length;
    } catch { return 0; }
  },
};

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function getNotifIcon(type: NotificationType, data?: Record<string, any>): { name: string; color: string } {
  switch (type) {
    case 'azan':
      return { name: 'volume-high-outline', color: '#6366F1' };
    case 'reminder': {
      const subType = data?.type;
      if (subType === 'prayer-reminder') return { name: 'time-outline', color: '#F59E0B' };
      if (subType === 'tracker-reminder') return { name: 'checkbox-outline', color: '#40916C' };
      if (subType === 'quran-reminder') return { name: 'book-outline', color: '#8B5CF6' };
      return { name: 'notifications-outline', color: '#F59E0B' };
    }
    default:
      return { name: 'notifications-outline', color: '#64748B' };
  }
}

function getTypeBadge(type: NotificationType): { label: string; bg: string; fg: string } {
  switch (type) {
    case 'azan':     return { label: 'AZAN',     bg: '#6366F120', fg: '#6366F1' };
    case 'reminder': return { label: 'REMINDER', bg: '#F59E0B20', fg: '#F59E0B' };
    default:         return { label: 'GENERAL',  bg: '#64748B20', fg: '#64748B' };
  }
}

function formatTime(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ══════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Load on mount ──
  useEffect(() => {
    loadNotifications();
    checkNotifStatus();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const items = await NotificationStorage.getAll();
      setNotifications(items);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  };

  const checkNotifStatus = async () => {
    const prefs = await NotificationService.getPreferences();
    setNotifEnabled(prefs.enabled);
  };

  // ── Mark single notification as read ──
  const handleMarkAsRead = useCallback(async (id: string) => {
    await NotificationStorage.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // ── Mark all as read ──
  const handleMarkAllRead = useCallback(async () => {
    await NotificationStorage.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // ── Clear all ──
  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Notifications',
      'Remove all notification history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await NotificationStorage.clearAll();
            setNotifications([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ],
    );
  }, []);

  // ── Delete single ──
  const handleDelete = useCallback(async (id: string) => {
    await NotificationStorage.remove(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // ── Enable notifications CTA ──
  const handleEnableNotifications = async () => {
    const enabled = await NotificationService.enableNotifications();
    if (enabled) {
      setNotifEnabled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive prayer reminders.',
      );
    }
  };

  // ── Render each notification item ──
  const renderItem = ({ item }: { item: StoredNotification }) => {
    const icon = getNotifIcon(item.type, item.data);
    const badge = getTypeBadge(item.type);

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => !item.read && handleMarkAsRead(item.id)}
          onLongPress={() =>
            Alert.alert('Delete', 'Remove this notification?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item.id) },
            ])
          }
        >
          <View
            style={[
              styles.notifCard,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              !item.read && {
                borderLeftColor: theme.primary,
                borderLeftWidth: 3,
              },
            ]}
          >
            {/* Icon */}
            <View style={[styles.notifIconWrap, { backgroundColor: icon.color + '18' }]}>
              <Ionicons name={icon.name as any} size={20} color={icon.color} />
            </View>

            {/* Content */}
            <View style={styles.notifContent}>
              <View style={styles.notifTopRow}>
                <Text
                  style={[
                    styles.notifTitle,
                    { color: theme.text },
                    !item.read && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {/* Type badge */}
                <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.typeBadgeText, { color: badge.fg }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              <Text
                style={[styles.notifBody, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                {item.message}
              </Text>

              <View style={styles.notifBottomRow}>
                <Text style={[styles.notifTime, { color: theme.textTertiary }]}>
                  {formatTime(item.time)}
                </Text>
                {!item.read && (
                  <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ── Empty State ──
  const EmptyState = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="notifications-off-outline" size={48} color={theme.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No Notifications</Text>
      <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
        {notifEnabled
          ? 'Your prayer reminders, azan alerts, and other notifications will appear here.'
          : 'Enable notifications to receive prayer reminders and daily Quran alerts.'}
      </Text>
      {!notifEnabled && (
        <TouchableOpacity onPress={handleEnableNotifications} activeOpacity={0.8} style={styles.enableBtn}>
          <LinearGradient colors={['#2D6A4F', '#1B4332']} style={styles.enableBtnInner}>
            <Ionicons name="notifications-outline" size={18} color="#fff" />
            <Text style={styles.enableBtnText}>Enable Notifications</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* ═══ HEADER ═══ */}
      <LinearGradient
        colors={theme.headerGradient as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerBar}>
          {/* Back */}
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Title + unread count */}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={handleMarkAllRead}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.headerBtn, notifications.length === 0 && { opacity: 0.4 }]}
              onPress={handleClearAll}
              activeOpacity={0.7}
              disabled={notifications.length === 0}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* ═══ LIST ═══ */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ══════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // List
  listContent: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Notification Card
  notifCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  notifIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
    gap: 3,
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  notifBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  enableBtn: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  enableBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  enableBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
