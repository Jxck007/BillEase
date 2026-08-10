import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppState, Invoice, Payment } from '../src/lib/types';
import { getDefaultSettings } from '../src/services/invoiceService';
import { buildNormalizedMigrationPlan, assembleAppState, compareIntegrity, prepareAggregateStateForMigration, summarizeIntegrity } from '../src/services/normalizedFirestoreModel';
import { sanitizeForFirestore } from '../src/services/firestoreSerialization';
import { createAggregateBackup, verifyAggregateBackup } from '../scripts/lib/migrationBackup';

function fictionalState(): AppState {
  const profile = { name: 'Fictional Works', address: 'Test Street', phone: '0000000000', email: 'test@example.invalid', gst: '33AAAAA0000A1Z0', stateCode: '33', logo: '' };
  const payment: Payment = { id: 'pay-1', invoiceId: 'inv-1', amount: 400, paidAt: '2026-08-01', method: 'cash', notes: '', createdAt: '2026-08-01T00:00:00.000Z', createdBy: 'test-admin', operationId: 'op-pay-1', kind: 'payment' };
  const baseInvoice = { invoiceNumber: 'TEST-1', customerId: 'customer-1', date: '2026-08-01', items: [], subtotal: 1000, taxableAmount: 1000, taxTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, discountTotal: 0, total: 1000, amountPaid: 400, balanceDue: 600, paymentStatus: 'partially_paid', status: 'partial', payments: [payment], notes: '', terms: '', createdAt: '2026-08-01T00:00:00.000Z' };
  return {
    customers: [{ id: 'customer-1', name: 'Fictional Customer', phone: '', email: '', address: '', createdAt: '2026-08-01T00:00:00.000Z' }],
    products: [],
    invoices: [
      { ...baseInvoice, id: 'inv-1', type: 'invoice' } as Invoice,
      { ...baseInvoice, id: 'quote-1', invoiceNumber: 'QUOTE-1', type: 'estimate', payments: [], amountPaid: 0, balanceDue: 1000 } as Invoice,
    ],
    payments: [payment],
    expenses: [],
    deliveryNotes: [],
    auditLogs: [],
    profile,
    settings: getDefaultSettings(profile),
  };
}

test('backup checksum detects any mutation', () => {
  const state = fictionalState();
  const backup = createAggregateBackup('fictional-project', { data: state, revision: 7, updatedAt: null, clientOperationId: 'source-op', sourceDeviceId: 'device-a' }, '2026-08-10T00:00:00.000Z');
  assert.doesNotThrow(() => verifyAggregateBackup(backup));
  const corrupted = structuredClone(backup);
  corrupted.envelope.data.invoices[0].total = 999;
  assert.throws(() => verifyAggregateBackup(corrupted), /BACKUP_CHECKSUM_MISMATCH/);
});

test('aggregate split and normalized reassembly are lossless', () => {
  const state = fictionalState();
  const plan = buildNormalizedMigrationPlan({ state, aggregateRevision: 7, aggregateOperationId: 'source-op', aggregateSourceDeviceId: 'device-a', sourceChecksum: 'checksum' });
  assert.equal(plan.collections.invoices.length, 1);
  assert.equal(plan.collections.quotations.length, 1);
  assert.deepEqual(assembleAppState(plan), state);
  assert.deepEqual(compareIntegrity(state, assembleAppState(plan)).differences, []);
});

test('financial and customer snapshot comparisons reject drift', () => {
  const state = fictionalState();
  const changed = structuredClone(state);
  changed.invoices[0].balanceDue = 599;
  const comparison = compareIntegrity(state, changed);
  assert.equal(comparison.ok, false);
  assert.ok(comparison.differences.includes('outstandingPaise'));
  assert.ok(comparison.differences.includes('stateHash'));
});

test('duplicate payment operation IDs block migration', () => {
  const state = fictionalState();
  state.payments.push({ ...state.payments[0], id: 'pay-2' });
  assert.throws(() => summarizeIntegrity(state), /DUPLICATE_PAYMENT_OPERATION_ID/);
});

test('duplicate entity IDs and unsafe Firestore IDs block planning', () => {
  const duplicate = fictionalState();
  duplicate.customers.push({ ...duplicate.customers[0] });
  assert.throws(() => buildNormalizedMigrationPlan({ state: duplicate, aggregateRevision: 1, aggregateOperationId: 'op', aggregateSourceDeviceId: 'device', sourceChecksum: 'sum' }), /DUPLICATE_ENTITY_ID/);
  const unsafe = fictionalState();
  unsafe.customers[0].id = 'customer/escape';
  assert.throws(() => buildNormalizedMigrationPlan({ state: unsafe, aggregateRevision: 1, aggregateOperationId: 'op', aggregateSourceDeviceId: 'device', sourceChecksum: 'sum' }), /INVALID_DOCUMENT_ID/);
});

test('aggregate preparation recovers a null ledger alias from exact invoice payment history', () => {
  const state = fictionalState();
  const stored = structuredClone(state) as AppState;
  stored.payments = [null as unknown as Payment];
  const prepared = prepareAggregateStateForMigration(stored);
  assert.equal(prepared.payments.length, 1);
  assert.equal(prepared.payments[0].operationId, 'op-pay-1');
  assert.deepEqual(prepared.invoices, stored.invoices);
});

test('Firestore sanitization preserves shared objects but still blocks true cycles', () => {
  const shared = { id: 'pay-1', amount: 100 };
  assert.deepEqual(sanitizeForFirestore({ invoicePayment: shared, ledgerPayment: shared }), {
    invoicePayment: shared,
    ledgerPayment: shared,
  });
  const cyclic: Record<string, unknown> = { id: 'cycle' };
  cyclic.self = cyclic;
  assert.deepEqual(sanitizeForFirestore(cyclic), { id: 'cycle', self: null });
});
