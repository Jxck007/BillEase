import { normalizeDeliveryNote } from '../lib/deliveryNoteUtils';
import { customerSnapshot, normalizeCustomer, normalizeInvoice, type ValidationIssue } from '../lib/entitySchemas';
import type { AppState, AuditLog, BusinessProfile, Customer, DeliveryNote, Expense, Invoice, Payment, Product } from '../lib/types';
import { getDefaultSettings } from '../services/invoiceService';
import { normalizePayment, recalculateInvoicePayments } from '../services/paymentService';

const defaultProfile: BusinessProfile = {
  name: 'My Business', address: '', phone: '', email: '', gst: '', stateCode: '33', logo: '', qrCodeImage: '',
};

export const initialAppState: AppState = {
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
      ...initialAppState,
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
