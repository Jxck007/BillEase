// Minimal Firebase helpers for optional cloud backup (Firestore + Storage)
/// <reference types="vite/client" />
import { useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const enabled = import.meta.env.VITE_FIREBASE_ENABLED === 'true';
const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export type FirebaseStatus = {
  enabled: boolean;
  configured: boolean;
  appConnected: boolean;
  firestoreConnected: boolean;
  localMode: boolean;
  missingVariables: string[];
};

export let db: ReturnType<typeof getFirestore> | null = null;
export let auth: ReturnType<typeof getAuth> | null = null;

function getMissingFirebaseVariables() {
  if (!enabled) return [];
  return requiredEnvKeys.filter((key) => !String(import.meta.env[key] || '').trim());
}

export function getFirebaseStatus(): FirebaseStatus {
  const missingVariables = getMissingFirebaseVariables();
  const configured = enabled && missingVariables.length === 0;
  const appConnected = configured && !!db;
  const firestoreConnected = configured && !!db;
  return {
    enabled,
    configured,
    appConnected,
    firestoreConnected,
    localMode: !configured || !appConnected,
    missingVariables,
  };
}

export function getFirebaseStatusMessage() {
  const status = getFirebaseStatus();
  if (!status.enabled) return 'Firebase disabled. Running in local mode.';
  if (!status.configured) return 'Firebase not connected. Running in local mode.';
  if (!status.appConnected) return 'Firebase initialization failed. Running in local mode.';
  return 'Firebase connected.';
}

const startupStatus = getFirebaseStatus();

if (startupStatus.enabled) {
  if (startupStatus.missingVariables.length > 0) {
    console.warn('[Firebase Developer Warning] Missing environment variables for Firebase configuration:', startupStatus.missingVariables.join(', '));
  } else {
    console.log('[Firebase Developer Info] Firebase is enabled and environment variables are present.');
  }
} else {
  console.log('[Firebase Developer Info] Firebase is disabled. Running in local-only mode.');
}

if (enabled && startupStatus.missingVariables.length === 0) {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  try {
    const app = initializeApp(config as any);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('[Firebase Developer Info] Firebase Services initialized successfully.');
  } catch (err) {
    console.error('[Firebase Developer Error] Initialization failed: ', err);
    db = null;
    auth = null;
  }
}

export function firebaseEnabled() {
  return enabled && !!db;
}

function sanitizeForFirestore(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForFirestore(entry, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return null;
    }
    seen.add(value as object);

    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        output[key] = sanitizeForFirestore(entry, seen);
      }
    }
    return output;
  }

  return value;
}

export async function setAppDataBackup(data: unknown) {
  if (!firebaseEnabled()) throw new Error('Firebase not enabled');
  console.log('[Firestore] Operation: WRITE | Collection: billease | Path: billease/appData');
  try {
    const d = doc(db as any, 'billease', 'appData');
    const safeData = sanitizeForFirestore(data);
    await setDoc(d, { data: safeData, updatedAt: new Date().toISOString() });
    console.log('[Firestore] WRITE SUCCESS | Path: billease/appData');
  } catch (err: any) {
    console.error(`[Firestore] WRITE FAILED | Path: billease/appData | Error: ${err.message}`);
    throw err;
  }
}

export async function getAppDataBackup(): Promise<any | null> {
  if (!firebaseEnabled()) return null;
  console.log('[Firestore] Operation: READ | Collection: billease | Path: billease/appData');
  try {
    const d = doc(db as any, 'billease', 'appData');
    const snap = await getDoc(d);
    if (!snap.exists()) {
      console.log('[Firestore] READ SUCCESS | Path: billease/appData (Document does not exist)');
      return null;
    }
    console.log('[Firestore] READ SUCCESS | Path: billease/appData');
    const payload = snap.data();
    return payload?.data ?? null;
  } catch (err: any) {
    console.error(`[Firestore] READ FAILED | Path: billease/appData | Error: ${err.message}`);
    throw err;
  }
}

export async function deleteAppDataBackup() {
  if (!firebaseEnabled()) throw new Error('Firebase not enabled');
  const d = doc(db as any, 'billease', 'appData');
  await deleteDoc(d);
}

/**
 * Firestore sync hook - Automatically syncs app state to Firestore when data changes
 * Call this hook in DataContext to enable cloud backup on every state change
 * @param state - Current app state
 * @param enabled - Whether to enable auto-sync (respects VITE_FIREBASE_ENABLED)
 * @param recordCounts - Optional record counts for safety guard (blocks empty overwrites)
 */
export function useFirestoreSync(state: unknown, enabled = true, recordCounts?: { customers: number; products: number; invoices: number; deliveryNotes: number }) {
  useEffect(() => {
    if (!enabled || !firebaseEnabled()) return;

    // Debounce sync to avoid excessive writes
    const timeout = setTimeout(async () => {
      // SAFETY GUARD: Prevent empty overwrites of non-empty cloud data
      const outboundTotal = (recordCounts?.customers || 0) + (recordCounts?.products || 0) + (recordCounts?.invoices || 0) + (recordCounts?.deliveryNotes || 0);
      if (outboundTotal === 0) {
        try {
          const existingData = await getAppDataBackup();
          if (existingData) {
            const existingTotal = (existingData.customers?.length || 0) + (existingData.products?.length || 0) + (existingData.invoices?.length || 0) + (existingData.deliveryNotes?.length || 0);
            if (existingTotal > 0) {
              console.warn('[Firebase] SAFETY GUARD: Blocked empty overwrite — cloud has existing data. Skipping auto-sync.');
              return;
            }
          }
        } catch {
          // If we can't read cloud, allow the write (fresh start)
        }
      }

      try {
        await setAppDataBackup(state);
      } catch (err) {
        const errMsg = (err as Error).message;
        // Suppress blocked-by-client errors (browser extension) as they're non-critical
        if (!errMsg.includes('ERR_BLOCKED_BY_CLIENT') && !errMsg.includes('blocked')) {
          console.warn('[Firebase] Auto-sync failed (non-critical):', errMsg);
        }
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeout);
  }, [state, enabled, recordCounts?.customers, recordCounts?.products, recordCounts?.invoices, recordCounts?.deliveryNotes]);
}
