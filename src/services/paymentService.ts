import type { AppState, Invoice, Payment, PaymentMethod, PaymentStatus } from '../lib/types';

const VALID_METHODS = new Set<PaymentMethod>(['cash', 'UPI', 'bank_transfer', 'cheque', 'card', 'other']);
const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/;

export function toPaise(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function fromPaise(value: number): number {
  return value / 100;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function paymentEffectPaise(payment: Payment): number {
  const amount = Math.max(0, toPaise(payment.amount));
  return payment.kind === 'reversal' ? -amount : amount;
}

export function summarizePayments(invoiceTotal: number, payments: Payment[]) {
  const amountPaidPaise = Math.max(0, payments.reduce((sum, payment) => sum + paymentEffectPaise(payment), 0));
  const totalPaise = Math.max(0, toPaise(invoiceTotal));
  return {
    amountPaid: fromPaise(amountPaidPaise),
    balanceDue: fromPaise(Math.max(totalPaise - amountPaidPaise, 0)),
  };
}

function validDueDate(dueDate?: string) {
  return Boolean(dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !Number.isNaN(new Date(`${dueDate}T23:59:59`).getTime()));
}

export function derivePaymentStatus(
  invoiceTotal: number,
  amountPaid: number,
  dueDate?: string,
  cancelled = false,
  now = new Date(),
): PaymentStatus {
  if (cancelled) return 'cancelled';
  const paidPaise = toPaise(amountPaid);
  const totalPaise = Math.max(0, toPaise(invoiceTotal));
  if (totalPaise === 0 || paidPaise >= totalPaise) return 'paid';
  if (validDueDate(dueDate) && new Date(`${dueDate}T23:59:59`).getTime() < now.getTime()) return 'overdue';
  if (paidPaise > 0) return 'partially_paid';
  return 'unpaid';
}

export function legacyStatus(status: PaymentStatus): Invoice['status'] {
  return status === 'partially_paid' ? 'partial' : status;
}

export function recalculateInvoicePayments(invoice: Invoice, payments = invoice.payments || [], now = new Date()): Invoice {
  const summary = summarizePayments(invoice.total, payments);
  const cancelled = invoice.paymentStatus === 'cancelled' || invoice.status === 'cancelled';
  const paymentStatus = derivePaymentStatus(invoice.total, summary.amountPaid, invoice.dueDate, cancelled, now);
  const lastPaymentAt = [...payments]
    .filter((payment) => payment.kind !== 'reversal')
    .map((payment) => payment.paidAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    ...invoice,
    payments,
    amountPaid: summary.amountPaid,
    balanceDue: summary.balanceDue,
    paymentStatus,
    status: legacyStatus(paymentStatus),
    lastPaymentAt,
  };
}

export function normalizePayment(input: Partial<Payment> & Record<string, unknown>, invoiceId = ''): Payment | null {
  const amount = Number(input.amount);
  const paidAt = String(input.paidAt || input.date || '');
  const methodAliases: Record<string, PaymentMethod> = {
    Cash: 'cash', cash: 'cash', UPI: 'UPI', Card: 'card', card: 'card',
    Bank: 'bank_transfer', 'Bank Transfer': 'bank_transfer', bank_transfer: 'bank_transfer',
    Cheque: 'cheque', cheque: 'cheque', Other: 'other', other: 'other', Wallet: 'other',
  };
  const method = methodAliases[String(input.method || '')];
  if (!String(input.id || '') || amount <= 0 || !isValidIsoDate(paidAt) || !VALID_METHODS.has(method)) return null;
  return {
    ...input,
    id: String(input.id),
    invoiceId: String(input.invoiceId || invoiceId),
    amount: fromPaise(toPaise(amount)),
    paidAt,
    date: paidAt.slice(0, 10),
    method,
    reference: String(input.reference || '').trim() || undefined,
    notes: String(input.notes || '').trim(),
    createdAt: String(input.createdAt || new Date().toISOString()),
    createdBy: String(input.createdBy || 'legacy'),
    operationId: String(input.operationId || `legacy:${input.id}`),
    kind: input.kind === 'reversal' ? 'reversal' : 'payment',
    originalPaymentId: String(input.originalPaymentId || '').trim() || undefined,
    reason: String(input.reason || '').trim() || undefined,
  } as Payment;
}

export type PaymentValidationInput = {
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  operationId: string;
  allowOverpayment?: boolean;
};

export function validateNewPayment(input: PaymentValidationInput, invoice: Invoice, existingPayments: Payment[]) {
  const errors: string[] = [];
  const amountPaise = toPaise(input.amount);
  const { balanceDue } = summarizePayments(invoice.total, existingPayments);
  if (amountPaise <= 0) errors.push('Payment amount must be greater than zero.');
  if (!isValidIsoDate(input.paidAt)) errors.push('Enter a valid payment date.');
  if (!VALID_METHODS.has(input.method)) errors.push('Select a valid payment method.');
  if (!input.operationId.trim()) errors.push('Payment operation ID is required.');
  if (existingPayments.some((payment) => payment.operationId === input.operationId)) errors.push('This payment was already recorded.');
  if (!input.allowOverpayment && amountPaise > toPaise(balanceDue)) errors.push('Payment cannot be greater than the outstanding balance.');
  if (invoice.paymentStatus === 'cancelled') errors.push('Payments cannot be recorded against a cancelled invoice.');
  return errors;
}

export function isValidUpiId(value?: string): boolean {
  return Boolean(value && UPI_ID.test(value.trim()));
}

export function buildUpiUri(invoice: Invoice, upiId: string, payeeName: string): string | null {
  if (!isValidUpiId(upiId) || !payeeName.trim() || invoice.balanceDue <= 0) return null;
  const uniqueReference = `BE-${invoice.id}-${toPaise(invoice.balanceDue)}`;
  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: payeeName.trim(),
    am: invoice.balanceDue.toFixed(2),
    cu: 'INR',
    tn: invoice.invoiceNumber,
    tr: uniqueReference,
  });
  return `upi://pay?${params.toString()}`;
}

export function calculateBillingMetrics(state: Pick<AppState, 'invoices'>) {
  const invoices = state.invoices.filter((invoice) => invoice.type === 'invoice');
  const collectible = invoices.filter((invoice) => invoice.paymentStatus !== 'cancelled');
  const sumPaise = (values: number[]) => fromPaise(values.reduce((sum, value) => sum + toPaise(value), 0));
  return {
    totalInvoiced: sumPaise(collectible.map((invoice) => invoice.total)),
    totalCollected: sumPaise(collectible.map((invoice) => invoice.amountPaid)),
    totalOutstanding: sumPaise(collectible.map((invoice) => invoice.balanceDue)),
    overdueAmount: sumPaise(collectible.filter((invoice) => invoice.paymentStatus === 'overdue').map((invoice) => invoice.balanceDue)),
    paidInvoicesCount: invoices.filter((invoice) => invoice.paymentStatus === 'paid').length,
    unpaidInvoicesCount: invoices.filter((invoice) => invoice.paymentStatus === 'unpaid').length,
    partiallyPaidInvoicesCount: invoices.filter((invoice) => invoice.paymentStatus === 'partially_paid').length,
    overdueInvoicesCount: invoices.filter((invoice) => invoice.paymentStatus === 'overdue').length,
    cancelledInvoicesCount: invoices.filter((invoice) => invoice.paymentStatus === 'cancelled').length,
  };
}

export interface PaymentProvider {
  createPaymentRequest(invoice: Invoice): Promise<{ reference: string; url?: string }>;
  verifyWebhook(payload: unknown, signature: string): Promise<boolean>;
  getPaymentStatus(reference: string): Promise<'pending' | 'paid' | 'failed'>;
}
