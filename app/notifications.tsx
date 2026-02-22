/**
 * NotificationsScreen - Notification History & Management
 * Shows stored notifications with clear option
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
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationService } from '@/lib/notificationService';

// Lazy-load expo-notifications — not available in Expo Go (SDK 53+)
let Notifications: any = null;
try {
  const mod = require('expo-notifications');
  // Verify the module actually works (Expo Go throws at usage, not import)
  if (mod && typeof mod.getPermissionsAsync === 'function') {
    Notifications = mod;
  }
} catch {
  // Silently ignore — running in Expo Go without native notification support
}

/* ─── Types ─── */
export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: number; // Date.now()
  read: boolean;
}

const STORAGE_KEY = 'sukoon_notification_history';
const MAX_STORED = 100; // keep last 100

/* ─── Notification Storage Helper (exported for use in _layout.tsx) ─── */
export const NotificationHistory = {
  async getAll(): Promise<StoredNotification[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  async add(notification: any): Promise<void> {
    try {
      const existing = await this.getAll();
      const newItem: StoredNotification = {
        id: notification.request.identifier || `notif-${Date.now()}`,
        title: notification.request.content.title || 'Sukoon',
        body: notification.request.content.body || '',
        data: notification.request.content.data as Record<string, any> | undefined,
        receivedAt: Date.now(),
        read: false,
      };
      // Prepend new, limit to MAX_STORED
      const updated = [newItem, ...existing].slice(0, MAX_STORED);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  async markAllRead(): Promise<void> {
    try {
      const items = await this.getAll();
      const updated = items.map(n => ({ ...n, read: true }));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  },

  async getUnreadCount(): Promise<number> {
    try {
      const items = await this.getAll();
      return items.filter(n => !n.read).length;
    } catch { return 0; }
  },
};

/* ─── Notification Icon Map ─── */
function getNotifIcon(data?: Record<string, any>): { name: string; color: string } {
  const type = data?.type;
  switch (type) {
    case 'prayer': return { name: 'moon-outline', color: '#6366F1' };
    case 'prayer-reminder': return { name: 'time-outline', color: '#F59E0B' };
    case 'tracker-reminder': return { name: 'checkbox-outline', color: '#40916C' };
    case 'quran-reminder': return { name: 'book-outline', color: '#8B5CF6' };
    default: return { name: 'notifications-outline', color: '#64748B' };
  }
}

function formatTime(timestamp: number): string {
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
}

/* ─── Main Screen ─── */
export default function NotificationsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadNotifications();
    checkNotifStatus();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const items = await NotificationHistory.getAll();
    setNotifications(items);
    setLoading(false);
    // Mark all as read on view
    await NotificationHistory.markAllRead();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const checkNotifStatus = async () => {
    const prefs = await NotificationService.getPreferences();
    setNotifEnabled(prefs.enabled);
  };

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
            await NotificationHistory.clearAll();
            setNotifications([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ]
    );
  }, []);

  const handleEnableNotifications = async () => {
    const enabled = await NotificationService.enableNotifications();
    if (enabled) {
      setNotifEnabled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Alert.alert('Permission Required', 'Please enable notifications in your device settings to receive prayer reminders.');
    }
  };

  const renderItem = ({ item, index }: { item: StoredNotification; index: number }) => {
    const icon = getNotifIcon(item.data);
    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={[
          styles.notifCard, 
          { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          !item.read && { borderLeftColor: theme.primary, borderLeftWidth: 3 },
        ]}>
          <View style={[styles.notifIconWrap, { backgroundColor: icon.color + '18' }]}>
            <Ionicons name={icon.name as any} size={20} color={icon.color} />
          </View>
          <View style={styles.notifContent}>
            <Text style={[styles.notifTitle, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.notifBody, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={[styles.notifTime, { color: theme.textTertiary }]}>
              {formatTime(item.receivedAt)}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="notifications-off-outline" size={48} color={theme.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No Notifications</Text>
      <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
        {notifEnabled 
          ? 'Your prayer reminders and alerts will appear here.'
          : 'Enable notifications to receive prayer reminders and daily Quran alerts.'
        }
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

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient
        colors={theme.headerGradient as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity
            style={[styles.headerBtn, notifications.length === 0 && { opacity: 0.4 }]}
            onPress={handleClearAll}
            activeOpacity={0.7}
            disabled={notifications.length === 0}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Notification Settings Banner */}
      {!notifEnabled && notifications.length === 0 && null}

      {/* List */}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  listContent: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  notifCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
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
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
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
