import assert from 'node:assert/strict';
import test from 'node:test';
import type { Invoice, Payment } from '../src/lib/types';
import {
  buildUpiUri, calculateBillingMetrics, derivePaymentStatus, normalizePayment,
  recalculateInvoicePayments, summarizePayments, validateNewPayment,
} from '../src/services/paymentService';
import { normalizeInvoice } from '../src/lib/entitySchemas';

const invoice = (patch: Partial<Invoice> = {}) => ({
  id: 'inv-1', invoiceNumber: '002/26-27', customerId: 'customer-1', date: '2026-07-01',
  items: [{ id: 'i', productId: '', name: 'Item', description: '', quantity: 1, price: 1000, taxRate: 0, discount: 0 }],
  subtotal: 1000, taxableAmount: 1000, taxTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0,
  discountTotal: 0, total: 1000, payments: [], amountPaid: 0, balanceDue: 1000,
  paymentStatus: 'unpaid', status: 'unpaid', notes: '', terms: '', createdAt: '2026-07-01T00:00:00.000Z', type: 'invoice',
  ...patch,
} as Invoice);

const payment = (id: string, amount: number, patch: Partial<Payment> = {}) => ({
  id, invoiceId: 'inv-1', amount, paidAt: '2026-07-10', date: '2026-07-10', method: 'cash',
  reference: '', notes: '', createdAt: '2026-07-10T00:00:00.000Z', createdBy: 'admin-1',
  operationId: `op-${id}`, kind: 'payment', ...patch,
} as Payment);

test('old invoice defaults to unpaid with an empty payment history', () => {
  const result = normalizeInvoice({ ...invoice(), payments: undefined, amountPaid: undefined, balanceDue: undefined, paymentStatus: undefined, status: undefined });
  assert.equal(result.value?.paymentStatus, 'unpaid');
  assert.deepEqual(result.value?.payments, []);
  assert.equal(result.value?.balanceDue, 1000);
});

test('one and multiple partial payments use exact paise arithmetic', () => {
  assert.deepEqual(summarizePayments(1000, [payment('a', 400)]), { amountPaid: 400, balanceDue: 600 });
  assert.deepEqual(summarizePayments(0.3, [payment('a', 0.1), payment('b', 0.2)]), { amountPaid: 0.3, balanceDue: 0 });
});

test('full payment is paid', () => {
  assert.equal(recalculateInvoicePayments(invoice(), [payment('a', 400), payment('b', 600)]).paymentStatus, 'paid');
});

test('overdue requires a valid due date and outstanding balance', () => {
  const now = new Date('2026-07-30T12:00:00Z');
  assert.equal(derivePaymentStatus(1000, 0, undefined, false, now), 'unpaid');
  assert.equal(derivePaymentStatus(1000, 400, 'bad-date', false, now), 'partially_paid');
  assert.equal(derivePaymentStatus(1000, 400, '2026-07-20', false, now), 'overdue');
});

test('cancelled takes precedence over payment derivation', () => {
  assert.equal(derivePaymentStatus(1000, 1000, '2026-07-20', true), 'cancelled');
});

test('reversal keeps history and restores the balance', () => {
  const original = payment('a', 600);
  const reversal = payment('r', 600, { kind: 'reversal', originalPaymentId: 'a', reason: 'Wrong reference' });
  assert.deepEqual(summarizePayments(1000, [original, reversal]), { amountPaid: 0, balanceDue: 1000 });
});

test('duplicate operation, invalid date, zero, negative and overpayment are rejected', () => {
  const existing = [payment('a', 400)];
  assert.ok(validateNewPayment({ amount: 100, paidAt: '2026-07-20', method: 'cash', operationId: 'op-a' }, invoice(), existing).some((error) => error.includes('already')));
  assert.ok(validateNewPayment({ amount: 0, paidAt: 'bad', method: 'cash', operationId: 'x' }, invoice(), existing).length >= 2);
  assert.ok(validateNewPayment({ amount: -1, paidAt: '2026-07-20', method: 'cash', operationId: 'x' }, invoice(), existing).length);
  assert.ok(validateNewPayment({ amount: 601, paidAt: '2026-07-20', method: 'cash', operationId: 'x' }, invoice(), existing).some((error) => error.includes('outstanding')));
});

test('legacy payment values normalize without destructive migration', () => {
  const normalized = normalizePayment({ ...payment('a', 10), paidAt: undefined, date: '2026-07-10', method: 'Cash' } as any);
  assert.equal(normalized?.method, 'cash');
  assert.equal(normalized?.paidAt, '2026-07-10');
});

test('reports exclude quotations and cancelled invoices and update from local invoices', () => {
  const state = { invoices: [
    recalculateInvoicePayments(invoice(), [payment('a', 400)]),
    invoice({ id: 'quote', type: 'estimate', total: 5000, balanceDue: 5000 }),
    invoice({ id: 'cancelled', total: 2000, balanceDue: 2000, paymentStatus: 'cancelled', status: 'cancelled' }),
  ] };
  const metrics = calculateBillingMetrics(state);
  assert.equal(metrics.totalInvoiced, 1000);
  assert.equal(metrics.totalCollected, 400);
  assert.equal(metrics.totalOutstanding, 600);
  assert.equal(metrics.partiallyPaidInvoicesCount, 1);
});

test('UPI URI validates, encodes and uses current balance and a unique reference', () => {
  const uri = buildUpiUri(invoice({ balanceDue: 600 }), 'billing.shop@bank', 'A & B Traders');
  assert.ok(uri);
  const parsed = new URL(uri!);
  assert.equal(parsed.searchParams.get('am'), '600.00');
  assert.equal(parsed.searchParams.get('pn'), 'A & B Traders');
  assert.equal(parsed.searchParams.get('tn'), '002/26-27');
  assert.match(parsed.searchParams.get('tr') || '', /^BE-inv-1-/);
  assert.equal(buildUpiUri(invoice(), 'malformed', 'Shop'), null);
  assert.equal(buildUpiUri(invoice(), '', 'Shop'), null);
});

test('building a static UPI URI never mutates payment status', () => {
  const source = invoice();
  buildUpiUri(source, 'shop@bank', 'Shop');
  assert.equal(source.paymentStatus, 'unpaid');
  assert.equal(source.amountPaid, 0);
});
