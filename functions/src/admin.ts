/**
 * Singleton Firebase Admin SDK.
 * Imported by every function file so initializeApp() is called exactly once
 * regardless of which entry point boots first.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const messaging = admin.messaging();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export type DocumentReference = admin.firestore.DocumentReference;
export type Transaction = admin.firestore.Transaction;
export { admin };
