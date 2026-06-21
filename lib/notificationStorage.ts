/**
 * notificationStorage.ts — Persistent Notification Storage
 *
 * Every notification (azan, reminder, general) is stored locally via AsyncStorage.
 * The Notifications screen reads from this store.
 *
 * Storage key: "@notifications"
 *
 * Each item:
 * {
 *   id:      unique string (timestamp-based),
 *   title:   string,
 *   message: string,
 *   type:    "azan" | "reminder" | "general",
 *   time:    ISO 8601 string,
 *   read:    boolean
 * }
 *
 * Items are stored newest-first (reverse chronological).
 * Duplicates are prevented by checking id + title within a 60-second window.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type NotificationType = 'azan' | 'reminder' | 'general';

export interface StoredNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  time: string; // ISO 8601
  read: boolean;
  /** Optional extra data (prayer name, action, etc.) */
  data?: Record<string, any>;
  /**
   * Stable identity for deduplication. Derived from the OS notification's
   * scheduled identifier (which is unique per prayer per day) so that the same
   * delivered notification, re-read every time the app is reopened, is only ever
   * stored once — regardless of how much time has passed.
   */
  dedupeKey?: string;
}

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════

const STORAGE_KEY = '@notifications';
const MAX_STORED = 200; // keep last 200 notifications
const DEDUP_WINDOW_MS = 60_000; // 60 seconds — ignore duplicate within this window

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

/**
 * Determine notification type from the notification data payload.
 */
export function resolveNotificationType(data?: Record<string, any>): NotificationType {
  if (!data) return 'general';

  const { type, action } = data;

  // Prayer azan notifications
  if (type === 'prayer' && action === 'azan') return 'azan';

  // All reminder-style notifications
  if (
    type === 'prayer-reminder' ||
    type === 'tracker-reminder' ||
    type === 'quran-reminder' ||
    type === 'eod-reminder' ||
    action === 'pre-alert'
  ) {
    return 'reminder';
  }

  // Internet warning is a general notification
  if (type === 'internet-warning') return 'general';

  return 'general';
}

/**
 * Generate a unique ID for a notification.
 * Uses timestamp + random suffix to guarantee uniqueness.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** Calendar-day stamp (local) used to scope dedupe keys to a single day. */
function dayStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Build a stable dedupe key for a notification.
 *
 * When the OS notification carries a scheduled identifier (e.g.
 * `prayer-fajr-2026-06-22`) we key off that — it's already unique per prayer per
 * day, so re-reading the same delivered notification across app opens collapses
 * to one entry. Otherwise we fall back to type+title+day, which still prevents a
 * given reminder from being stored twice in the same day.
 */
function buildDedupeKey(
  identifier: string | undefined,
  title: string,
  type: NotificationType,
  when: Date,
): string {
  const id = (identifier ?? '').trim();
  // Skip volatile test identifiers so test notifications aren't over-deduped.
  if (id && !id.startsWith('test-azan-')) return `id:${id}`;
  return `t:${type}:${title}:${dayStamp(when)}`;
}

/** True if `newItem` duplicates something already stored. */
function isDuplicateOf(existing: StoredNotification[], newItem: StoredNotification, now: Date): boolean {
  return existing.some((item) => {
    if (item.dedupeKey && newItem.dedupeKey && item.dedupeKey === newItem.dedupeKey) return true;
    // Legacy/no-key safety net: same title within a short window.
    if (item.title === newItem.title) {
      const timeDiff = Math.abs(now.getTime() - new Date(item.time).getTime());
      if (timeDiff < DEDUP_WINDOW_MS) return true;
    }
    return false;
  });
}

// ══════════════════════════════════════════════
// NOTIFICATION STORAGE SERVICE
// ══════════════════════════════════════════════

export const NotificationStorage = {
  /**
   * Get all stored notifications (newest first).
   */
  async getAll(): Promise<StoredNotification[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // Ensure it's an array (defensive)
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[NotificationStorage] getAll error:', e);
      return [];
    }
  },

  /**
   * Add a notification from a raw expo-notifications object.
   * Deduplicates by title within a 60-second window.
   * Prepends (newest on top) and trims to MAX_STORED.
   */
  async addFromNotification(notification: any): Promise<StoredNotification | null> {
    try {
      const content = notification?.request?.content;
      if (!content) return null;

      const title = content.title || 'Sukoon';
      const message = content.body || '';
      const data = content.data as Record<string, any> | undefined;
      const type = resolveNotificationType(data);
      const now = new Date();
      const identifier: string | undefined = notification?.request?.identifier;

      // Build the new item
      const newItem: StoredNotification = {
        id: generateId(),
        title,
        message,
        type,
        time: now.toISOString(),
        read: false,
        data,
        dedupeKey: buildDedupeKey(identifier, title, type, now),
      };

      // Load existing
      const existing = await this.getAll();

      // Deduplicate by stable key (and a legacy title/time safety net).
      if (isDuplicateOf(existing, newItem, now)) {
        console.log('[NotificationStorage] Duplicate notification skipped:', title);
        return null;
      }

      // Prepend newest, trim to max
      const updated = [newItem, ...existing].slice(0, MAX_STORED);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      console.log(`[NotificationStorage] Saved: "${title}" (type: ${type})`);
      return newItem;
    } catch (e) {
      console.warn('[NotificationStorage] addFromNotification error:', e);
      return null;
    }
  },

  /**
   * Add a manually constructed notification (e.g., from test button or scheduled azan).
   * Deduplicates by title within a 60-second window.
   */
  async addManual(params: {
    title: string;
    message: string;
    type: NotificationType;
    data?: Record<string, any>;
  }): Promise<StoredNotification | null> {
    try {
      const now = new Date();
      const newItem: StoredNotification = {
        id: generateId(),
        title: params.title,
        message: params.message,
        type: params.type,
        time: now.toISOString(),
        read: false,
        data: params.data,
        dedupeKey: buildDedupeKey(undefined, params.title, params.type, now),
      };

      const existing = await this.getAll();

      // Deduplicate by stable key (and a legacy title/time safety net).
      if (isDuplicateOf(existing, newItem, now)) {
        console.log('[NotificationStorage] Duplicate manual notification skipped:', params.title);
        return null;
      }

      const updated = [newItem, ...existing].slice(0, MAX_STORED);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      console.log(`[NotificationStorage] Saved manual: "${params.title}" (type: ${params.type})`);
      return newItem;
    } catch (e) {
      console.warn('[NotificationStorage] addManual error:', e);
      return null;
    }
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    try {
      const items = await this.getAll();
      const updated = items.map((item) =>
        item.id === id ? { ...item, read: true } : item
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[NotificationStorage] markAsRead error:', e);
    }
  },

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead(): Promise<void> {
    try {
      const items = await this.getAll();
      const updated = items.map((item) => ({ ...item, read: true }));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[NotificationStorage] markAllAsRead error:', e);
    }
  },

  /**
   * Delete a single notification by id.
   */
  async remove(id: string): Promise<void> {
    try {
      const items = await this.getAll();
      const updated = items.filter((item) => item.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[NotificationStorage] remove error:', e);
    }
  },

  /**
   * Clear all stored notifications.
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[NotificationStorage] clearAll error:', e);
    }
  },

  /**
   * Get count of unread notifications.
   */
  async getUnreadCount(): Promise<number> {
    try {
      const items = await this.getAll();
      return items.filter((item) => !item.read).length;
    } catch {
      return 0;
    }
  },

  /**
   * Get notifications filtered by type.
   */
  async getByType(type: NotificationType): Promise<StoredNotification[]> {
    try {
      const items = await this.getAll();
      return items.filter((item) => item.type === type);
    } catch {
      return [];
    }
  },
};
