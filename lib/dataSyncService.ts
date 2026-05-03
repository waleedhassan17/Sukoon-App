/**
 * DataSyncService - Production-Ready Offline-First Data Layer
 * 
 * Architecture: Offline-First with Cloud Sync
 * ─────────────────────────────────────────────
 * - AsyncStorage is the PRIMARY data store (always works offline)
 * - Firebase Firestore is the optional CLOUD BACKUP (syncs when available)
 * - All reads hit local first (instant), then sync in background
 * - All writes go to local first, then push to cloud async
 * - Conflict resolution: last-write-wins with timestamp
 * 
 * Data Collections:
 * - salahTracker: prayer status per day
 * - savedAyahs: bookmarked Quran verses
 * - readingProgress: last seen position, streaks, daily counts
 * - audioProgress: last played audio position
 * - preferences: app settings, notification prefs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, getAuth, isFirebaseConfigured } from './firebaseConfig';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

interface SyncMetadata {
  lastLocalUpdate: number;
  lastCloudSync: number;
  deviceId: string;
}

interface CloudDocument {
  data: any;
  updatedAt: number;
  deviceId: string;
}

// ══════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════

const SYNC_KEYS = {
  DEVICE_ID: 'sukoon_device_id',
  SYNC_META: 'sukoon_sync_meta',
  LAST_SYNC: 'sukoon_last_cloud_sync',
  USER_ID: 'sukoon_firebase_uid',
};

// Data domains to sync
const SYNC_DOMAINS = {
  SALAH_TRACKER: 'salahTracker',
  SAVED_AYAHS: 'savedAyahs',
  READING_PROGRESS: 'readingProgress',
  AUDIO_PROGRESS: 'audioProgress',
  PREFERENCES: 'preferences',
} as const;

type SyncDomain = typeof SYNC_DOMAINS[keyof typeof SYNC_DOMAINS];

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(SYNC_KEYS.DEVICE_ID);
    if (!id) {
      id = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await AsyncStorage.setItem(SYNC_KEYS.DEVICE_ID, id);
    }
    return id;
  } catch {
    return `device_fallback_${Date.now()}`;
  }
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SYNC_KEYS.USER_ID);
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════
// MAIN SERVICE
// ══════════════════════════════════════════════

export const DataSyncService = {
  
  // ── INITIALIZATION ──
  async init(): Promise<void> {
    await getDeviceId();
    
    // One-time migration: fix any salah data stored in wrapped {data:{...}} format
    await this._migrateSalahDataFormat();
    
    // Try anonymous Firebase auth (enables Firestore access)
    if (isFirebaseConfigured()) {
      try {
        const auth = await getAuth();
        if (auth) {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            const credential = await auth.signInAnonymously();
            if (credential.user) {
              await AsyncStorage.setItem(SYNC_KEYS.USER_ID, credential.user.uid);
              if (__DEV__) console.log('[DataSync] Anonymous auth:', credential.user.uid);
            }
          } else {
            await AsyncStorage.setItem(SYNC_KEYS.USER_ID, currentUser.uid);
          }
        }
      } catch (error) {
        if (__DEV__) console.warn('[DataSync] Auth failed (offline mode):', error);
      }
    }
  },

  /**
   * One-time migration: convert any salah data from wrapped {data:{...}, updatedAt}
   * format to flat {fajr, zuhr, ..., updatedAt} format.
   * This fixes data corrupted by the old saveLocal() wrapper bug.
   */
  async _migrateSalahDataFormat(): Promise<void> {
    const MIGRATION_KEY = 'sukoon_salah_migration_v2';
    try {
      const done = await AsyncStorage.getItem(MIGRATION_KEY);
      if (done) return; // Already migrated

      const allKeys = await AsyncStorage.getAllKeys();
      const salahKeys = allKeys.filter(k => k.startsWith('sukoon_salah_'));
      let fixed = 0;

      for (const key of salahKeys) {
        try {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          // Detect wrapped format: has .data object but no .fajr at top level
          if (parsed.data !== undefined && typeof parsed.data === 'object' && !('fajr' in parsed)) {
            const unwrapped = { ...parsed.data };
            // Preserve updatedAt from outer wrapper if inner doesn't have it
            if (!unwrapped.updatedAt && parsed.updatedAt) {
              unwrapped.updatedAt = parsed.updatedAt;
            }
            await AsyncStorage.setItem(key, JSON.stringify(unwrapped));
            fixed++;
          }
        } catch {
          // Skip corrupted entries
        }
      }

      await AsyncStorage.setItem(MIGRATION_KEY, String(Date.now()));
      if (__DEV__ && fixed > 0) console.log(`[DataSync] Migrated ${fixed} salah records from wrapped to flat format`);
    } catch (error) {
      if (__DEV__) console.warn('[DataSync] Salah data migration failed:', error);
      // Non-fatal — the unwrapSalahData() helper in salah-tracker handles both formats
    }
  },

  // ══════════════════════════════════════════════
  // LOCAL STORAGE (PRIMARY - always available)
  // ══════════════════════════════════════════════

  /**
   * Save data locally (and optionally sync to cloud)
   */
  async saveLocal(key: string, data: any): Promise<void> {
    try {
      const payload = JSON.stringify({
        data,
        updatedAt: Date.now(),
      });
      await AsyncStorage.setItem(key, payload);
    } catch (error) {
      if (__DEV__) console.error('[DataSync] Local save failed:', key, error);
    }
  },

  /**
   * Read data from local storage
   */
  async readLocal<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Handle both wrapped ({data, updatedAt}) and raw formats
      return parsed.data !== undefined ? parsed.data : parsed;
    } catch {
      return null;
    }
  },

  /**
   * Delete local data
   */
  async deleteLocal(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },

  // ══════════════════════════════════════════════
  // CLOUD SYNC (OPTIONAL - when Firebase is configured)
  // ══════════════════════════════════════════════

  /**
   * Push local data to Firestore (fire-and-forget)
   */
  async pushToCloud(domain: SyncDomain, key: string, data: any): Promise<void> {
    if (!isFirebaseConfigured()) return;
    
    try {
      const db = await getFirestore();
      const userId = await getCurrentUserId();
      if (!db || !userId) return;

      const deviceId = await getDeviceId();
      const docRef = db.collection('users').doc(userId).collection(domain).doc(key);
      
      await docRef.set({
        data,
        updatedAt: Date.now(),
        deviceId,
      } as CloudDocument, { merge: true });

      if (__DEV__) console.log(`[DataSync] Pushed ${domain}/${key} to cloud`);
    } catch (error) {
      if (__DEV__) console.warn(`[DataSync] Cloud push failed for ${domain}/${key}:`, error);
      // Silently fail — local data is the source of truth
    }
  },

  /**
   * Pull data from Firestore (for sync/restore)
   */
  async pullFromCloud<T>(domain: SyncDomain, key: string): Promise<T | null> {
    if (!isFirebaseConfigured()) return null;
    
    try {
      const db = await getFirestore();
      const userId = await getCurrentUserId();
      if (!db || !userId) return null;

      const doc = await db.collection('users').doc(userId).collection(domain).doc(key).get();
      if (doc.exists) {
        const cloudData = doc.data() as CloudDocument;
        return cloudData.data as T;
      }
      return null;
    } catch (error) {
      if (__DEV__) console.warn(`[DataSync] Cloud pull failed for ${domain}/${key}:`, error);
      return null;
    }
  },

  // ══════════════════════════════════════════════
  // DOMAIN-SPECIFIC HELPERS
  // ══════════════════════════════════════════════

  /**
   * Save and sync salah tracker data.
   * IMPORTANT: Saves directly to AsyncStorage (NOT via saveLocal which wraps
   * in {data, updatedAt}). This keeps the format flat ({fajr, zuhr, ..., updatedAt})
   * so loadMonth/loadDay can read it without unwrapping.
   */
  async saveSalahData(dateKey: string, dayData: any): Promise<void> {
    const storageKey = `sukoon_salah_${dateKey}`;
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(dayData));
    } catch (error) {
      if (__DEV__) console.error('[DataSync] Salah local save failed:', dateKey, error);
      throw error; // Propagate so caller can use fallback
    }
    // Non-blocking cloud sync (fire-and-forget with retry)
    this._pushSalahToCloudWithRetry(dateKey, dayData);
    // ALSO mirror into the Salah Buddy schema at prayers/{uid}/days/{date}.
    // This is what Cloud Functions watch for streak fan-out. Local AsyncStorage
    // remains the source of truth for the user's own UI; this write is best-effort.
    this._mirrorToFriendsSchema(dateKey, dayData).catch(() => {});
  },

  /**
   * Translate the legacy {fajr, zuhr, asr, maghrib, isha: PrayerStatus} shape
   * into the Salah-Buddy doc shape and write it under prayers/{uid}/days/{date}.
   *
   * Mapping:
   *   - 'prayed' | 'jamaah' | 'qasr'  → logged: true
   *   - 'missed' | 'none'             → logged: false
   *   - the legacy `zuhr` key becomes `dhuhr` (canonical Arabic transliteration)
   *
   * prayerCount + completedAt are written client-side too as an optimization;
   * the server's onPrayerWrite trigger will overwrite if anything is off.
   */
  async _mirrorToFriendsSchema(dateKey: string, dayData: any): Promise<void> {
    if (!isFirebaseConfigured()) return;
    try {
      const db = await getFirestore();
      const userId = await getCurrentUserId();
      if (!db || !userId) return;

      const isLogged = (s: unknown) => s === 'prayed' || s === 'jamaah' || s === 'qasr';
      const now = Date.now();
      const buildEntry = (statusKey: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha') => ({
        logged: isLogged(dayData[statusKey]),
        loggedAt: isLogged(dayData[statusKey]) ? now : null,
      });

      const fajr = buildEntry('fajr');
      const dhuhr = buildEntry('zuhr'); // legacy → canonical
      const asr = buildEntry('asr');
      const maghrib = buildEntry('maghrib');
      const isha = buildEntry('isha');

      const prayerCount =
        Number(fajr.logged) + Number(dhuhr.logged) + Number(asr.logged)
        + Number(maghrib.logged) + Number(isha.logged);

      const tz = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
        catch { return 'UTC'; }
      })();

      await db.collection('prayers').doc(userId).collection('days').doc(dateKey).set({
        date: dateKey,
        fajr, dhuhr, asr, maghrib, isha,
        prayerCount,
        completedAt: prayerCount === 5 ? now : null,
        timezone: tz,
        updatedAt: now,
      }, { merge: true });
    } catch (err) {
      if (__DEV__) console.warn('[DataSync] friends-schema mirror failed:', err);
    }
  },

  /**
   * Push salah data to cloud with a single retry on failure
   */
  async _pushSalahToCloudWithRetry(dateKey: string, dayData: any): Promise<void> {
    try {
      await this.pushToCloud(SYNC_DOMAINS.SALAH_TRACKER, dateKey, dayData);
    } catch (err1) {
      // Retry once after a short delay
      try {
        await new Promise(r => setTimeout(r, 2000));
        await this.pushToCloud(SYNC_DOMAINS.SALAH_TRACKER, dateKey, dayData);
      } catch (err2) {
        if (__DEV__) console.warn(`[DataSync] Cloud push failed for ${dateKey} after retry:`, err2);
        // Data is safe in local storage — will sync on next app open
      }
    }
  },

  /**
   * Load all salah data for a month from Firestore (batch read)
   * Returns a map of dateKey -> DayData
   */
  async loadSalahMonthFromCloud(year: number, month: number): Promise<Record<string, any>> {
    if (!isFirebaseConfigured()) return {};
    
    try {
      const db = await getFirestore();
      const userId = await getCurrentUserId();
      if (!db || !userId) return {};

      // Create date range for the month
      const startKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endMonth = month === 11 ? 0 : month + 1;
      const endYear = month === 11 ? year + 1 : year;
      const endKey = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`;

      const snapshot = await db
        .collection('users')
        .doc(userId)
        .collection(SYNC_DOMAINS.SALAH_TRACKER)
        .where('__name__', '>=', startKey)
        .where('__name__', '<', endKey)
        .get();

      const result: Record<string, any> = {};
      snapshot.docs.forEach((doc: any) => {
        const cloudData = doc.data() as CloudDocument;
        if (cloudData?.data) {
          result[doc.id] = cloudData.data;
        }
      });

      if (__DEV__) console.log(`[DataSync] Loaded ${Object.keys(result).length} salah days from cloud for ${year}-${month + 1}`);
      return result;
    } catch (error) {
      if (__DEV__) console.warn('[DataSync] Cloud salah month load failed:', error);
      return {};
    }
  },

  /**
   * Load single day's salah data with local-first, cloud-fallback strategy.
   * Handles both wrapped {data:{...}, updatedAt} and flat {fajr,..., updatedAt} formats.
   */
  async loadSalahDay(dateKey: string): Promise<any | null> {
    const storageKey = `sukoon_salah_${dateKey}`;
    
    // Try local first (read directly, handle both formats)
    try {
      const localRaw = await AsyncStorage.getItem(storageKey);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        // Unwrap if stored in {data: {...}, updatedAt} wrapper format
        if (parsed.data !== undefined && typeof parsed.data === 'object' && !('fajr' in parsed)) {
          return parsed.data;
        }
        return parsed;
      }
    } catch {
      // Corrupted local data — fall through to cloud
    }
    
    // Fallback to cloud
    const cloudData = await this.pullFromCloud<any>(SYNC_DOMAINS.SALAH_TRACKER, dateKey);
    if (cloudData) {
      // Cache locally in flat format (NOT via saveLocal which wraps)
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(cloudData));
      } catch {}
      return cloudData;
    }
    
    return null;
  },

  /**
   * Sync local salah data with cloud (merge strategy: latest wins)
   * This merges cloud data into local storage for a given month
   */
  async syncSalahMonth(year: number, month: number): Promise<number> {
    if (!isFirebaseConfigured()) return 0;
    
    try {
      const cloudData = await this.loadSalahMonthFromCloud(year, month);
      let synced = 0;

      for (const [dateKey, dayData] of Object.entries(cloudData)) {
        const storageKey = `sukoon_salah_${dateKey}`;
        const localRaw = await AsyncStorage.getItem(storageKey);
        
        if (!localRaw) {
          // No local data — save cloud data in flat format
          await AsyncStorage.setItem(storageKey, JSON.stringify(dayData));
          synced++;
        } else {
          // Compare timestamps — handle both wrapped and flat local formats
          try {
            const localParsed = JSON.parse(localRaw);
            // Unwrap if in {data: {...}, updatedAt} wrapper format
            const localUnwrapped = (localParsed.data !== undefined && typeof localParsed.data === 'object' && !('fajr' in localParsed))
              ? localParsed.data : localParsed;
            const localTime = localParsed.updatedAt || localUnwrapped?.updatedAt || 0;
            const cloudTime = (dayData as any).updatedAt || 0;
            
            if (cloudTime > localTime) {
              // Cloud is newer — save in flat format
              await AsyncStorage.setItem(storageKey, JSON.stringify(dayData));
              synced++;
            } else if (localParsed.data !== undefined && typeof localParsed.data === 'object' && !('fajr' in localParsed)) {
              // Local data is in wrapped format — migrate to flat format while preserving it
              const migrated = { ...localUnwrapped };
              if (!migrated.updatedAt) migrated.updatedAt = localParsed.updatedAt;
              await AsyncStorage.setItem(storageKey, JSON.stringify(migrated));
            }
          } catch {
            // If parse fails, prefer cloud data
            await AsyncStorage.setItem(storageKey, JSON.stringify(dayData));
            synced++;
          }
        }
      }

      if (__DEV__ && synced > 0) console.log(`[DataSync] Synced ${synced} salah days from cloud`);
      return synced;
    } catch (error) {
      if (__DEV__) console.warn('[DataSync] Salah month sync failed:', error);
      return 0;
    }
  },

  /**
   * Save and sync saved ayahs
   */
  async saveSavedAyahs(verses: any[]): Promise<void> {
    const storageKey = 'sukoon_saved_verses';
    await AsyncStorage.setItem(storageKey, JSON.stringify(verses));
    // Background cloud sync
    this.pushToCloud(SYNC_DOMAINS.SAVED_AYAHS, 'all', { verses, count: verses.length }).catch(() => {});
  },

  /**
   * Save and sync reading progress
   */
  async saveReadingProgress(data: {
    lastSeen?: any;
    lastAudio?: any;
    streak?: any;
    todayRead?: string[];
  }): Promise<void> {
    // Save each piece locally (using existing keys for backward compat)
    if (data.lastSeen) {
      await AsyncStorage.setItem('sukoon_last_seen', JSON.stringify(data.lastSeen));
    }
    if (data.lastAudio) {
      await AsyncStorage.setItem('sukoon_last_audio', JSON.stringify(data.lastAudio));
    }
    if (data.streak) {
      await AsyncStorage.setItem('sukoon_streak', JSON.stringify(data.streak));
    }
    // Background cloud sync
    this.pushToCloud(SYNC_DOMAINS.READING_PROGRESS, 'latest', data).catch(() => {});
  },

  // ══════════════════════════════════════════════
  // FULL SYNC (Backup & Restore)
  // ══════════════════════════════════════════════

  /**
   * Full backup: push all local data to cloud
   */
  async backupToCloud(): Promise<{ success: boolean; synced: number }> {
    if (!isFirebaseConfigured()) return { success: false, synced: 0 };
    
    let synced = 0;
    try {
      // 1. Saved verses
      const verses = await AsyncStorage.getItem('sukoon_saved_verses');
      if (verses) {
        await this.pushToCloud(SYNC_DOMAINS.SAVED_AYAHS, 'all', { verses: JSON.parse(verses) });
        synced++;
      }

      // 2. Reading progress
      const lastSeen = await AsyncStorage.getItem('sukoon_last_seen');
      const lastAudio = await AsyncStorage.getItem('sukoon_last_audio');
      const streak = await AsyncStorage.getItem('sukoon_streak');
      await this.pushToCloud(SYNC_DOMAINS.READING_PROGRESS, 'latest', {
        lastSeen: lastSeen ? JSON.parse(lastSeen) : null,
        lastAudio: lastAudio ? JSON.parse(lastAudio) : null,
        streak: streak ? JSON.parse(streak) : null,
      });
      synced++;

      // 3. Salah tracker data (last 90 days)
      const allKeys = await AsyncStorage.getAllKeys();
      const salahKeys = allKeys.filter(k => k.startsWith('sukoon_salah_'));
      for (const key of salahKeys.slice(-90)) {
        const val = await AsyncStorage.getItem(key);
        if (val) {
          const dateKey = key.replace('sukoon_salah_', '');
          let parsed = JSON.parse(val);
          // Unwrap if stored in legacy {data: {...}, updatedAt} format
          if (parsed.data !== undefined && typeof parsed.data === 'object' && !('fajr' in parsed)) {
            parsed = parsed.data;
          }
          await this.pushToCloud(SYNC_DOMAINS.SALAH_TRACKER, dateKey, parsed);
          synced++;
        }
      }

      // 4. Notification preferences
      const notifPrefs = await AsyncStorage.getItem('sukoon_notif_prefs');
      if (notifPrefs) {
        await this.pushToCloud(SYNC_DOMAINS.PREFERENCES, 'notifications', JSON.parse(notifPrefs));
        synced++;
      }

      await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, String(Date.now()));
      if (__DEV__) console.log(`[DataSync] Full backup complete: ${synced} items`);
      return { success: true, synced };
    } catch (error) {
      if (__DEV__) console.error('[DataSync] Backup failed:', error);
      return { success: false, synced };
    }
  },

  /**
   * Full restore: pull all cloud data to local
   */
  async restoreFromCloud(): Promise<{ success: boolean; restored: number }> {
    if (!isFirebaseConfigured()) return { success: false, restored: 0 };
    
    let restored = 0;
    try {
      // 1. Saved verses
      const cloudVerses = await this.pullFromCloud<{ verses: any[] }>(SYNC_DOMAINS.SAVED_AYAHS, 'all');
      if (cloudVerses?.verses) {
        await AsyncStorage.setItem('sukoon_saved_verses', JSON.stringify(cloudVerses.verses));
        restored++;
      }

      // 2. Reading progress
      const cloudProgress = await this.pullFromCloud<any>(SYNC_DOMAINS.READING_PROGRESS, 'latest');
      if (cloudProgress) {
        if (cloudProgress.lastSeen) await AsyncStorage.setItem('sukoon_last_seen', JSON.stringify(cloudProgress.lastSeen));
        if (cloudProgress.lastAudio) await AsyncStorage.setItem('sukoon_last_audio', JSON.stringify(cloudProgress.lastAudio));
        if (cloudProgress.streak) await AsyncStorage.setItem('sukoon_streak', JSON.stringify(cloudProgress.streak));
        restored++;
      }

      // 3. Notification preferences
      const cloudPrefs = await this.pullFromCloud<any>(SYNC_DOMAINS.PREFERENCES, 'notifications');
      if (cloudPrefs) {
        await AsyncStorage.setItem('sukoon_notif_prefs', JSON.stringify(cloudPrefs));
        restored++;
      }

      if (__DEV__) console.log(`[DataSync] Restore complete: ${restored} items`);
      return { success: true, restored };
    } catch (error) {
      if (__DEV__) console.error('[DataSync] Restore failed:', error);
      return { success: false, restored };
    }
  },

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number | null> {
    try {
      const raw = await AsyncStorage.getItem(SYNC_KEYS.LAST_SYNC);
      return raw ? parseInt(raw, 10) : null;
    } catch { return null; }
  },

  /**
   * Check if Firebase cloud sync is available
   */
  isCloudSyncAvailable(): boolean {
    return isFirebaseConfigured();
  },
};

export default DataSyncService;
