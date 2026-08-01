// Minimal Firebase helpers for optional cloud backup (Firestore + Storage)
/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { contentHash, sanitizeForFirestore } from '../services/firestoreSerialization';
import { boundedSyncBackoff } from '../services/syncPolicy';
export { contentHash, sanitizeForFirestore } from '../services/firestoreSerialization';


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

export let db: ReturnType<typeof initializeFirestore> | null = null;
export let auth: ReturnType<typeof getAuth> | null = null;

export type RecordCounts = {
  customers: number;
  products: number;
  invoices: number;
  deliveryNotes: number;
};

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
const developerLog = (...values: unknown[]) => { if (import.meta.env.DEV) console.info(...values); };

if (startupStatus.enabled) {
  if (startupStatus.missingVariables.length > 0) {
    developerLog('[Firebase] Missing configuration:', startupStatus.missingVariables.join(', '));
  } else {
    developerLog('[Firebase] Enabled and configured.');
  }
} else {
  developerLog('[Firebase] Disabled; local-only mode.');
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
    // One Firestore initialization path. IndexedDB cache makes reads and queued writes
    // available on unreliable connections; Firestore falls back to memory if unavailable.
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch (cacheError) {
      developerLog('[Firebase] Persistent cache unavailable; using memory cache.', cacheError);
      db = initializeFirestore(app, {});
    }
    auth = getAuth(app);
    developerLog('[Firebase] Initialized.');
  } catch (err) {
    developerLog('[Firebase] Initialization failed.', err);
    db = null;
    auth = null;
  }
}

export function firebaseEnabled() {
  return enabled && !!db;
}

export type VisualAssetName = 'signature' | 'seal';
export const DEFAULT_VISUAL_ASSETS: Record<VisualAssetName, string> = {
  signature: '/assets/company-signature.png',
  seal: '/assets/company-seal.png',
};

export async function saveVisualAsset(name: VisualAssetName, dataUrl: string) {
  if (!db) throw new Error('Firebase not enabled');
  await setDoc(doc(db as any, 'billeaseAssets', name), {
    dataUrl,
    removed: false,
    useDefault: false,
    updatedAt: new Date().toISOString(),
  });
}
export async function removeVisualAsset(name: VisualAssetName) {
  if (!db) throw new Error('Firebase not enabled');
  await setDoc(doc(db as any, 'billeaseAssets', name), {
    dataUrl: '',
    removed: true,
    useDefault: false,
    updatedAt: new Date().toISOString(),
  });
}
export async function restoreDefaultVisualAsset(name: VisualAssetName) {
  if (!db) throw new Error('Firebase not enabled');
  await setDoc(doc(db as any, 'billeaseAssets', name), {
    dataUrl: '',
    removed: false,
    useDefault: true,
    updatedAt: new Date().toISOString(),
  });
}
export function useVisualAsset(name: VisualAssetName) {
  const [dataUrl, setDataUrl] = useState(DEFAULT_VISUAL_ASSETS[name]);
  useEffect(() => {
    setDataUrl(DEFAULT_VISUAL_ASSETS[name]);
    if (!db) return;
    let active = true;
    getDoc(doc(db as any, 'billeaseAssets', name)).then((snapshot) => {
      if (!active) return;
      if (!snapshot.exists()) {
        setDataUrl(DEFAULT_VISUAL_ASSETS[name]);
        return;
      }
      const asset = snapshot.data();
      if (asset?.removed === true) {
        setDataUrl('');
      } else {
        setDataUrl(String(asset?.dataUrl || DEFAULT_VISUAL_ASSETS[name]));
      }
    }).catch(() => {
      if (active) setDataUrl(DEFAULT_VISUAL_ASSETS[name]);
    });
    return () => { active = false; };
  }, [name]);
  return dataUrl;
}

export function getRecordCounts(data: any): RecordCounts {
  return {
    customers: Array.isArray(data?.customers) ? data.customers.length : 0,
    products: Array.isArray(data?.products) ? data.products.length : 0,
    invoices: Array.isArray(data?.invoices) ? data.invoices.length : 0,
    deliveryNotes: Array.isArray(data?.deliveryNotes) ? data.deliveryNotes.length : 0,
  };
}

export function getRecordTotal(counts: RecordCounts) {
  return counts.customers + counts.products + counts.invoices + counts.deliveryNotes;
}

export type WriteOperation = 'create' | 'update' | 'delete' | 'initial-hydration' | 'offline-replay';
export type AppDataEnvelope = {
  data: any;
  revision: number;
  updatedAt: unknown;
  clientOperationId: string;
  sourceDeviceId: string;
};

async function saveRecoverySnapshot(current: unknown) {
  if (!db) return;
  const day = new Date().toISOString().slice(0, 10);
  const recovery = collection(db as any, 'billease', 'appData', 'recovery');
  const snapshotRef = doc(recovery, day);
  const existing = await getDoc(snapshotRef);
  if (!existing.exists()) await setDoc(snapshotRef, { data: sanitizeForFirestore(current), createdAt: new Date().toISOString() });
  const snapshots = await getDocs(recovery);
  const old = snapshots.docs.sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, Math.max(0, snapshots.size - 7));
  if (old.length) { const batch = writeBatch(db as any); old.forEach((entry) => batch.delete(entry.ref)); await batch.commit(); }
}

export async function setAppDataBackup(data: unknown, options?: {
  operation?: WriteOperation;
  baseRevision?: number;
  clientOperationId?: string;
  sourceDeviceId?: string;
}): Promise<AppDataEnvelope> {
  if (!firebaseEnabled()) throw new Error('Firebase not enabled');
  try {
    const d = doc(db as any, 'billease', 'appData');
    const outboundCounts = getRecordCounts(data);
    const outboundTotal = getRecordTotal(outboundCounts);
    const isIntentionalDelete = options?.operation === 'delete';
    const safeData = sanitizeForFirestore(data);
    const clientOperationId = options?.clientOperationId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const sourceDeviceId = options?.sourceDeviceId || 'unknown-device';
    const envelope = await runTransaction(db as any, async (transaction) => {
      const existing = await transaction.get(d);
      const current = existing.data() || {};
      const existingData = current.data;
      const currentRevision = Number(current.revision || 0);
      const existingTotal = getRecordTotal(getRecordCounts(existingData));
      if (existingTotal > 0 && outboundTotal === 0) {
        const error = new Error('EMPTY_OVERWRITE_BLOCKED');
        error.name = 'EmptyOverwriteBlockedError';
        throw error;
      }
      if (!isIntentionalDelete && existingTotal > 0 && outboundTotal < existingTotal) {
        const error = new Error('DESTRUCTIVE_OVERWRITE_BLOCKED');
        error.name = 'DestructiveOverwriteBlockedError';
        throw error;
      }
      if (options?.baseRevision !== undefined && currentRevision > options.baseRevision) {
        const error = new Error('REMOTE_REVISION_CONFLICT');
        error.name = 'RemoteRevisionConflictError';
        throw error;
      }
      if (current.clientOperationId === clientOperationId) {
        return { ...current, data: existingData } as AppDataEnvelope;
      }
      const next: AppDataEnvelope = {
        data: safeData,
        revision: currentRevision + 1,
        updatedAt: serverTimestamp(),
        clientOperationId,
        sourceDeviceId,
      };
      transaction.set(d, next);
      return next;
    });
    return envelope;
  } catch (err: any) {
    throw err;
  }
}

export async function getAppDataEnvelope(): Promise<AppDataEnvelope | null> {
  if (!firebaseEnabled()) return null;
  try {
    const d = doc(db as any, 'billease', 'appData');
    const snap = await getDoc(d);
    if (!snap.exists()) return null;
    const payload = snap.data();
    return {
      data: payload?.data ?? null,
      revision: Number(payload?.revision || 0),
      updatedAt: payload?.updatedAt || null,
      clientOperationId: String(payload?.clientOperationId || ''),
      sourceDeviceId: String(payload?.sourceDeviceId || ''),
    };
  } catch (err: any) {
    throw err;
  }
}

export async function getAppDataBackup(): Promise<any | null> {
  return (await getAppDataEnvelope())?.data ?? null;
}
export async function deleteAppDataBackup() {
  if (!firebaseEnabled()) throw new Error('Firebase not enabled');
  const d = doc(db as any, 'billease', 'appData');
  await deleteDoc(d);
}

export async function getCloudBackupRecordCounts(): Promise<RecordCounts> {
  const data = await getAppDataBackup();
  return getRecordCounts(data);
}

/**
 * Firestore sync hook - Automatically syncs app state to Firestore when data changes
 * Call this hook in DataContext to enable cloud backup on every state change
 * @param state - Current app state
 * @param enabled - Whether to enable auto-sync (respects VITE_FIREBASE_ENABLED)
 * @param recordCounts - Optional record counts for safety guard (blocks empty overwrites)
 */
export function useFirestoreSync(
  state: unknown,
  enabled = true,
  recordCounts?: RecordCounts,
  callbacks?: {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    getOperation?: () => WriteOperation;
    getBaseRevision?: () => number;
    getClientOperationId?: () => string;
    getSourceDeviceId?: () => string;
    onPersisted?: (envelope: AppDataEnvelope, hash: string) => void;
    onWriteStarted?: (operationId: string, hash: string) => void;
    onRetryScheduled?: (attempt: number, delayMs: number) => void;
  },
) {
  const lastPersistedHash = useState(() => ({ current: '' }))[0];
  const writeQueue = useState(() => ({ current: Promise.resolve() as Promise<void> }))[0];
  useEffect(() => {
    if (!enabled || !firebaseEnabled()) return;

    const timeout = setTimeout(() => {
      const hash = contentHash(state);
      if (hash === lastPersistedHash.current) {
        callbacks?.onSuccess?.();
        return;
      }
      // The transaction performs the destructive-overwrite guard against the
      // actual remote counts. An empty local record set may still contain a
      // legitimate profile/settings change on a new installation.
      const operation = callbacks?.getOperation?.() || 'update';
      const clientOperationId = callbacks?.getClientOperationId?.() || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      callbacks?.onWriteStarted?.(clientOperationId, hash);
      writeQueue.current = writeQueue.current.then(async () => {
        try {
          let envelope: AppDataEnvelope | undefined;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              envelope = await setAppDataBackup(state, {
                operation,
                baseRevision: callbacks?.getBaseRevision?.(),
                clientOperationId,
                sourceDeviceId: callbacks?.getSourceDeviceId?.(),
              });
              break;
            } catch (error) {
              const code = String((error as { code?: string }).code || '');
              const retryable = /unavailable|deadline-exceeded|aborted|resource-exhausted/.test(code);
              if (!retryable || attempt === 2) throw error;
              const backoff = boundedSyncBackoff(attempt);
              callbacks?.onRetryScheduled?.(attempt + 1, backoff);
              await new Promise((resolve) => window.setTimeout(resolve, backoff));
            }
          }
          if (!envelope) throw new Error('SYNC_RETRY_EXHAUSTED');
          lastPersistedHash.current = hash;
          callbacks?.onPersisted?.(envelope, hash);
          callbacks?.onSuccess?.();
        } catch (error) {
          callbacks?.onError?.(error as Error);
        }
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [state, enabled, recordCounts?.customers, recordCounts?.products, recordCounts?.invoices, recordCounts?.deliveryNotes]);
}
