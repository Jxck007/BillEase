import { AppState } from '../lib/types';

export const LOCAL_DATA_VERSION = 1;
const DB_NAME = 'billease-local';
const STORE_NAME = 'records';
const APP_STATE_KEY = 'app-state';
const RECOVERY_PREFIX = 'recovery:';
const DRAFT_PREFIX = 'draft:';
const MAX_RECOVERY_SNAPSHOTS = 7;

export type LocalAppRecord = {
  version: number;
  data: AppState;
  localRevision: number;
  remoteRevision: number;
  updatedAt: string;
  dirty: boolean;
  pendingSync?: DurableSyncOutbox;
};

export type PendingEntityRef = {
  entityType: 'customer' | 'product' | 'invoice' | 'quotation' | 'deliveryNote' | 'payment' | 'expense' | 'profile' | 'settings' | 'audit' | 'app';
  entityId: string;
  baseHash?: string | null;
};

export type DurableSyncOutbox = {
  operationId: string;
  operationType: 'create' | 'update' | 'delete';
  entities: PendingEntityRef[];
  queuedAt: string;
  retryCount: number;
};

export class DurableWriteQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue(write: () => Promise<void>) {
    const result = this.tail.then(write, write);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('LOCAL_STORAGE_UNAVAILABLE'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('LOCAL_DATABASE_OPEN_FAILED'));
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: Error) => void) => void) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    let result: T;
    let failure: Error | null = null;
    let settled = false;
    const closeAndReject = (error: Error) => {
      if (settled) return;
      settled = true;
      database.close();
      reject(error);
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      database.close();
      resolve(result);
    };
    transaction.onabort = () => closeAndReject(failure || new Error('LOCAL_DATABASE_WRITE_FAILED'));
    transaction.onerror = () => {
      failure ||= new Error('LOCAL_DATABASE_WRITE_FAILED');
    };
    run(
      transaction.objectStore(STORE_NAME),
      (value) => { result = value; },
      (error) => {
        failure = error;
        try { transaction.abort(); } catch { closeAndReject(error); }
      },
    );
  });
}

export async function loadLocalAppState(): Promise<LocalAppRecord | null> {
  return transact<LocalAppRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(APP_STATE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('LOCAL_DATABASE_READ_FAILED'));
  });
}

export async function saveLocalAppState(record: LocalAppRecord): Promise<void> {
  await transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.put({ ...record, version: LOCAL_DATA_VERSION }, APP_STATE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('LOCAL_DATABASE_WRITE_FAILED'));
  });
}

export async function saveRecoverySnapshot(record: LocalAppRecord, reason: string): Promise<void> {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const key = `${RECOVERY_PREFIX}${Date.now()}:${suffix}`;
  await transact<void>('readwrite', (store, resolve, reject) => {
    store.put({ ...record, reason }, key);
    const keysRequest = store.getAllKeys();
    keysRequest.onsuccess = () => {
      const keys = keysRequest.result.filter((entry) => String(entry).startsWith(RECOVERY_PREFIX)).sort();
      keys.slice(0, Math.max(0, keys.length - MAX_RECOVERY_SNAPSHOTS)).forEach((entry) => store.delete(entry));
      resolve();
    };
    keysRequest.onerror = () => reject(new Error('LOCAL_RECOVERY_WRITE_FAILED'));
  });
}

export async function exportSafeLocalBackup(): Promise<string> {
  const record = await loadLocalAppState();
  if (!record) throw new Error('NO_LOCAL_BACKUP');
  return JSON.stringify({ version: record.version, exportedAt: new Date().toISOString(), data: record.data }, null, 2);
}

export type DurableDraft<T> = {
  version: number;
  documentId: string;
  documentType: 'invoice' | 'quotation' | 'delivery-note';
  value: T;
  createdAt: string;
  updatedAt: string;
  localRevision: number;
  syncStatus: 'local' | 'pending' | 'synced' | 'failed';
};

export async function saveLocalDraft<T>(key: string, draft: DurableDraft<T>): Promise<void> {
  await transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(draft, `${DRAFT_PREFIX}${key}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('LOCAL_DRAFT_WRITE_FAILED'));
  });
}

export async function loadLocalDraft<T>(key: string): Promise<DurableDraft<T> | null> {
  return transact<DurableDraft<T> | null>('readonly', (store, resolve, reject) => {
    const request = store.get(`${DRAFT_PREFIX}${key}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('LOCAL_DRAFT_READ_FAILED'));
  });
}

export async function deleteLocalDraft(key: string): Promise<void> {
  await transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(`${DRAFT_PREFIX}${key}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('LOCAL_DRAFT_DELETE_FAILED'));
  });
}
