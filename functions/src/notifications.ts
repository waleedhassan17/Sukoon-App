/**
 * Notification dispatch helpers.
 *
 * Two parallel sinks per event:
 *   1. notifications/{uid}/items/{id} — durable in-app inbox (read by client UI).
 *   2. FCM push — best-effort, fan out to all of the user's registered tokens.
 *
 * Stale-token cleanup: on UNREGISTERED / INVALID_ARGUMENT we strip the token from
 * users/{uid}.fcmTokens so future sends don't re-fail.
 */

import { db, messaging, FieldValue } from './admin';
import { NotificationDoc, NotificationType } from './types';

interface DispatchOptions {
  uid: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

export async function dispatchNotification(opts: DispatchOptions): Promise<void> {
  await Promise.all([
    writeInboxItem(opts),
    sendPush(opts).catch(err => {
      // Pushes are best-effort — the inbox item is the durable record.
      console.warn(`[notifications] push failed for ${opts.uid}:`, err);
    }),
  ]);
}

async function writeInboxItem(opts: DispatchOptions): Promise<void> {
  const item: Omit<NotificationDoc, 'createdAt'> & {
    createdAt: FirebaseFirestore.FieldValue;
  } = {
    type: opts.type,
    payload: { ...opts.payload, title: opts.title, body: opts.body },
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection('notifications').doc(opts.uid).collection('items').add(item);
}

async function sendPush(opts: DispatchOptions): Promise<void> {
  const userSnap = await db.collection('users').doc(opts.uid).get();
  const tokens: string[] = (userSnap.get('fcmTokens') as string[] | undefined) ?? [];
  if (tokens.length === 0) return;

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: opts.title, body: opts.body },
    data: serializeForData({ type: opts.type, ...opts.payload }),
    android: {
      priority: 'high',
      notification: { channelId: 'sukoon-friends', sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
    },
  });

  // Strip dead tokens so we stop wasting quota on them.
  const dead: string[] = [];
  response.responses.forEach((r, idx) => {
    if (r.success) return;
    const code = r.error?.code;
    if (
      code === 'messaging/registration-token-not-registered'
      || code === 'messaging/invalid-registration-token'
      || code === 'messaging/invalid-argument'
    ) {
      dead.push(tokens[idx]);
    }
  });
  if (dead.length > 0) {
    await db.collection('users').doc(opts.uid).update({
      fcmTokens: FieldValue.arrayRemove(...dead),
    }).catch(() => {});
  }
}

/** FCM data payload values must all be strings. */
function serializeForData(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}
