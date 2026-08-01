import { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { AppState, AuditLog, AppSettings, BusinessProfile, Customer, Expense, Invoice, Payment, PaymentMethod, Product, DeliveryNote } from '../lib/types';
import { generateId } from '../lib/utils';
import { getDefaultSettings } from '../services/invoiceService';
import { AppDataEnvelope, contentHash, db, getAppDataEnvelope, getFirebaseStatus, FirebaseStatus, useFirestoreSync } from '../lib/firebase';
import { normalizeDeliveryNote } from '../lib/deliveryNoteUtils';
import { useAuth } from './AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { invalidateDocumentPdf } from '../services/documentPdfCache';
import { customerSnapshot, normalizeCustomer, normalizeInvoice, validateDeliveryNote, ValidationIssue } from '../lib/entitySchemas';
import { loadLocalAppState, LocalAppRecord, saveLocalAppState, saveRecoverySnapshot } from '../services/localDataStore';
import { errorReference, recordDiagnostic } from '../services/diagnostics';
import { decideRemoteSnapshot, mergeRemoteWithoutLosingLocal } from '../services/persistencePolicy';
import { normalizePayment, recalculateInvoicePayments, validateNewPayment } from '../services/paymentService';
import { isMatchingServerAcknowledgement } from '../services/syncPolicy';

export type SyncStatus = 'loading' | 'unsaved' | 'saving' | 'local' | 'online' | 'offline' | 'failed' | 'action-required';
export type MutationResult = { ok: boolean; id?: string; errors?: ValidationIssue[]; errorReference?: string };
export type SyncDetails = { internet: boolean; signedIn: boolean; cloudAvailable: boolean; pendingChanges: number; pendingSince: string | null; lastAttemptAt: string | null; errorReference: string | null };

interface DataContextType {
  state: AppState;
  firebaseStatus: FirebaseStatus;
  syncStatus: SyncStatus;
  saveIndicator: SyncStatus;
  lastSavedAt: string | null;
  syncNotice: string | null;
  syncDetails: SyncDetails;
  retrySync: () => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<MutationResult>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<MutationResult>;
  deleteCustomer: (id: string) => Promise<MutationResult>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<MutationResult>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<MutationResult>;
  deleteProduct: (id: string) => Promise<MutationResult>;
  addInvoice: (invoice: Omit<Invoice, 'createdAt'>) => Promise<MutationResult>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<MutationResult>;
  deleteInvoice: (id: string) => Promise<MutationResult>;
  addPayment: (payment: { invoiceId: string; amount: number; paidAt?: string; date?: string; method: PaymentMethod; reference?: string; notes: string; operationId?: string }) => Promise<MutationResult>;
  reversePayment: (invoiceId: string, paymentId: string, reason: string, operationId?: string) => Promise<MutationResult>;
  correctPayment: (invoiceId: string, paymentId: string, replacement: { amount: number; paidAt: string; method: PaymentMethod; reference?: string; notes: string }, reason: string, operationId?: string) => Promise<MutationResult>;
  cancelInvoice: (invoiceId: string, reason: string) => Promise<MutationResult>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<MutationResult>;
  deleteExpense: (id: string) => Promise<MutationResult>;
  updateProfile: (profile: BusinessProfile) => Promise<MutationResult>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<MutationResult>;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'createdAt'>) => Promise<MutationResult>;
  addDeliveryNote: (note: Omit<DeliveryNote, 'createdAt'>) => Promise<MutationResult>;
  updateDeliveryNote: (id: string, note: Partial<DeliveryNote>) => Promise<MutationResult>;
  deleteDeliveryNote: (id: string) => Promise<MutationResult>;
}

const defaultProfile: BusinessProfile = {
  name: 'My Business', address: '', phone: '', email: '', gst: '', stateCode: '33', logo: '', qrCodeImage: '',
};

const initialState: AppState = {
  customers: [], products: [], invoices: [], payments: [], expenses: [], deliveryNotes: [], auditLogs: [],
  profile: defaultProfile, settings: getDefaultSettings(defaultProfile),
};

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function hydrateAppState(input: unknown): { value: AppState; warnings: ValidationIssue[]; errors: ValidationIssue[] } {
  const remote = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const profile = remote.profile && typeof remote.profile === 'object' ? remote.profile as BusinessProfile : defaultProfile;
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const customers = asArray(remote.customers).map((entry, index) => {
    const result = normalizeCustomer(entry);
    errors.push(...result.errors.map((item) => ({ ...item, field: `customers.${index}.${item.field}` })));
    return result.value as Customer;
  });
  const normalizedLedger = asArray(remote.payments)
    .map((entry) => normalizePayment(entry as Record<string, unknown>))
    .filter((entry): entry is Payment => Boolean(entry));
  const invoices = asArray(remote.invoices).map((entry, index) => {
    const result = normalizeInvoice(entry);
    errors.push(...result.errors.map((item) => ({ ...item, field: `invoices.${index}.${item.field}` })));
    const invoice = result.value as Invoice;
    const linkedCustomer = customers.find((customer) => customer.id === invoice.customerId);
    let linkedPayments = invoice.payments.length
      ? invoice.payments
      : normalizedLedger.filter((payment) => payment.invoiceId === invoice.id);
    const legacySource = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const legacyAmountPaid = Number(legacySource.amountPaid);
    if (!linkedPayments.length && Number.isFinite(legacyAmountPaid) && legacyAmountPaid > 0) {
      const paidAt = String(legacySource.lastPaymentAt || legacySource.updatedAt || legacySource.date || invoice.createdAt);
      linkedPayments = [{
        id: `legacy-payment-${invoice.id}`, invoiceId: invoice.id, amount: legacyAmountPaid,
        paidAt, date: paidAt.slice(0, 10), method: 'other', reference: 'Legacy balance',
        notes: '', createdAt: String(legacySource.updatedAt || invoice.createdAt), createdBy: 'legacy',
        operationId: `legacy-payment:${invoice.id}`, kind: 'payment',
      }];
      warnings.push({ field: `invoices.${index}.payments`, message: 'A legacy paid amount was preserved as an imported payment entry.', code: 'invoice.payment.legacyPreserved' });
    }
    const recalculated = recalculateInvoicePayments(invoice, linkedPayments);
    return !recalculated.customerSnapshot && linkedCustomer ? { ...recalculated, customerSnapshot: customerSnapshot(linkedCustomer) } : recalculated;
  });
  const deliveryNotes = asArray(remote.deliveryNotes).map((entry) => {
    const note = normalizeDeliveryNote(entry as Partial<DeliveryNote> & Record<string, unknown>);
    const linkedCustomer = customers.find((customer) => customer.id === note.customerId);
    return !note.customerSnapshot && linkedCustomer ? { ...note, customerSnapshot: customerSnapshot(linkedCustomer) } : note;
  });
  return {
    value: {
      ...initialState,
      ...remote,
      customers,
      products: asArray(remote.products) as Product[],
      invoices,
      payments: Array.from(new Map([...normalizedLedger, ...invoices.flatMap((invoice) => invoice.payments)].map((payment) => [payment.id, payment])).values()),
      expenses: asArray(remote.expenses) as Expense[],
      deliveryNotes,
      profile,
      settings: { ...getDefaultSettings(profile), ...((remote.settings && typeof remote.settings === 'object') ? remote.settings : {}) },
      auditLogs: asArray(remote.auditLogs) as AuditLog[],
    },
    warnings,
    errors,
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  const [isLoaded, setIsLoaded] = useState(false);
  const [firebaseStatus] = useState<FirebaseStatus>(() => getFirebaseStatus());
  const { user, isAdmin } = useAuth();
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [hasDirtyChanges, setHasDirtyChanges] = useState(false);
  const [syncBlocked, setSyncBlocked] = useState(false);
  const [syncDetails, setSyncDetails] = useState<SyncDetails>({ internet: typeof navigator === 'undefined' ? true : navigator.onLine, signedIn: Boolean(user), cloudAvailable: Boolean(db), pendingChanges: 0, pendingSince: null, lastAttemptAt: null, errorReference: null });
  const dirtyRef = useRef(false);
  const localRevision = useRef(0);
  const remoteRevision = useRef(0);
  const latestOperationId = useRef('');
  const deviceId = useRef('');
  const pendingOperation = useRef<'create' | 'update' | 'delete'>('update');
  const pendingAcknowledgement = useRef<{ operationId: string; hash: string; revision?: number } | null>(null);
  const durableWriteQueue = useRef(Promise.resolve());

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => setSyncDetails((current) => ({ ...current, signedIn: Boolean(user), cloudAvailable: Boolean(db) })), [user]);
  useEffect(() => {
    const updateOnline = () => setSyncDetails((current) => ({ ...current, internet: navigator.onLine }));
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => { window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, []);
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
      version: 1,
      data: next,
      localRevision: revision,
      remoteRevision: remoteRevision.current,
      updatedAt: new Date().toISOString(),
      dirty,
    };
    durableWriteQueue.current = durableWriteQueue.current.then(() => saveLocalAppState(record));
    await durableWriteQueue.current;
    setLastSavedAt(record.updatedAt);
    setSyncStatus(dirty ? (navigator.onLine ? 'local' : 'offline') : 'online');
  }, []);

  const commitState = useCallback(async (
    mutate: (current: AppState) => AppState,
    operation: 'create' | 'update' | 'delete' = 'update',
    entityType = 'app',
    entityId?: string,
  ): Promise<MutationResult> => {
    if (operation === 'delete' || entityType === 'payment') {
      try {
        await saveRecoverySnapshot({
          version: 1,
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
    const next = mutate(stateRef.current);
    const shouldQueueCloud = firebaseStatus.configured;
    stateRef.current = next;
    setState(next);
    localRevision.current += 1;
    pendingOperation.current = operation;
    latestOperationId.current = generateId();
    setHasDirtyChanges(shouldQueueCloud);
    dirtyRef.current = shouldQueueCloud;
    setSyncStatus('unsaved');
    setSyncDetails((current) => ({ ...current, pendingChanges: shouldQueueCloud ? 1 : 0, pendingSince: shouldQueueCloud ? (current.pendingSince || new Date().toISOString()) : null, errorReference: null }));
    try {
      await persistLocal(next, shouldQueueCloud);
      recordDiagnostic({ operation, entityType, entityId, revision: localRevision.current, status: 'saved-locally' });
      return { ok: true, id: entityId };
    } catch {
      const reference = errorReference('LOCAL');
      setSyncStatus('action-required');
      setSyncNotice(`Something went wrong while saving. Your work is still open as a draft. Error reference: ${reference}`);
      recordDiagnostic({ operation, entityType, entityId, revision: localRevision.current, status: 'failed', errorCategory: 'local-storage', errorReference: reference });
      return { ok: false, id: entityId, errorReference: reference };
    }
  }, [firebaseStatus.configured, persistLocal]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setSyncStatus('loading');
      let local: LocalAppRecord | null = null;
      let localValid = true;
      try {
        local = await loadLocalAppState();
        if (local && active) {
          const effectiveDirty = local.dirty && firebaseStatus.configured;
          const hydrated = hydrateAppState(local.data);
          stateRef.current = hydrated.value;
          setState(hydrated.value);
          localRevision.current = local.localRevision;
          remoteRevision.current = local.remoteRevision;
          setHasDirtyChanges(effectiveDirty);
          dirtyRef.current = effectiveDirty;
          setSyncDetails((current) => ({ ...current, pendingChanges: effectiveDirty ? 1 : 0, pendingSince: effectiveDirty ? local.updatedAt : null }));
          setSyncStatus(effectiveDirty ? 'local' : 'online');
          setLastSavedAt(local.updatedAt);
          if (local.dirty && !effectiveDirty) await persistLocal(hydrated.value, false, local.localRevision);
          if (hydrated.errors.length) {
            localValid = false;
            setSyncBlocked(true);
            await saveRecoverySnapshot(local, 'validation-warning');
            setSyncNotice('Some stored records need attention. The original data was preserved in recovery storage.');
          }
        }
      } catch {
        const reference = errorReference('LOAD');
        setSyncNotice(`Local recovery storage is unavailable. Keep this tab open while editing. Error reference: ${reference}`);
        recordDiagnostic({ operation: 'read', entityType: 'app', status: 'failed', errorCategory: 'local-storage', errorReference: reference });
      }
      if (user && db) {
        try {
          const envelope = await getAppDataEnvelope();
          if (envelope && active) {
            remoteRevision.current = envelope.revision;
            const hydrated = hydrateAppState(envelope.data);
            if (hydrated.errors.length) {
              if (local) await saveRecoverySnapshot({ ...local, data: hydrated.value }, 'malformed-cloud-data');
              setSyncNotice('Cloud data contains records that need attention. Nothing was deleted or overwritten.');
            } else if (!local?.dirty || !localValid) {
              stateRef.current = hydrated.value;
              setState(hydrated.value);
              dirtyRef.current = false;
              setHasDirtyChanges(false);
              setSyncBlocked(false);
              await persistLocal(hydrated.value, false, localRevision.current);
            } else {
              const merged = mergeRemoteWithoutLosingLocal(stateRef.current, hydrated.value);
              stateRef.current = merged;
              setState(merged);
              await persistLocal(merged, true, localRevision.current);
            }
          }
          setCloudSyncEnabled(true);
        } catch {
          const reference = errorReference('CLOUD');
          setSyncStatus(local ? (local.dirty ? 'offline' : 'local') : 'offline');
          setSyncNotice(`Cloud sync is unavailable. Your work remains saved on this device. Error reference: ${reference}`);
          recordDiagnostic({ operation: 'read', entityType: 'app', status: 'failed', errorCategory: 'network-or-auth', errorReference: reference });
        }
      } else {
        setCloudSyncEnabled(false);
        setSyncStatus(local ? (local.dirty ? 'offline' : 'local') : 'offline');
      }
      if (active) setIsLoaded(true);
    };
    initialize();
    return () => { active = false; };
  }, [firebaseStatus.configured, user, persistLocal]);

  useEffect(() => {
    if (!cloudSyncEnabled || !user || !db) return;
    return onSnapshot(doc(db as any, 'billease', 'appData'), async (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache || !snapshot.exists()) return;
      const payload = snapshot.data() as AppDataEnvelope;
      const incomingRevision = Number(payload.revision || 0);
      const pending = pendingAcknowledgement.current;
      if (isMatchingServerAcknowledgement({ fromCache: snapshot.metadata.fromCache, hasPendingWrites: snapshot.metadata.hasPendingWrites, operationId: payload.clientOperationId, hash: contentHash(payload.data) }, pending)) {
        pendingAcknowledgement.current = null;
        remoteRevision.current = incomingRevision;
        setHasDirtyChanges(false);
        dirtyRef.current = false;
        setSyncStatus('online');
        setSyncNotice(null);
        setSyncDetails((current) => ({ ...current, pendingChanges: 0, pendingSince: null, errorReference: null }));
        await persistLocal(stateRef.current, false);
        recordDiagnostic({ operation: 'acknowledge', entityType: 'app', revision: incomingRevision, status: 'synced' });
        return;
      }
      if (pending && payload.sourceDeviceId === deviceId.current) {
        remoteRevision.current = Math.max(remoteRevision.current, incomingRevision);
        return;
      }
      if (payload.clientOperationId === latestOperationId.current) return;
      const decision = decideRemoteSnapshot(remoteRevision.current, incomingRevision, dirtyRef.current);
      if (decision === 'ignore-stale') return;
      const hydrated = hydrateAppState(payload.data);
      if (hydrated.errors.length) {
        setSyncBlocked(true);
        setSyncStatus('action-required');
        setSyncNotice('A cloud version contains invalid records. It was not applied; your local data is safe.');
        return;
      }
      if (decision === 'merge-and-preserve') {
        const currentRecord: LocalAppRecord = {
          version: 1, data: stateRef.current, localRevision: localRevision.current,
          remoteRevision: remoteRevision.current, updatedAt: new Date().toISOString(), dirty: true,
        };
        await saveRecoverySnapshot(currentRecord, 'concurrent-cloud-version');
        const merged = mergeRemoteWithoutLosingLocal(stateRef.current, hydrated.value);
        remoteRevision.current = incomingRevision;
        stateRef.current = merged;
        setState(merged);
        await persistLocal(merged, true);
        setSyncStatus('action-required');
        setSyncNotice('Changes from another device were merged. Your local version was preserved in recovery storage; review before continuing.');
        return;
      }
      remoteRevision.current = incomingRevision;
      stateRef.current = hydrated.value;
      setState(hydrated.value);
      await persistLocal(hydrated.value, false);
    }, () => {
      const reference = errorReference('SYNC');
      setSyncStatus('failed');
      setSyncNotice(`Your document could not be synced yet. It is saved safely on this device and will retry when you choose Retry. Error reference: ${reference}`);
      setSyncDetails((current) => ({ ...current, errorReference: reference }));
      recordDiagnostic({ operation: 'listen', entityType: 'app', status: 'failed', errorCategory: 'network-or-auth', errorReference: reference });
    });
  }, [cloudSyncEnabled, user, persistLocal]);

  useFirestoreSync(state, cloudSyncEnabled && hasDirtyChanges && !syncBlocked, undefined, {
    onSuccess: () => undefined,
    onError: (error) => {
      const reference = errorReference(error.name === 'RemoteRevisionConflictError' ? 'CONFLICT' : 'SYNC');
      setSyncStatus(error.name === 'RemoteRevisionConflictError' ? 'action-required' : (navigator.onLine ? 'failed' : 'offline'));
      setSyncNotice(error.name === 'RemoteRevisionConflictError'
        ? `Another device saved a newer version. Both versions remain protected. Retry after reviewing the latest data. Error reference: ${reference}`
        : `Your document could not be synced yet. It has been saved safely on this device. Error reference: ${reference}`);
      setSyncDetails((current) => ({ ...current, errorReference: reference }));
      recordDiagnostic({ operation: 'write', entityType: 'app', revision: localRevision.current, status: 'failed', errorCategory: error.name, errorReference: reference });
    },
    getOperation: () => { const value = pendingOperation.current; pendingOperation.current = 'update'; return value; },
    getBaseRevision: () => remoteRevision.current,
    getClientOperationId: () => latestOperationId.current,
    getSourceDeviceId: () => deviceId.current,
    onWriteStarted: (operationId, hash) => {
      pendingAcknowledgement.current = { operationId, hash };
      setSyncStatus('saving');
      setSyncDetails((current) => ({ ...current, pendingChanges: 1, pendingSince: current.pendingSince || new Date().toISOString(), lastAttemptAt: new Date().toISOString(), errorReference: null }));
    },
    onRetryScheduled: () => setSyncNotice('Retry scheduled. Your work remains safe on this device.'),
    onPersisted: (envelope, hash) => {
      if (hash !== contentHash(stateRef.current)) return;
      if (pendingAcknowledgement.current?.operationId === envelope.clientOperationId) pendingAcknowledgement.current.revision = envelope.revision;
      setSyncStatus('saving');
      recordDiagnostic({ operation: 'write', entityType: 'app', revision: envelope.revision, status: 'awaiting-server-snapshot' });
    },
  });

  const retrySync = () => {
    if (!hasDirtyChanges) return;
    setSyncStatus('saving');
    setState({ ...stateRef.current });
  };

  const addAuditLog = async (log: Omit<AuditLog, 'id' | 'createdAt'>) => {
    if (!stateRef.current.settings.enableAuditLog) return { ok: true };
    return commitState((current) => ({
      ...current,
      auditLogs: [{ ...log, message: `${log.entityType} ${log.action}`, id: generateId(), createdAt: new Date().toISOString() }, ...current.auditLogs].slice(0, 200),
    }), 'update', 'audit', log.entityId);
  };

  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const id = generateId();
    const now = new Date().toISOString();
    const normalized = normalizeCustomer({ ...customer, id, createdAt: now, updatedAt: now });
    if (normalized.errors.length) return { ok: false, errors: normalized.errors };
    return commitState((current) => ({ ...current, customers: [...current.customers, normalized.value as Customer] }), 'create', 'customer', id);
  };
  const updateCustomer = async (id: string, patch: Partial<Customer>) => {
    const existing = stateRef.current.customers.find((entry) => entry.id === id);
    if (!existing) return { ok: false, errors: [{ field: 'id', message: 'Customer could not be found.', code: 'customer.notFound' }] };
    const normalized = normalizeCustomer({ ...existing, ...patch, updatedAt: new Date().toISOString() });
    if (normalized.errors.length) return { ok: false, errors: normalized.errors };
    return commitState((current) => ({ ...current, customers: current.customers.map((entry) => entry.id === id ? normalized.value as Customer : entry) }), 'update', 'customer', id);
  };
  const deleteCustomer = async (id: string) => commitState((current) => ({
    ...current, customers: current.customers.map((entry) => entry.id === id ? { ...entry, deletedAt: new Date().toISOString() } : entry),
  }), 'delete', 'customer', id);

  const addProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    const id = generateId();
    return commitState((current) => ({ ...current, products: [...current.products, { ...product, id, createdAt: new Date().toISOString() }] }), 'create', 'product', id);
  };
  const updateProduct = async (id: string, product: Partial<Product>) => commitState((current) => ({ ...current, products: current.products.map((entry) => entry.id === id ? { ...entry, ...product } : entry) }), 'update', 'product', id);
  const deleteProduct = async (id: string) => commitState((current) => ({ ...current, products: current.products.filter((entry) => entry.id !== id) }), 'delete', 'product', id);

  const addInvoice = async (invoice: Omit<Invoice, 'createdAt'>) => {
    const id = invoice.id || generateId();
    const selected = stateRef.current.customers.find((entry) => entry.id === invoice.customerId);
    const normalized = normalizeInvoice({ ...invoice, id, customerSnapshot: invoice.customerSnapshot || (selected ? customerSnapshot(selected) : undefined), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    if (normalized.errors.length) return { ok: false, id, errors: normalized.errors };
    return commitState((current) => ({ ...current, invoices: [...current.invoices, normalized.value as Invoice] }), 'create', invoice.type === 'estimate' ? 'quotation' : 'invoice', id);
  };
  const updateInvoice = async (id: string, patch: Partial<Invoice>) => {
    const existing = stateRef.current.invoices.find((entry) => entry.id === id);
    if (!existing) return { ok: false, errors: [{ field: 'id', message: 'Document could not be found.', code: 'invoice.notFound' }] };
    const selected = stateRef.current.customers.find((entry) => entry.id === (patch.customerId || existing.customerId));
    const normalized = normalizeInvoice({ ...existing, ...patch, id, customerSnapshot: patch.customerSnapshot || existing.customerSnapshot || (selected ? customerSnapshot(selected) : undefined), updatedAt: new Date().toISOString() });
    if (normalized.errors.length) return { ok: false, id, errors: normalized.errors };
    invalidateDocumentPdf('invoice', id);
    invalidateDocumentPdf('quotation', id);
    const now = new Date().toISOString();
    const dueDateChanged = Object.prototype.hasOwnProperty.call(patch, 'dueDate') && patch.dueDate !== existing.dueDate;
    return commitState((current) => ({
      ...current,
      invoices: current.invoices.map((entry) => entry.id === id ? normalized.value as Invoice : entry),
      auditLogs: dueDateChanged && current.settings.enableAuditLog ? [{
        id: generateId(), entityType: 'invoice', entityId: id, action: 'recalculated',
        message: 'invoice due date changed and status recalculated', createdAt: now,
        meta: { dueDate: patch.dueDate || '', authorizedUserId: user?.uid || 'unknown-admin' },
      } as AuditLog, ...current.auditLogs].slice(0, 200) : current.auditLogs,
    }), 'update', existing.type === 'estimate' ? 'quotation' : 'invoice', id);
  };
  const deleteInvoice = async (id: string) => commitState((current) => ({ ...current, invoices: current.invoices.map((entry) => entry.id === id ? { ...entry, deletedAt: new Date().toISOString() } : entry) }), 'delete', 'invoice', id);

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
    }, 'create', 'payment', id);
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
    }, 'create', 'payment', id);
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
  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const id = generateId();
    return commitState((current) => ({ ...current, expenses: [...current.expenses, { ...expense, id, createdAt: new Date().toISOString() }] }), 'create', 'expense', id);
  };
  const deleteExpense = async (id: string) => commitState((current) => ({ ...current, expenses: current.expenses.filter((entry) => entry.id !== id) }), 'delete', 'expense', id);
  const updateProfile = async (profile: BusinessProfile) => commitState((current) => ({ ...current, profile, settings: { ...current.settings, businessStateCode: profile.stateCode || current.settings.businessStateCode } }), 'update', 'profile', 'business');
  const updateSettings = async (settings: Partial<AppSettings>) => commitState((current) => ({
    ...current,
    settings: {
      ...current.settings, ...settings,
      template: { ...current.settings.template, ...(settings.template || {}), visibility: { ...current.settings.template.visibility, ...(settings.template?.visibility || {}) } },
    },
  }), 'update', 'settings', 'app');

  const addDeliveryNote = async (note: Omit<DeliveryNote, 'createdAt'>) => {
    const id = note.id || generateId();
    const selected = stateRef.current.customers.find((entry) => entry.id === note.customerId);
    const candidate = normalizeDeliveryNote({ ...note, id, customerSnapshot: note.customerSnapshot || (selected ? customerSnapshot(selected) : undefined), createdAt: new Date().toISOString() } as Partial<DeliveryNote> & Record<string, unknown>);
    const validation = validateDeliveryNote(candidate);
    if (validation.errors.length) return { ok: false, id, errors: validation.errors };
    return commitState((current) => ({ ...current, deliveryNotes: [...current.deliveryNotes, candidate] }), 'create', 'deliveryNote', id);
  };
  const updateDeliveryNote = async (id: string, note: Partial<DeliveryNote>) => {
    const existing = stateRef.current.deliveryNotes.find((entry) => entry.id === id);
    if (!existing) return { ok: false, errors: [{ field: 'id', message: 'Delivery note could not be found.', code: 'deliveryNote.notFound' }] };
    const selected = stateRef.current.customers.find((entry) => entry.id === (note.customerId || existing.customerId));
    const candidate = normalizeDeliveryNote({ ...existing, ...note, id, customerSnapshot: note.customerSnapshot || existing.customerSnapshot || (selected ? customerSnapshot(selected) : undefined), updatedAt: new Date().toISOString() } as Partial<DeliveryNote> & Record<string, unknown>);
    const validation = validateDeliveryNote(candidate);
    if (validation.errors.length) return { ok: false, id, errors: validation.errors };
    invalidateDocumentPdf('delivery-note', id);
    return commitState((current) => ({ ...current, deliveryNotes: current.deliveryNotes.map((entry) => entry.id === id ? candidate : entry) }), 'update', 'deliveryNote', id);
  };
  const deleteDeliveryNote = async (id: string) => commitState((current) => ({ ...current, deliveryNotes: current.deliveryNotes.map((entry) => entry.id === id ? { ...entry, deletedAt: new Date().toISOString() } : entry) }), 'delete', 'deliveryNote', id);

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
