import type { AppSettings, AppState, AuditLog, BusinessProfile, Customer, DeliveryNote, Expense, Invoice, PaymentMethod, Product } from '../lib/types';
import type { FirebaseStatus } from '../lib/firebase';
import type { ValidationIssue } from '../lib/entitySchemas';

export type SyncStatus = 'loading' | 'unsaved' | 'saving' | 'local' | 'online' | 'offline' | 'failed' | 'action-required';
export type MutationResult = { ok: boolean; id?: string; errors?: ValidationIssue[]; errorReference?: string };
export type SyncDetails = { internet: boolean; signedIn: boolean; cloudAvailable: boolean; pendingChanges: number; pendingSince: string | null; lastAttemptAt: string | null; lastSyncResult: 'success' | 'retry-scheduled' | 'action-required' | 'failed' | null; lastSyncErrorCategory: string | null; errorReference: string | null };

export interface DataContextType {
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
