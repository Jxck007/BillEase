import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppState, Invoice, Payment } from '../src/lib/types';
import { getDefaultSettings } from '../src/services/invoiceService';
import { createNormalizedOutboxOperation, deriveNormalizedMutations, restoreLegacyOutbox } from '../src/services/normalizedOutbox';
import type { DurableSyncOutbox } from '../src/services/localDataStore';

function stateFixture(): AppState {
  const profile = { name: 'Test', address: '', phone: '', email: '', gst: '', stateCode: '33', logo: '' };
  const invoice = (id: string): Invoice => ({
    id, invoiceNumber: id, customerId: 'customer-1', date: '2026-08-10', items: [], subtotal: 1000,
    taxableAmount: 1000, taxTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, discountTotal: 0,
    total: 1000, amountPaid: 0, balanceDue: 1000, paymentStatus: 'unpaid', status: 'unpaid', payments: [],
    notes: '', terms: '', createdAt: '2026-08-10T00:00:00.000Z', type: 'invoice',
  });
  return {
    customers: [{ id: 'customer-1', name: 'Fictional', phone: '', email: '', address: '', createdAt: '2026-08-10T00:00:00.000Z' }],
    products: [], invoices: [invoice('inv-1'), invoice('inv-2')], payments: [], expenses: [], deliveryNotes: [], auditLogs: [], profile,
    settings: getDefaultSettings(profile),
  };
}

test('one invoice edit queues only that invoice document', () => {
  const before = stateFixture();
  const after = structuredClone(before);
  after.invoices[0].notes = 'Device A';
  const operation = createNormalizedOutboxOperation({ operationId: 'op-a', operationType: 'update', before, after });
  assert.deepEqual(operation.entities.map((entry) => `${entry.entityType}:${entry.entityId}`), ['invoice:inv-1']);
  assert.equal(operation.entities[0].data && (operation.entities[0].data as Invoice).notes, 'Device A');
});

test('different invoice edits produce independent durable operations', () => {
  const initial = stateFixture();
  const first = structuredClone(initial);
  first.invoices[0].notes = 'A';
  const second = structuredClone(first);
  second.invoices[1].notes = 'B';
  const outbox = [
    createNormalizedOutboxOperation({ operationId: 'op-a', operationType: 'update', before: initial, after: first }),
    createNormalizedOutboxOperation({ operationId: 'op-b', operationType: 'update', before: first, after: second }),
  ];
  const restored = JSON.parse(JSON.stringify(outbox)) as DurableSyncOutbox[];
  assert.equal(restored[0].entities[0].entityId, 'inv-1');
  assert.equal(restored[1].entities[0].entityId, 'inv-2');
  assert.notEqual(restored[0].operationId, restored[1].operationId);
});

test('payment mutation atomically includes stable payment and affected invoice', () => {
  const before = stateFixture();
  const after = structuredClone(before);
  const payment: Payment = { id: 'pay-1', invoiceId: 'inv-1', amount: 400, paidAt: '2026-08-10', method: 'cash', notes: '', createdAt: '2026-08-10T00:00:00.000Z', createdBy: 'admin', operationId: 'stable-op', kind: 'payment' };
  after.payments.push(payment);
  after.invoices[0].payments.push(payment);
  after.invoices[0].amountPaid = 400;
  after.invoices[0].balanceDue = 600;
  const refs = deriveNormalizedMutations(before, after);
  assert.deepEqual(refs.map((entry) => `${entry.entityType}:${entry.entityId}`).sort(), ['invoice:inv-1', 'payment:pay-1']);
  assert.equal((refs.find((entry) => entry.entityType === 'payment')?.data as Payment).operationId, 'stable-op');
});

test('legacy entity outbox is enriched without dropping its stable operation ID', () => {
  const state = stateFixture();
  const legacy: DurableSyncOutbox = { operationId: 'legacy-op', operationType: 'update', entities: [{ entityType: 'invoice', entityId: 'inv-1', baseHash: 'old' }], queuedAt: '2026-08-10T00:00:00.000Z', retryCount: 2 };
  const restored = restoreLegacyOutbox(legacy, state);
  assert.equal(restored.operationId, 'legacy-op');
  assert.equal((restored.entities[0].data as Invoice).id, 'inv-1');
  assert.equal(restored.retryCount, 2);
});

test('unknown aggregate-wide legacy operation remains blocked for manual review', () => {
  const state = stateFixture();
  const legacy: DurableSyncOutbox = { operationId: 'legacy-app', operationType: 'update', entities: [{ entityType: 'app', entityId: 'aggregate' }], queuedAt: '2026-08-10T00:00:00.000Z', retryCount: 0 };
  assert.deepEqual(restoreLegacyOutbox(legacy, state), legacy);
});
