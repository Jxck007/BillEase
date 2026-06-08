// Minimal Firebase helpers for optional cloud backup (Firestore + Storage)
/// <reference types="vite/client" />
import { useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  storageConnected: boolean;
  localMode: boolean;
  missingVariables: string[];
};

let _db: ReturnType<typeof getFirestore> | null = null;
let _storage: ReturnType<typeof getStorage> | null = null;

function getMissingFirebaseVariables() {
  if (!enabled) return [];
  return requiredEnvKeys.filter((key) => !String(import.meta.env[key] || '').trim());
}

export function getFirebaseStatus(): FirebaseStatus {
  const missingVariables = getMissingFirebaseVariables();
  const configured = enabled && missingVariables.length === 0;
  const appConnected = configured && !!_db;
  const firestoreConnected = configured && !!_db;
  const storageConnected = configured && !!_storage;
  return {
    enabled,
    configured,
    appConnected,
    firestoreConnected,
    storageConnected,
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
    _db = getFirestore(app);
    _storage = getStorage(app);
    console.log('[Firebase Developer Info] Firebase Services initialized successfully.');
  } catch (err) {
    console.error('[Firebase Developer Error] Initialization failed: ', err);
    _db = null;
    _storage = null;
  }
}

export function firebaseEnabled() {
  return enabled && !!_db;
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
  const d = doc(_db as any, 'billease', 'appData');
  const safeData = sanitizeForFirestore(data);
  await setDoc(d, { data: safeData, updatedAt: new Date().toISOString() });
}

export async function getAppDataBackup(): Promise<any | null> {
  if (!firebaseEnabled()) return null;
  const d = doc(_db as any, 'billease', 'appData');
  const snap = await getDoc(d);
  if (!snap.exists()) return null;
  const payload = snap.data();
  return payload?.data ?? null;
}

export async function deleteAppDataBackup() {
  if (!firebaseEnabled()) throw new Error('Firebase not enabled');
  const d = doc(_db as any, 'billease', 'appData');
  await deleteDoc(d);
}

export async function uploadExportFile(path: string, blob: Blob) {
  if (!firebaseEnabled() || !_storage) throw new Error('Firebase Storage not enabled');
  const storageRef = ref(_storage as any, path);
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}

/**
 * Upload a PNG or PDF export file to Firebase Cloud Storage
 * @param filename - Name of the file (e.g., "INV_2024-001.png")
 * @param blob - Blob data (from html2canvas or PDF generator)
 * @param docType - Type of document ("invoice" | "estimate" | "delivery-note")
 * @returns Download URL for the uploaded file
 */
export async function uploadExport(filename: string, blob: Blob, docType: 'invoice' | 'estimate' | 'delivery-note' = 'invoice') {
  if (!firebaseEnabled() || !_storage) throw new Error('Firebase Storage not enabled');
  const timestamp = new Date().toISOString().split('T')[0];
  const path = `exports/${docType}/${timestamp}/${filename}`;
  const storageRef = ref(_storage as any, path);
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}

export async function testStorageConnection(): Promise<boolean> {
  if (!firebaseEnabled() || !_storage) return false;
  try {
    const storageRef = ref(_storage as any, 'exports/.connection_test');
    const blob = new Blob(['check'], { type: 'text/plain' });
    await uploadBytes(storageRef, blob);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Firestore sync hook - Automatically syncs app state to Firestore when data changes
 * Call this hook in DataContext to enable cloud backup on every state change
 * @param state - Current app state
 * @param enabled - Whether to enable auto-sync (respects VITE_FIREBASE_ENABLED)
 */
export function useFirestoreSync(state: unknown, enabled = true) {
  useEffect(() => {
    if (!enabled || !firebaseEnabled()) return;

    // Debounce sync to avoid excessive writes
    const timeout = setTimeout(async () => {
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
  }, [state, enabled]);
}
