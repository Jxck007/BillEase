import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AppState, AuditLog, AppSettings, BusinessProfile, Customer, Expense, Invoice, Payment, Product, DeliveryNote } from '../lib/types';
import { generateId, safeParseJson } from '../lib/utils';
import { buildAuditLog, getDefaultSettings } from '../services/invoiceService';
import { firebaseEnabled, setAppDataBackup, getAppDataBackup, deleteAppDataBackup, useFirestoreSync, getFirebaseStatus, FirebaseStatus } from '../lib/firebase';
import { normalizeCustomerRecord, normalizeDeliveryNote } from '../lib/deliveryNoteUtils';

interface DataContextType {
  state: AppState;
  firebaseStatus: FirebaseStatus;
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
  uploadBackup: () => Promise<void>;
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
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus>(() => getFirebaseStatus());

  useEffect(() => {
    if (firebaseStatus.enabled && firebaseStatus.configured) {
      const verifyConnection = async () => {
        try {
          // Attempt Firestore read check
          await getAppDataBackup();
          
          setFirebaseStatus(current => ({
            ...current,
            appConnected: true,
            firestoreConnected: true,
            localMode: false
          }));
        } catch (err) {
          console.warn('[Firebase Connection Check Failed] Falling back to local mode:', err);
          setFirebaseStatus(current => ({
            ...current,
            appConnected: false,
            firestoreConnected: false,
            localMode: true
          }));
        }
      };
      verifyConnection();
    }
  }, []);

  useEffect(() => {
    const saved = safeParseJson<Partial<AppState>>(localStorage.getItem('appData'), {});
    if (saved && Object.keys(saved).length > 0) {
      const profile = saved.profile || defaultProfile;
      setState({
        ...initialState,
        ...saved,
        customers: (saved.customers || []).map((customer) => normalizeCustomerRecord(customer)),
        deliveryNotes: (saved.deliveryNotes || []).map((note) => normalizeDeliveryNote(note as Partial<DeliveryNote> & Record<string, unknown>)),
        profile,
        settings: { ...getDefaultSettings(profile), ...(saved.settings || {}) },
        auditLogs: saved.auditLogs || [],
      } as AppState);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('appData', JSON.stringify(state));
    }
  }, [state, isLoaded]);

  // Auto-sync to Firestore if enabled
  useFirestoreSync(state, isLoaded);

  // Local / cloud helpers
  const clearLocalData = () => {
    localStorage.removeItem('appData');
    localStorage.removeItem('billease.invoiceDraft');
    setState(initialState);
  };

  const uploadBackup = async () => {
    if (!firebaseEnabled()) throw new Error('Firebase not enabled');
    try {
      await setAppDataBackup(state);
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
        const profile = remote.profile || defaultProfile;
        setState({
          ...initialState,
          ...remote,
          customers: (remote.customers || []).map((customer: Customer) => normalizeCustomerRecord(customer)),
          deliveryNotes: (remote.deliveryNotes || []).map((note: DeliveryNote) => normalizeDeliveryNote(note as Partial<DeliveryNote> & Record<string, unknown>)),
          profile,
          settings: { ...getDefaultSettings(profile), ...(remote.settings || {}) },
          auditLogs: remote.auditLogs || [],
        } as AppState);
        // persist locally
        localStorage.setItem('appData', JSON.stringify(remote));
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

  if (!isLoaded) return null; // or a loading spinner

  return (
    <DataContext.Provider value={{
      state,
      firebaseStatus,
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
