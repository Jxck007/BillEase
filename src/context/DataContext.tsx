import { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { AppState, AuditLog, Payment, PaymentMethod } from '../lib/types';
import { generateId } from '../lib/utils';
import { contentHash, db, getFirebaseStatus, FirebaseStatus, useFirestoreSync } from '../lib/firebase';
import { useAuth } from './AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DurableSyncOutbox, DurableWriteQueue, getPendingSyncOperations, LOCAL_DATA_VERSION, LocalAppRecord, PendingEntityRef, saveLocalAppState, saveRecoverySnapshot } from '../services/localDataStore';
import { errorReference, recordDiagnostic } from '../services/diagnostics';
import { entityContentHash } from '../services/persistencePolicy';
import { recalculateInvoicePayments, validateNewPayment } from '../services/paymentService';
import { classifySyncError, isCommittedWriteAcknowledgement, shouldRestartPendingSync } from '../services/syncPolicy';
import { createNormalizedOutboxOperation } from '../services/normalizedOutbox';
import { getFirestoreDataMode } from '../lib/normalizedFirebase';
import { initialAppState } from '../persistence/hydrateAppState';
import type { DataContextType, MutationResult, SyncDetails, SyncStatus } from './dataContextTypes';
import { createEntityRepositories } from '../repositories/entityRepositories';
import { useFirestoreListeners } from '../sync/useFirestoreListeners';
import { useNormalizedOutboxSync } from '../sync/useNormalizedOutboxSync';
import { useDataHydration } from '../persistence/useDataHydration';

export { hydrateAppState } from '../persistence/hydrateAppState';
export type { DataContextType, MutationResult, SyncDetails, SyncStatus } from './dataContextTypes';

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const stateRef = useRef(state);
  const [isLoaded, setIsLoaded] = useState(false);
  const [firebaseStatus] = useState<FirebaseStatus>(() => getFirebaseStatus());
  const [firestoreDataMode] = useState(() => getFirestoreDataMode());
  const normalizedMode = firestoreDataMode !== 'aggregate';
  const { user, isAdmin } = useAuth();
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [hasDirtyChanges, setHasDirtyChanges] = useState(false);
  const [syncBlocked, setSyncBlocked] = useState(false);
  const [syncDetails, setSyncDetails] = useState<SyncDetails>({ internet: typeof navigator === 'undefined' ? true : navigator.onLine, signedIn: Boolean(user), cloudAvailable: Boolean(db), pendingChanges: 0, pendingSince: null, lastAttemptAt: null, lastSyncResult: null, lastSyncErrorCategory: null, errorReference: null });
  const dirtyRef = useRef(false);
  const localRevision = useRef(0);
  const remoteRevision = useRef(0);
  const latestOperationId = useRef('');
  const deviceId = useRef('');
  const pendingSync = useRef<DurableSyncOutbox | null>(null);
  const normalizedOutbox = useRef<DurableSyncOutbox[]>([]);
  const pendingAcknowledgement = useRef<{ operationId: string; hash: string; revision?: number } | null>(null);
  const syncMetadata = useRef<NonNullable<LocalAppRecord['syncMetadata']>>({});
  const durableWriteQueue = useRef(new DurableWriteQueue());
  const [retryTrigger, setRetryTrigger] = useState(0);
  const lastOnline = useRef(typeof navigator === 'undefined' ? true : navigator.onLine);
  const emitSyncTrigger = useCallback(() => setRetryTrigger((current) => current + 1), []);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => setSyncDetails((current) => ({ ...current, signedIn: Boolean(user), cloudAvailable: Boolean(db) })), [user]);
  useEffect(() => {
    const updateOnline = () => {
      const online = navigator.onLine;
      setSyncDetails((current) => ({ ...current, internet: online }));
      if (shouldRestartPendingSync({ wasOnline: lastOnline.current, online, dirty: dirtyRef.current, signedIn: Boolean(user), cloudAvailable: Boolean(db) })) {
        setRetryTrigger((current) => current + 1);
      }
      lastOnline.current = online;
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => { window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, [user]);
  useEffect(() => {
    const restartIfPending = () => {
      if (!dirtyRef.current) return;
      if (!navigator.onLine) {
        recordDiagnostic({ operation: 'sync-worker', entityType: 'app', status: 'skipped', resultCategory: 'SYNC_SKIPPED:OFFLINE' });
        return;
      }
      if (!user) {
        recordDiagnostic({ operation: 'sync-worker', entityType: 'app', status: 'skipped', resultCategory: 'SYNC_SKIPPED:AUTH_NOT_READY' });
        return;
      }
      if (!db) {
        recordDiagnostic({ operation: 'sync-worker', entityType: 'app', status: 'skipped', resultCategory: 'SYNC_SKIPPED:CLOUD_NOT_READY' });
        return;
      }
      setRetryTrigger((current) => current + 1);
    };
    const visibility = () => { if (document.visibilityState === 'visible') restartIfPending(); };
    window.addEventListener('focus', restartIfPending);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('focus', restartIfPending); document.removeEventListener('visibilitychange', visibility); };
  }, [user]);
  useEffect(() => {
    try {
      const key = 'billease.deviceId';
      deviceId.current = sessionStorage.getItem(key) || generateId();
      sessionStorage.setItem(key, deviceId.current);
    } catch {
      deviceId.current = generateId();
      recordDiagnostic({ operation: 'initialize', entityType: 'device', status: 'fallback', errorCategory: 'storage-unavailable' });
    }
  }, []);

  const persistLocal = useCallback(async (next: AppState, dirty: boolean, revision = localRevision.current) => {
    const record: LocalAppRecord = {
      version: LOCAL_DATA_VERSION,
      data: next,
      localRevision: revision,
      remoteRevision: remoteRevision.current,
      updatedAt: new Date().toISOString(),
      dirty,
      pendingSync: dirty && !normalizedMode ? pendingSync.current || undefined : undefined,
      pendingOperations: dirty && normalizedMode ? normalizedOutbox.current : undefined,
      syncMetadata: syncMetadata.current,
    };
    await durableWriteQueue.current.enqueue(() => saveLocalAppState(record));
    setLastSavedAt(record.updatedAt);
    setSyncStatus(dirty ? (navigator.onLine ? 'local' : 'offline') : 'online');
  }, [normalizedMode]);

  const acknowledgeCommittedState = useCallback(async (operationId: string, revision: number, resultCategory: string) => {
    pendingAcknowledgement.current = null;
    pendingSync.current = null;
    remoteRevision.current = Math.max(remoteRevision.current, revision);
    setHasDirtyChanges(false);
    dirtyRef.current = false;
    setSyncBlocked(false);
    setSyncStatus('online');
    setSyncNotice(null);
    setSyncDetails((current) => ({ ...current, pendingChanges: 0, pendingSince: null, errorReference: null }));
    syncMetadata.current = { ...syncMetadata.current, lastSyncResult: 'success', lastSyncErrorCategory: undefined };
    try {
      await persistLocal(stateRef.current, false);
      recordDiagnostic({ operationId, operation: 'acknowledge', entityType: 'app', localRevision: localRevision.current, remoteRevision: revision, acknowledgedAt: new Date().toISOString(), status: 'synced', resultCategory, signedIn: Boolean(user) });
    } catch {
      const reference = errorReference('LOCAL');
      setSyncStatus('action-required');
      setSyncNotice(`Cloud sync succeeded, but the local recovery copy could not be updated. Error reference: ${reference}`);
      recordDiagnostic({ operationId, operation: 'acknowledge', entityType: 'app', localRevision: localRevision.current, remoteRevision: revision, status: 'failed', resultCategory: 'local-ack-persist-failed', errorCategory: 'local-storage', errorReference: reference, signedIn: Boolean(user) });
    }
  }, [persistLocal, user]);

  const commitState = useCallback(async (
    mutate: (current: AppState) => AppState,
    operation: 'create' | 'update' | 'delete' = 'update',
    entityType = 'app',
    entityId?: string,
    relatedEntities: PendingEntityRef[] = [],
  ): Promise<MutationResult> => {
    if (operation === 'delete' || entityType === 'payment') {
      try {
        await saveRecoverySnapshot({
          version: LOCAL_DATA_VERSION,
          data: stateRef.current,
          localRevision: localRevision.current,
          remoteRevision: remoteRevision.current,
          updatedAt: new Date().toISOString(),
          dirty: dirtyRef.current,
        }, operation === 'delete' ? `before-delete:${entityType}` : 'before-payment-change');
      } catch {
        const reference = errorReference('DELETE');
        setSyncStatus('action-required');
        setSyncNotice(`The item was not deleted because a recovery copy could not be created. Error reference: ${reference}`);
        return { ok: false, id: entityId, errorReference: reference };
      }
    }
    const currentBeforeMutation = stateRef.current;
    const next = mutate(currentBeforeMutation);
    let shouldQueueCloud = firebaseStatus.configured;
    stateRef.current = next;
    setState(next);
    localRevision.current += 1;
    const operationId = generateId();
    latestOperationId.current = operationId;
    if (normalizedMode) {
      const outboxOperation = createNormalizedOutboxOperation({ operationId, operationType: operation, before: currentBeforeMutation, after: next });
      if (outboxOperation.entities.length) normalizedOutbox.current = [...normalizedOutbox.current, outboxOperation];
      pendingSync.current = outboxOperation.entities.length ? outboxOperation : null;
      shouldQueueCloud = firebaseStatus.configured && outboxOperation.entities.length > 0;
    } else {
      const existingEntities = pendingSync.current?.entities || [];
      const newEntities: PendingEntityRef[] = [{ entityType: entityType as PendingEntityRef['entityType'], entityId: entityId || 'aggregate' }, ...relatedEntities]
        .map((entry) => ({ ...entry, baseHash: entityContentHash(currentBeforeMutation, entry) }));
      const entityMap = new Map(existingEntities.map((entry) => [`${entry.entityType}:${entry.entityId}`, entry]));
      newEntities.forEach((entry) => {
        const key = `${entry.entityType}:${entry.entityId}`;
        if (!entityMap.has(key)) entityMap.set(key, entry);
      });
      pendingSync.current = {
        operationId,
        operationType: pendingSync.current?.operationType === 'delete' || operation === 'delete' ? 'delete' : operation,
        entities: [...entityMap.values()],
        queuedAt: pendingSync.current?.queuedAt || new Date().toISOString(),
        retryCount: pendingSync.current?.retryCount || 0,
      };
    }
    if (!shouldQueueCloud) pendingSync.current = null;
    setHasDirtyChanges(shouldQueueCloud);
    dirtyRef.current = shouldQueueCloud;
    setSyncStatus('unsaved');
    setSyncDetails((current) => ({ ...current, pendingChanges: shouldQueueCloud ? (normalizedMode ? normalizedOutbox.current.length : 1) : 0, pendingSince: shouldQueueCloud ? (current.pendingSince || new Date().toISOString()) : null, lastSyncResult: null, lastSyncErrorCategory: null, errorReference: null }));
    try {
      await persistLocal(next, shouldQueueCloud);
      recordDiagnostic({ operationId, operation, entityType, entityId, localRevision: localRevision.current, remoteRevision: remoteRevision.current, queuedAt: pendingSync.current?.queuedAt, status: 'saved-locally', resultCategory: 'local-save-complete', signedIn: Boolean(user) });
      if (shouldQueueCloud) emitSyncTrigger();
      return { ok: true, id: entityId };
    } catch {
      const reference = errorReference('LOCAL');
      setSyncStatus('action-required');
      setSyncNotice(`Something went wrong while saving. Your work is still open as a draft. Error reference: ${reference}`);
      recordDiagnostic({ operation, entityType, entityId, revision: localRevision.current, status: 'failed', errorCategory: 'local-storage', errorReference: reference });
      return { ok: false, id: entityId, errorReference: reference };
    }
  }, [emitSyncTrigger, firebaseStatus.configured, normalizedMode, persistLocal, user]);

  useDataHydration({
    firebaseConfigured: firebaseStatus.configured,
    firestoreDataMode,
    normalizedMode,
    signedIn: Boolean(user),
    stateRef,
    dirtyRef,
    localRevision,
    remoteRevision,
    latestOperationId,
    pendingSync,
    normalizedOutbox,
    syncMetadata,
    setState,
    setIsLoaded,
    setCloudSyncEnabled,
    setHasDirtyChanges,
    setSyncBlocked,
    setSyncStatus,
    setSyncNotice,
    setSyncDetails,
    setLastSavedAt,
    persistLocal,
    onDurableOutboxReady: emitSyncTrigger,
  });

  useFirestoreListeners({
    normalizedMode,
    cloudSyncEnabled,
    signedIn: Boolean(user),
    stateRef,
    dirtyRef,
    localRevision,
    remoteRevision,
    latestOperationId,
    deviceId,
    pendingSync,
    normalizedOutbox,
    pendingAcknowledgement,
    setState,
    setSyncBlocked,
    setSyncStatus,
    setSyncNotice,
    setSyncDetails,
    persistLocal,
    acknowledgeCommittedState,
  });

  useFirestoreSync(state, !normalizedMode && cloudSyncEnabled && hasDirtyChanges && !syncBlocked, undefined, {
    onSuccess: () => undefined,
    onError: (error) => {
      const category = classifySyncError(error);
      const reference = errorReference(category === 'conflict' ? 'CONFLICT' : 'SYNC');
      setSyncStatus(category === 'conflict' || category === 'permission-denied' || category === 'auth-required' || category === 'data-too-large' ? 'action-required' : (navigator.onLine ? 'failed' : 'offline'));
      setSyncNotice(category === 'conflict'
        ? `Another device saved a newer version. Both versions remain protected. Retry after reviewing the latest data. Error reference: ${reference}`
        : category === 'permission-denied'
          ? `Cloud access was denied. Your work remains saved on this device; an administrator must review Firestore permissions. Error reference: ${reference}`
          : category === 'auth-required'
            ? `Sign in again to sync. Your work remains saved on this device. Error reference: ${reference}`
            : category === 'data-too-large'
              ? `Cloud backup is too large for the current Firestore document. Export a local backup and reduce embedded logo or QR image size. Error reference: ${reference}`
        : `Your document could not be synced yet. It has been saved safely on this device. Error reference: ${reference}`);
      const result = category === 'conflict' || category === 'permission-denied' || category === 'auth-required' || category === 'data-too-large' ? 'action-required' : 'failed';
      syncMetadata.current = { ...syncMetadata.current, lastSyncResult: result, lastSyncErrorCategory: category };
      setSyncDetails((current) => ({ ...current, lastSyncResult: result, lastSyncErrorCategory: category, errorReference: reference }));
      recordDiagnostic({ operationId: pendingSync.current?.operationId, operation: 'write', entityType: 'app', localRevision: localRevision.current, remoteRevision: remoteRevision.current, retryCount: pendingSync.current?.retryCount, status: 'failed', resultCategory: category, errorCategory: error.name, errorReference: reference, signedIn: Boolean(user) });
    },
    getOperation: () => pendingSync.current?.operationType || 'update',
    getBaseRevision: () => remoteRevision.current,
    getClientOperationId: () => pendingSync.current?.operationId || latestOperationId.current,
    getSourceDeviceId: () => deviceId.current,
    getDurablePendingOperations: getPendingSyncOperations,
    onWriteStarted: (operationId, hash) => {
      pendingAcknowledgement.current = { operationId, hash };
      setSyncStatus('saving');
      setSyncDetails((current) => ({ ...current, pendingChanges: 1, pendingSince: current.pendingSince || new Date().toISOString(), errorReference: null }));
    },
    onAttempt: () => {
      if (!pendingSync.current) return;
      pendingSync.current = { ...pendingSync.current, retryCount: pendingSync.current.retryCount + 1 };
      const outbox = pendingSync.current;
      const attemptedAt = new Date().toISOString();
      syncMetadata.current = { ...syncMetadata.current, lastSyncAttemptAt: attemptedAt, lastSyncResult: undefined, lastSyncErrorCategory: undefined };
      setSyncDetails((current) => ({ ...current, lastAttemptAt: attemptedAt, lastSyncResult: null, lastSyncErrorCategory: null, errorReference: null }));
      void durableWriteQueue.current.enqueue(() => saveLocalAppState({
        version: LOCAL_DATA_VERSION, data: stateRef.current, localRevision: localRevision.current, remoteRevision: remoteRevision.current,
        updatedAt: new Date().toISOString(), dirty: true, pendingSync: outbox, syncMetadata: syncMetadata.current,
      })).catch(() => {
        const reference = errorReference('LOCAL');
        setSyncStatus('action-required');
        setSyncNotice(`The sync retry metadata could not be saved locally. Keep this tab open. Error reference: ${reference}`);
        recordDiagnostic({ operationId: outbox.operationId, operation: 'write-outbox', entityType: 'app', localRevision: localRevision.current, remoteRevision: remoteRevision.current, retryCount: outbox.retryCount, status: 'failed', resultCategory: 'outbox-persist-failed', errorCategory: 'local-storage', errorReference: reference, signedIn: Boolean(user) });
      });
      recordDiagnostic({ operationId: outbox.operationId, operation: outbox.operationType, entityType: 'app', localRevision: localRevision.current, remoteRevision: remoteRevision.current, queuedAt: outbox.queuedAt, attemptedAt: new Date().toISOString(), retryCount: outbox.retryCount, status: 'attempting', resultCategory: 'cloud-write-pending', signedIn: Boolean(user) });
    },
    onRetryScheduled: () => {
      syncMetadata.current = { ...syncMetadata.current, lastSyncResult: 'retry-scheduled' };
      setSyncNotice('Retry scheduled. Your work remains safe on this device.');
      setSyncDetails((current) => ({ ...current, lastSyncResult: 'retry-scheduled' }));
    },
    onPersisted: (envelope, hash) => {
      if (hash !== contentHash(stateRef.current)) return;
      const pending = pendingAcknowledgement.current;
      if (!isCommittedWriteAcknowledgement({ operationId: envelope.clientOperationId, hash, currentHash: contentHash(stateRef.current) }, pending)) return;
      void acknowledgeCommittedState(envelope.clientOperationId, envelope.revision, 'transaction-commit');
    },
    retryTrigger,
  });

  useNormalizedOutboxSync({
    enabled: normalizedMode && cloudSyncEnabled,
    hasDirtyChanges,
    syncBlocked,
    signedIn: Boolean(user),
    retryTrigger,
    stateRef,
    localRevision,
    deviceId,
    dirtyRef,
    pendingSync,
    normalizedOutbox,
    setHasDirtyChanges,
    setSyncBlocked,
    setSyncStatus,
    setSyncNotice,
    setSyncDetails,
    persistLocal,
  });

  const retrySync = async () => {
    const operations = await getPendingSyncOperations();
    if (!operations.length) {
      recordDiagnostic({ operation: 'sync-worker', entityType: 'app', status: 'skipped', resultCategory: 'SYNC_SKIPPED:NO_PENDING_OPERATIONS' });
      return;
    }
    pendingSync.current = operations[0];
    normalizedOutbox.current = normalizedMode ? operations : normalizedOutbox.current;
    dirtyRef.current = true;
    setHasDirtyChanges(true);
    setSyncBlocked(false);
    setSyncStatus('local');
    setRetryTrigger((current) => current + 1);
  };

  const {
    addAuditLog,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addProduct,
    updateProduct,
    deleteProduct,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addExpense,
    deleteExpense,
    updateProfile,
    updateSettings,
    addDeliveryNote,
    updateDeliveryNote,
    deleteDeliveryNote,
  } = createEntityRepositories({
    getState: () => stateRef.current,
    commitState,
    userId: user?.uid || 'unknown-admin',
  });

  const addPayment = async (payment: { invoiceId: string; amount: number; paidAt?: string; date?: string; method: PaymentMethod; reference?: string; notes: string; operationId?: string }) => {
    if (!isAdmin) return { ok: false, errors: [{ field: 'authorization', message: 'Administrator access is required.', code: 'auth.admin.required' }] };
    const id = generateId();
    const operationId = payment.operationId || generateId();
    const paidAt = payment.paidAt || payment.date || '';
    const invoice = stateRef.current.invoices.find((entry) => entry.id === payment.invoiceId);
    if (!invoice) return { ok: false, errors: [{ field: 'invoiceId', message: 'Invoice could not be found.', code: 'payment.invoice.notFound' }] };
    const errors = validateNewPayment({ amount: payment.amount, paidAt, method: payment.method, operationId }, invoice, invoice.payments);
    if (errors.length) return { ok: false, errors: errors.map((message) => ({ field: 'payment', message, code: 'payment.invalid' })) };
    const now = new Date().toISOString();
    const entry: Payment = {
      id, invoiceId: payment.invoiceId, amount: payment.amount, paidAt, date: paidAt.slice(0, 10),
      method: payment.method, reference: payment.reference?.trim() || undefined, notes: payment.notes.trim(),
      createdAt: now, createdBy: user?.uid || 'unknown-admin', operationId, kind: 'payment',
    };
    return commitState((current) => {
      const currentInvoice = current.invoices.find((entry) => entry.id === payment.invoiceId);
      if (!currentInvoice || currentInvoice.payments.some((item) => item.operationId === operationId)) return current;
      const payments = [...currentInvoice.payments, entry];
      const updatedInvoice = recalculateInvoicePayments(currentInvoice, payments);
      return {
        ...current,
        payments: [...current.payments, entry],
        invoices: current.invoices.map((item) => item.id === payment.invoiceId ? updatedInvoice : item),
        auditLogs: current.settings.enableAuditLog ? [{
          id: generateId(), entityType: 'payment', entityId: id, action: 'recorded',
          message: 'payment recorded', createdAt: now,
          meta: { invoiceId: payment.invoiceId, reference: entry.reference, authorizedUserId: entry.createdBy },
        } as AuditLog, ...current.auditLogs].slice(0, 200) : current.auditLogs,
      };
    }, 'create', 'payment', id, [{ entityType: 'invoice', entityId: payment.invoiceId }]);
  };
  const reversePayment = async (invoiceId: string, paymentId: string, reason: string, suppliedOperationId?: string) => {
    if (!isAdmin) return { ok: false, errors: [{ field: 'authorization', message: 'Administrator access is required.', code: 'auth.admin.required' }] };
    const cleanReason = reason.trim();
    if (!cleanReason) return { ok: false, errors: [{ field: 'reason', message: 'A reversal reason is required.', code: 'payment.reversal.reason' }] };
    const operationId = suppliedOperationId || generateId();
    const id = generateId();
    const now = new Date().toISOString();
    const source = stateRef.current.invoices.find((invoice) => invoice.id === invoiceId)?.payments.find((payment) => payment.id === paymentId);
    if (!source || source.kind === 'reversal') return { ok: false, errors: [{ field: 'paymentId', message: 'The original payment could not be found.', code: 'payment.notFound' }] };
    const reversal: Payment = { ...source, id, kind: 'reversal', originalPaymentId: source.id, reason: cleanReason, notes: '', reference: source.reference, createdAt: now, paidAt: now, date: now.slice(0, 10), createdBy: user?.uid || 'unknown-admin', operationId };
    return commitState((current) => {
      const invoice = current.invoices.find((entry) => entry.id === invoiceId);
      if (!invoice || invoice.payments.some((payment) => payment.operationId === operationId || (payment.kind === 'reversal' && payment.originalPaymentId === paymentId))) return current;
      const payments = [...invoice.payments, reversal];
      return {
        ...current,
        payments: [...current.payments, reversal],
        invoices: current.invoices.map((entry) => entry.id === invoiceId ? recalculateInvoicePayments(entry, payments) : entry),
        auditLogs: current.settings.enableAuditLog ? [{ id: generateId(), entityType: 'payment', entityId: id, action: 'reversed', message: 'payment reversed', createdAt: now, meta: { invoiceId, originalPaymentId: paymentId, reason: cleanReason, authorizedUserId: reversal.createdBy } } as AuditLog, ...current.auditLogs].slice(0, 200) : current.auditLogs,
      };
    }, 'create', 'payment', id, [{ entityType: 'invoice', entityId: invoiceId }]);
  };
  const correctPayment = async (invoiceId: string, paymentId: string, replacement: { amount: number; paidAt: string; method: PaymentMethod; reference?: string; notes: string }, reason: string, suppliedOperationId?: string) => {
    if (!isAdmin) return { ok: false, errors: [{ field: 'authorization', message: 'Administrator access is required.', code: 'auth.admin.required' }] };
    const operationRoot = suppliedOperationId || generateId();
    const reversed = await reversePayment(invoiceId, paymentId, `Correction: ${reason.trim()}`, `${operationRoot}:reverse`);
    if (!reversed.ok) return reversed;
    return addPayment({ invoiceId, ...replacement, operationId: `${operationRoot}:replacement` });
  };
  const cancelInvoice = async (invoiceId: string, reason: string) => {
    if (!isAdmin) return { ok: false, errors: [{ field: 'authorization', message: 'Administrator access is required.', code: 'auth.admin.required' }] };
    const cleanReason = reason.trim();
    if (!cleanReason) return { ok: false, errors: [{ field: 'reason', message: 'A cancellation reason is required.', code: 'invoice.cancellation.reason' }] };
    const now = new Date().toISOString();
    return commitState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) => invoice.id === invoiceId ? { ...invoice, paymentStatus: 'cancelled', status: 'cancelled', updatedAt: now } : invoice),
      auditLogs: current.settings.enableAuditLog ? [{ id: generateId(), entityType: 'invoice', entityId: invoiceId, action: 'cancelled', message: 'invoice cancelled', createdAt: now, meta: { reason: cleanReason, authorizedUserId: user?.uid || 'unknown-admin' } } as AuditLog, ...current.auditLogs].slice(0, 200) : current.auditLogs,
    }), 'update', 'invoice', invoiceId);
  };
  if (!isLoaded) return <LoadingSpinner fullScreen text="Loading saved data..." />;

  return (
    <DataContext.Provider value={{
      state: {
        ...state,
        customers: state.customers.filter((entry) => !entry.deletedAt),
        invoices: state.invoices.filter((entry) => !entry.deletedAt),
        deliveryNotes: state.deliveryNotes.filter((entry) => !entry.deletedAt),
      },
      firebaseStatus, syncStatus, saveIndicator: syncStatus, lastSavedAt, syncNotice, syncDetails, retrySync,
      addCustomer, updateCustomer, deleteCustomer, addProduct, updateProduct, deleteProduct,
      addInvoice, updateInvoice, deleteInvoice, addPayment, reversePayment, correctPayment, cancelInvoice, addExpense, deleteExpense,
      addDeliveryNote, updateDeliveryNote, deleteDeliveryNote, updateProfile, updateSettings, addAuditLog,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
