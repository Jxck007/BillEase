import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { AppState, AuditLog, AppSettings, BusinessProfile, Customer, Expense, Invoice, Payment, Product, DeliveryNote } from '../lib/types';
import { generateId } from '../lib/utils';
import { buildAuditLog, getDefaultSettings } from '../services/invoiceService';
import { firebaseEnabled, setAppDataBackup, getAppDataBackup, deleteAppDataBackup, useFirestoreSync, getFirebaseStatus, FirebaseStatus, db, getRecordTotal } from '../lib/firebase';
import { normalizeCustomerRecord, normalizeDeliveryNote } from '../lib/deliveryNoteUtils';
import { useAuth } from './AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export type SyncStatus = 'loading' | 'online' | 'syncing' | 'offline' | 'failed';
type SaveIndicator = 'saving' | 'saved' | 'offline' | 'failed';
const BACKUP_EXPORTED_AT_KEY = 'billease.lastBackupExportAt';

interface DataContextType {
  state: AppState;
  firebaseStatus: FirebaseStatus;
  syncStatus: SyncStatus;
  saveIndicator: SaveIndicator;
  lastSavedAt: string | null;
  lastBackupExportAt: string | null;
  backupReminderNeeded: boolean;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;
  updateProfile: (profile: BusinessProfile) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'createdAt'>) => void;
  // Delivery Notes
  addDeliveryNote: (note: Omit<DeliveryNote, 'id' | 'createdAt'>) => void;
  updateDeliveryNote: (id: string, note: Partial<DeliveryNote>) => void;
  deleteDeliveryNote: (id: string) => void;
  // Local / cloud helpers
  clearLocalData: () => void;
  exportBackupJson: () => void;
  importBackupJson: (file: File) => Promise<void>;
  uploadBackup: (force?: boolean) => Promise<void>;
  downloadBackup: () => Promise<void>;
  deleteCloudBackup: () => Promise<void>;
}

const defaultProfile: BusinessProfile = {
  name: 'My Business',
  address: '',
  phone: '',
  email: '',
  gst: '',
  stateCode: '33',
  logo: '',
  qrCodeImage: ''
};

const initialState: AppState = {
  customers: [],
  products: [],
  invoices: [],
  payments: [],
  expenses: [],
  deliveryNotes: [],
  auditLogs: [],
  profile: defaultProfile,
  settings: getDefaultSettings(defaultProfile)
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [firebaseStatus] = useState<FirebaseStatus>(() => getFirebaseStatus());
  const { user } = useAuth();
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>('saving');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastBackupExportAt, setLastBackupExportAt] = useState<string | null>(() => localStorage.getItem(BACKUP_EXPORTED_AT_KEY));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const hydrateState = (remote: any) => {
    const profile = remote.profile || defaultProfile;
    return {
      ...initialState,
      ...remote,
      customers: (remote.customers || []).map((customer: Customer) => normalizeCustomerRecord(customer)),
      products: remote.products || [],
      invoices: remote.invoices || [],
      payments: remote.payments || [],
      expenses: remote.expenses || [],
      deliveryNotes: (remote.deliveryNotes || []).map((note: DeliveryNote) => normalizeDeliveryNote(note as Partial<DeliveryNote> & Record<string, unknown>)),
      profile,
      settings: { ...getDefaultSettings(profile), ...(remote.settings || {}) },
      auditLogs: remote.auditLogs || [],
    } as AppState;
  };

  const recordBackupExport = () => {
    const now = new Date().toISOString();
    localStorage.setItem(BACKUP_EXPORTED_AT_KEY, now);
    setLastBackupExportAt(now);
  };

  const backupReminderNeeded = !lastBackupExportAt || (Date.now() - new Date(lastBackupExportAt).getTime()) > 7 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    const initData = async () => {
      if (!user) {
        setSyncStatus('offline');
        setSaveIndicator('offline');
        setIsLoaded(true);
        // Try loading from local cache
        try {
          const cached = localStorage.getItem('appData');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.customers) {
              setState(hydrateState(parsed));
              setLastSavedAt(new Date().toISOString());
            }
          }
        } catch {}
        return;
      }

      setSyncStatus('loading');
      try {
        const remote = await getAppDataBackup();

        if (remote) {
          setState(hydrateState(remote));
          setCloudSyncEnabled(true);
          setSyncStatus('online');
          setSaveIndicator('saved');
          setLastSavedAt(new Date().toISOString());
        } else {
          // Cloud empty: Create fresh default structure
          setState(initialState);
          setCloudSyncEnabled(true);
          setSyncStatus('online');
          setSaveIndicator('saved');
        }
      } catch (err) {
        console.error('Failed to read cloud data on startup:', err);
        setCloudSyncEnabled(false);
        setSyncStatus('offline');
        setSaveIndicator('offline');
        // Try loading from local cache
        try {
          const cached = localStorage.getItem('appData');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.customers) {
              setState(hydrateState(parsed));
              setLastSavedAt(new Date().toISOString());
            }
          }
        } catch {}
      }
      setIsLoaded(true);
    };

    initData();
  }, [user]);

  // Real-time multi-user sync
  useEffect(() => {
    if (!cloudSyncEnabled || !user || !db) return;

    const d = doc(db as any, 'billease', 'appData');
    const unsubscribe = onSnapshot(d, (snapshot) => {
      // Ignore local writes to prevent infinite loops
      if (snapshot.metadata.hasPendingWrites) return;

      setSyncStatus('syncing');
      if (snapshot.exists()) {
        const payload = snapshot.data();
        const remote = payload?.data;
        if (remote) {
          setState(hydrateState(remote));
          setSyncStatus('online');
          setSaveIndicator('saved');
          setLastSavedAt(payload?.updatedAt || new Date().toISOString());
        }
      } else {
        setSyncStatus('online');
        setSaveIndicator('saved');
      }
    }, (error) => {
      console.error('[FIRESTORE SYNC] Real-time listener error:', error);
      setSyncStatus('failed');
      setSaveIndicator('failed');
    });

    return () => unsubscribe();
  }, [cloudSyncEnabled, user]);

  // Debounced localStorage write to avoid excessive serialization
  useEffect(() => {
    if (!isLoaded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveIndicator(cloudSyncEnabled ? 'saving' : 'offline');
    if (cloudSyncEnabled) {
      setSyncStatus((current) => (current === 'loading' ? current : 'syncing'));
    }
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem('appData', JSON.stringify(state));
        setLastSavedAt(new Date().toISOString());
        if (!cloudSyncEnabled) setSaveIndicator('offline');
      } catch (error) {
        console.error('localStorage save failed', error);
        setSaveIndicator('failed');
      }
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [state, isLoaded]);

  // Auto-sync to Firestore if enabled (with empty-data safety guard)
  useFirestoreSync(state, cloudSyncEnabled, {
    customers: state.customers.length,
    products: state.products.length,
    invoices: state.invoices.length,
    deliveryNotes: state.deliveryNotes.length,
  }, {
    onSuccess: () => {
      setSyncStatus('online');
      setSaveIndicator('saved');
      setLastSavedAt(new Date().toISOString());
    },
    onError: () => {
      setSyncStatus('failed');
      setSaveIndicator('failed');
    },
  });

  // Local / cloud helpers
  const clearLocalData = () => {
    localStorage.removeItem('appData');
    localStorage.removeItem('billease.invoiceDraft');
    setState(initialState);
  };

  const exportBackupJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `billease_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    recordBackupExport();
  };

  const importBackupJson = async (file: File) => {
    const text = await file.text();
    const importedState = JSON.parse(text);
    if (!importedState || typeof importedState !== 'object') {
      throw new Error('INVALID_BACKUP');
    }
    const counts = {
      customers: Array.isArray(importedState.customers) ? importedState.customers.length : 0,
      products: Array.isArray(importedState.products) ? importedState.products.length : 0,
      invoices: Array.isArray(importedState.invoices) ? importedState.invoices.length : 0,
      deliveryNotes: Array.isArray(importedState.deliveryNotes) ? importedState.deliveryNotes.length : 0,
    };
    if (getRecordTotal(counts) === 0 && !importedState.profile && !importedState.settings) {
      throw new Error('INVALID_BACKUP');
    }
    const hydrated = hydrateState(importedState);
    setState(hydrated);
    localStorage.setItem('appData', JSON.stringify(hydrated));
    setLastSavedAt(new Date().toISOString());
  };

  const uploadBackup = async (force = false) => {
    if (!firebaseEnabled()) throw new Error('Firebase not enabled');
    try {
      await setAppDataBackup(state, { force });
      setSyncStatus('online');
      setSaveIndicator('saved');
      setLastSavedAt(new Date().toISOString());
    } catch (err) {
      console.error('uploadBackup failed', err);
      throw err;
    }
  };

  const downloadBackup = async () => {
    if (!firebaseEnabled()) throw new Error('Firebase not enabled');
    try {
      const remote = await getAppDataBackup();
      if (remote && Object.keys(remote).length > 0) {
        const hydrated = hydrateState(remote);
        setState(hydrateState(remote));
        // persist locally
        localStorage.setItem('appData', JSON.stringify(hydrated));
        setLastSavedAt(new Date().toISOString());
        setSaveIndicator('saved');
        setSyncStatus('online');
      }
    } catch (err) {
      console.error('downloadBackup failed', err);
      throw err;
    }
  };

  const deleteCloudBackup = async () => {
    if (!firebaseEnabled()) throw new Error('Firebase not enabled');
    try {
      await deleteAppDataBackup();
    } catch (err) {
      console.error('deleteCloudBackup failed', err);
      throw err;
    }
  };

  const addAuditLog = (log: Omit<AuditLog, 'id' | 'createdAt'>) => {
    if (!state.settings.enableAuditLog) return;
    setState(s => ({
      ...s,
      auditLogs: [{ ...log, id: generateId(), createdAt: new Date().toISOString() }, ...s.auditLogs].slice(0, 200),
    }));
  };

  const updateSettings = (settings: Partial<AppSettings>) => {
    setState(s => ({
      ...s,
      settings: {
        ...s.settings,
        ...settings,
        template: {
          ...s.settings.template,
          ...(settings.template || {}),
          visibility: {
            ...s.settings.template.visibility,
            ...(settings.template?.visibility || {}),
          },
        },
      },
    }));
    addAuditLog(buildAuditLog('settings', 'app', 'updated', 'Settings updated'));
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const normalizedCustomer = normalizeCustomerRecord({
      ...(customer as Customer),
      id: '',
      createdAt: '',
      gstin: customer.gstin || customer.gstNumber || '',
      gstNumber: customer.gstNumber || customer.gstin || '',
    });
    setState(s => ({
      ...s,
      customers: [...s.customers, { ...normalizedCustomer, id: generateId(), createdAt: new Date().toISOString() }]
    }));
    addAuditLog(buildAuditLog('customer', 'new', 'created', `Created customer ${customer.name}`));
  };

  const updateCustomer = (id: string, customer: Partial<Customer>) => {
    setState(s => ({
      ...s,
      customers: s.customers.map(c => c.id === id ? normalizeCustomerRecord({ ...c, ...customer, gstin: customer.gstin || customer.gstNumber || c.gstin, gstNumber: customer.gstNumber || customer.gstin || c.gstNumber } as Customer) : c)
    }));
  };

  const deleteCustomer = (id: string) => {
    setState(s => ({
      ...s,
      customers: s.customers.filter(c => c.id !== id)
    }));
    addAuditLog(buildAuditLog('customer', id, 'deleted', `Deleted customer ${id}`));
  };

  const addProduct = (product: Omit<Product, 'id' | 'createdAt'>) => {
    setState(s => ({
      ...s,
      products: [...s.products, { ...product, id: generateId(), createdAt: new Date().toISOString() }]
    }));
    addAuditLog(buildAuditLog('product', 'new', 'created', `Created product ${product.name}`));
  };

  const updateProduct = (id: string, product: Partial<Product>) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, ...product } : p)
    }));
  };

  const deleteProduct = (id: string) => {
    setState(s => ({
      ...s,
      products: s.products.filter(p => p.id !== id)
    }));
    addAuditLog(buildAuditLog('product', id, 'deleted', `Deleted product ${id}`));
  };

  const addInvoice = (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    setState(s => ({
      ...s,
      invoices: [...s.invoices, { ...invoice, id: generateId(), createdAt: new Date().toISOString() }]
    }));
    addAuditLog(buildAuditLog('invoice', 'new', 'created', `Created invoice ${invoice.invoiceNumber}`));
  };

  const updateInvoice = (id: string, invoice: Partial<Invoice>) => {
    setState(s => ({
      ...s,
      invoices: s.invoices.map(i => i.id === id ? { ...i, ...invoice } : i)
    }));
    addAuditLog(buildAuditLog('invoice', id, 'updated', `Updated invoice ${id}`));
  };

  const deleteInvoice = (id: string) => {
    setState(s => ({
      ...s,
      invoices: s.invoices.filter(i => i.id !== id)
    }));
    addAuditLog(buildAuditLog('invoice', id, 'deleted', `Deleted invoice ${id}`));
  };

  const addPayment = (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    // Also update invoice status
    setState(s => {
      const newPayment = { ...payment, id: generateId(), createdAt: new Date().toISOString() };
      const invoice = s.invoices.find(i => i.id === payment.invoiceId);
      let updatedInvoices = s.invoices;
      
      if (invoice) {
        const newAmountPaid = invoice.amountPaid + payment.amount;
        let newStatus = invoice.status;
        if (newAmountPaid >= invoice.total) newStatus = 'paid';
        else if (newAmountPaid > 0) newStatus = 'partial';
        
        updatedInvoices = s.invoices.map(i => 
          i.id === payment.invoiceId 
            ? { ...i, amountPaid: newAmountPaid, status: newStatus } 
            : i
        );
      }

      return {
        ...s,
        payments: [...s.payments, newPayment],
        invoices: updatedInvoices
      };
    });
    addAuditLog(buildAuditLog('payment', payment.invoiceId, 'created', `Payment recorded for invoice ${payment.invoiceId}`));
  };

  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    setState(s => ({
      ...s,
      expenses: [...s.expenses, { ...expense, id: generateId(), createdAt: new Date().toISOString() }]
    }));
    addAuditLog(buildAuditLog('expense', 'new', 'created', `Expense recorded: ${expense.category}`));
  };

  const deleteExpense = (id: string) => {
    setState(s => ({
      ...s,
      expenses: s.expenses.filter(e => e.id !== id)
    }));
    addAuditLog(buildAuditLog('expense', id, 'deleted', `Deleted expense ${id}`));
  };

  const updateProfile = (profile: BusinessProfile) => {
    setState(s => ({
      ...s,
      profile,
      settings: {
        ...s.settings,
        businessStateCode: profile.stateCode || s.settings.businessStateCode,
      }
    }));
    addAuditLog(buildAuditLog('profile', 'business', 'updated', 'Business profile updated'));
  };

  const addDeliveryNote = (note: Omit<DeliveryNote, 'id' | 'createdAt'>) => {
    const normalizedNote = normalizeDeliveryNote({
      ...note,
      id: '',
      createdAt: '',
      dnNumber: note.dnNumber || note.deliveryNoteNumber,
      deliveryNoteNumber: note.deliveryNoteNumber,
      transportPurpose: note.transportPurpose || '',
      vehicleNumber: note.vehicleNumber || '',
      approximateValue: note.approximateValue || 0,
    } as Partial<DeliveryNote> & Record<string, unknown>);
    setState(s => ({
      ...s,
      deliveryNotes: [...s.deliveryNotes, { ...normalizedNote, id: generateId(), createdAt: new Date().toISOString() }]
    }));
    addAuditLog(buildAuditLog('deliveryNote', 'new', 'created', `Created delivery note ${note.deliveryNoteNumber}`));
  };

  const updateDeliveryNote = (id: string, note: Partial<DeliveryNote>) => {
    setState(s => ({
      ...s,
      deliveryNotes: s.deliveryNotes.map(dn => dn.id === id ? normalizeDeliveryNote({ ...dn, ...note } as Partial<DeliveryNote> & Record<string, unknown>) : dn)
    }));
    addAuditLog(buildAuditLog('deliveryNote', id, 'updated', `Updated delivery note ${id}`));
  };

  const deleteDeliveryNote = (id: string) => {
    setState(s => ({
      ...s,
      deliveryNotes: s.deliveryNotes.filter(dn => dn.id !== id)
    }));
    addAuditLog(buildAuditLog('deliveryNote', id, 'deleted', `Deleted delivery note ${id}`));
  };

  if (!isLoaded) {
    return <LoadingSpinner fullScreen text="Syncing data..." />;
  }

  return (
    <DataContext.Provider value={{
      state,
      firebaseStatus,
      syncStatus,
      saveIndicator,
      lastSavedAt,
      lastBackupExportAt,
      backupReminderNeeded,
      addCustomer, updateCustomer, deleteCustomer,
      addProduct, updateProduct, deleteProduct,
      addInvoice, updateInvoice, deleteInvoice,
      addPayment, addExpense, deleteExpense,
      addDeliveryNote, updateDeliveryNote, deleteDeliveryNote,
      updateProfile,
      updateSettings,
      addAuditLog,
      // helpers
      clearLocalData,
      exportBackupJson,
      importBackupJson,
      uploadBackup,
      downloadBackup,
      deleteCloudBackup
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
