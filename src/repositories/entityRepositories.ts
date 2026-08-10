import type { MutationResult } from '../context/dataContextTypes';
import { normalizeDeliveryNote } from '../lib/deliveryNoteUtils';
import { customerSnapshot, normalizeCustomer, normalizeInvoice, validateDeliveryNote } from '../lib/entitySchemas';
import type { AppSettings, AppState, AuditLog, BusinessProfile, Customer, DeliveryNote, Expense, Invoice, Product } from '../lib/types';
import { generateId } from '../lib/utils';
import { invalidateDocumentPdf } from '../services/documentPdfCache';
import type { PendingEntityRef } from '../services/localDataStore';

type CommitState = (
  mutate: (current: AppState) => AppState,
  operation?: 'create' | 'update' | 'delete',
  entityType?: string,
  entityId?: string,
  relatedEntities?: PendingEntityRef[],
) => Promise<MutationResult>;

type RepositoryDependencies = {
  getState: () => AppState;
  commitState: CommitState;
  userId: string;
};

export function createEntityRepositories({ getState, commitState, userId }: RepositoryDependencies) {
  const addAuditLog = async (log: Omit<AuditLog, 'id' | 'createdAt'>) => {
    if (!getState().settings.enableAuditLog) return { ok: true };
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
    const existing = getState().customers.find((entry) => entry.id === id);
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
    const selected = getState().customers.find((entry) => entry.id === invoice.customerId);
    const normalized = normalizeInvoice({ ...invoice, id, customerSnapshot: invoice.customerSnapshot || (selected ? customerSnapshot(selected) : undefined), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    if (normalized.errors.length) return { ok: false, id, errors: normalized.errors };
    return commitState((current) => ({ ...current, invoices: [...current.invoices, normalized.value as Invoice] }), 'create', invoice.type === 'estimate' ? 'quotation' : 'invoice', id);
  };
  const updateInvoice = async (id: string, patch: Partial<Invoice>) => {
    const existing = getState().invoices.find((entry) => entry.id === id);
    if (!existing) return { ok: false, errors: [{ field: 'id', message: 'Document could not be found.', code: 'invoice.notFound' }] };
    const selected = getState().customers.find((entry) => entry.id === (patch.customerId || existing.customerId));
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
        meta: { dueDate: patch.dueDate || '', authorizedUserId: userId },
      } as AuditLog, ...current.auditLogs].slice(0, 200) : current.auditLogs,
    }), 'update', existing.type === 'estimate' ? 'quotation' : 'invoice', id);
  };
  const deleteInvoice = async (id: string) => commitState((current) => ({ ...current, invoices: current.invoices.map((entry) => entry.id === id ? { ...entry, deletedAt: new Date().toISOString() } : entry) }), 'delete', 'invoice', id);

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
    const selected = getState().customers.find((entry) => entry.id === note.customerId);
    const candidate = normalizeDeliveryNote({ ...note, id, customerSnapshot: note.customerSnapshot || (selected ? customerSnapshot(selected) : undefined), createdAt: new Date().toISOString() } as Partial<DeliveryNote> & Record<string, unknown>);
    const validation = validateDeliveryNote(candidate);
    if (validation.errors.length) return { ok: false, id, errors: validation.errors };
    return commitState((current) => ({ ...current, deliveryNotes: [...current.deliveryNotes, candidate] }), 'create', 'deliveryNote', id);
  };
  const updateDeliveryNote = async (id: string, note: Partial<DeliveryNote>) => {
    const existing = getState().deliveryNotes.find((entry) => entry.id === id);
    if (!existing) return { ok: false, errors: [{ field: 'id', message: 'Delivery note could not be found.', code: 'deliveryNote.notFound' }] };
    const selected = getState().customers.find((entry) => entry.id === (note.customerId || existing.customerId));
    const candidate = normalizeDeliveryNote({ ...existing, ...note, id, customerSnapshot: note.customerSnapshot || existing.customerSnapshot || (selected ? customerSnapshot(selected) : undefined), updatedAt: new Date().toISOString() } as Partial<DeliveryNote> & Record<string, unknown>);
    const validation = validateDeliveryNote(candidate);
    if (validation.errors.length) return { ok: false, id, errors: validation.errors };
    invalidateDocumentPdf('delivery-note', id);
    return commitState((current) => ({ ...current, deliveryNotes: current.deliveryNotes.map((entry) => entry.id === id ? candidate : entry) }), 'update', 'deliveryNote', id);
  };
  const deleteDeliveryNote = async (id: string) => commitState((current) => ({ ...current, deliveryNotes: current.deliveryNotes.map((entry) => entry.id === id ? { ...entry, deletedAt: new Date().toISOString() } : entry) }), 'delete', 'deliveryNote', id);

  return {
    addAuditLog,
    addCustomer, updateCustomer, deleteCustomer,
    addProduct, updateProduct, deleteProduct,
    addInvoice, updateInvoice, deleteInvoice,
    addExpense, deleteExpense, updateProfile, updateSettings,
    addDeliveryNote, updateDeliveryNote, deleteDeliveryNote,
  };
}
