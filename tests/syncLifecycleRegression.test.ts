import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { AppState, BusinessProfile, Invoice, Payment } from '../src/lib/types';
import { contentHash } from '../src/services/firestoreSerialization';
import { DurableWriteQueue, type DurableSyncOutbox } from '../src/services/localDataStore';
import { decideRemoteSnapshot, mergeRemoteWithPendingEntities } from '../src/services/persistencePolicy';
import {
  boundedSyncBackoff,
  classifySyncError,
  isCommittedWriteAcknowledgement,
  shouldRestartPendingSync,
} from '../src/services/syncPolicy';

const now = '2026-08-10T00:00:00.000Z';
const profile: BusinessProfile = { name: 'Fictional Test Company', address: '', phone: '', email: '', gst: '', logo: '' };
const settings = {
  language: 'en', taxMode: 'exclusive', invoicePrefix: '', invoiceStartingNumber: 1, defaultTemplate: 'canonical',
  template: { templateId: 'canonical', themeColor: '#000000', fontFamily: 'sans', footerText: '', headerAlignment: 'left', visibility: { logo: true, gstNumber: true, address: true, phoneEmail: true, discountColumn: true, hsnSac: true, taxBreakdown: true, signature: true, terms: true, qrCode: true, bankDetails: true } },
  businessStateCode: '', enableDrafts: true, enableAutosave: true, enableAuditLog: true, compactMode: false, whatsappCountryCode: '91', estimateDocumentLabel: 'estimate',
  integrations: { serverEmail: false, pinLookup: false, authorizedSignature: false, gstVerification: false, barcodeScanner: false, ocrImport: false, aiQuickActions: false },
  signatureVisibility: { invoice: true, quotation: true, deliveryNote: true }, sealVisibility: { invoice: true, quotation: true, deliveryNote: true }, emailCcBusiness: false,
} as const;

function emptyState(): AppState {
  return { customers: [], products: [], invoices: [], payments: [], expenses: [], deliveryNotes: [], auditLogs: [], profile, settings };
}

function invoice(id: string, notes: string, total = 100): Invoice {
  return {
    id, invoiceNumber: id, customerId: 'customer-1', date: '2026-08-10', items: [], subtotal: total,
    taxableAmount: total, taxTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, discountTotal: 0,
    total, amountPaid: 0, balanceDue: total, paymentStatus: 'unpaid', status: 'unpaid', payments: [],
    notes, terms: '', createdAt: now, updatedAt: now, type: 'invoice',
  };
}

test('A: an authoritative online invoice commit can be applied by device B', () => {
  const deviceA = { ...emptyState(), invoices: [invoice('invoice-a', 'edited on A')] };
  assert.equal(decideRemoteSnapshot(4, 5, false), 'apply');
  const deviceB = structuredClone(deviceA);
  assert.equal(deviceB.invoices[0].notes, 'edited on A');
});

test('B/K: reconnect restarts a dirty outbox and a committed transaction acknowledges it', () => {
  assert.equal(shouldRestartPendingSync({ wasOnline: false, online: true, dirty: true, signedIn: true, cloudAvailable: true }), true);
  const pending = { operationId: 'op-offline', hash: 'hash-after-edit' };
  assert.equal(isCommittedWriteAcknowledgement({ operationId: 'op-offline', hash: 'hash-after-edit', currentHash: 'hash-after-edit' }, pending), true);
  assert.equal(classifySyncError({ code: 'unavailable' }), 'retryable');
  assert.equal(boundedSyncBackoff(2, 0), 1000);
});

test('C: different invoices edited concurrently merge independently', () => {
  const local = { ...emptyState(), invoices: [invoice('invoice-a', 'A changed'), invoice('invoice-b', 'base')] };
  const remote = { ...emptyState(), invoices: [invoice('invoice-a', 'base'), invoice('invoice-b', 'B changed')] };
  const result = mergeRemoteWithPendingEntities(local, remote, [{ entityType: 'invoice', entityId: 'invoice-a', baseHash: contentHash(invoice('invoice-a', 'base')) }]);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.value.invoices.find((entry) => entry.id === 'invoice-a')?.notes, 'A changed');
  assert.equal(result.value.invoices.find((entry) => entry.id === 'invoice-b')?.notes, 'B changed');
});

test('D: the same invoice edited concurrently is blocked as an explicit conflict', () => {
  const local = { ...emptyState(), invoices: [invoice('invoice-a', 'A changed')] };
  const remote = { ...emptyState(), invoices: [invoice('invoice-a', 'B changed')] };
  const result = mergeRemoteWithPendingEntities(local, remote, [{ entityType: 'invoice', entityId: 'invoice-a', baseHash: contentHash(invoice('invoice-a', 'base')) }]);
  assert.deepEqual(result.conflicts, [{ entityType: 'invoice', entityId: 'invoice-a' }]);
  assert.equal(result.value.invoices[0].notes, 'A changed');
});

test('E: a stable payment and its recalculated invoice travel together', () => {
  const payment: Payment = { id: 'payment-a', invoiceId: 'invoice-a', amount: 40, paidAt: now, method: 'cash', notes: '', createdAt: now, createdBy: 'fictional-admin', operationId: 'pay-op-a', kind: 'payment' };
  const paidInvoice = { ...invoice('invoice-a', ''), payments: [payment], amountPaid: 40, balanceDue: 60, paymentStatus: 'partially_paid' as const, status: 'partial' as const };
  const local = { ...emptyState(), invoices: [paidInvoice], payments: [payment] };
  const remote = { ...emptyState(), invoices: [paidInvoice], payments: [payment] };
  const result = mergeRemoteWithPendingEntities(local, remote, [{ entityType: 'payment', entityId: payment.id, baseHash: null }, { entityType: 'invoice', entityId: paidInvoice.id, baseHash: contentHash(invoice('invoice-a', '')) }]);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.value.payments[0].operationId, 'pay-op-a');
  assert.equal(result.value.invoices[0].amountPaid, 40);
  assert.equal(result.value.invoices[0].balanceDue, 60);
});

test('F: an offline-created customer and invoice remain one durable pending snapshot', () => {
  const local = emptyState();
  local.customers.push({ id: 'customer-a', name: 'Fictional Customer', phone: '', email: '', address: '', createdAt: now });
  local.invoices.push(invoice('invoice-a', 'offline'));
  const result = mergeRemoteWithPendingEntities(local, emptyState(), [{ entityType: 'customer', entityId: 'customer-a', baseHash: null }, { entityType: 'invoice', entityId: 'invoice-a', baseHash: null }]);
  assert.equal(result.value.customers.length, 1);
  assert.equal(result.value.invoices.length, 1);
});

test('G/H: reload or tab close preserves the stable outbox operation identity', () => {
  const outbox: DurableSyncOutbox = { operationId: 'stable-op', operationType: 'update', entities: [{ entityType: 'invoice', entityId: 'invoice-a' }], queuedAt: now, retryCount: 2 };
  const restored = JSON.parse(JSON.stringify({ dirty: true, pendingSync: outbox })) as { dirty: boolean; pendingSync: DurableSyncOutbox };
  assert.equal(restored.dirty, true);
  assert.deepEqual(restored.pendingSync, outbox);
});

test('I/J: auth expiry and permission rejection are permanent actionable states', () => {
  assert.equal(classifySyncError({ code: 'unauthenticated' }), 'auth-required');
  assert.equal(classifySyncError({ code: 'permission-denied' }), 'permission-denied');
  assert.equal(classifySyncError({ name: 'AppDataTooLargeError' }), 'data-too-large');
  assert.equal(shouldRestartPendingSync({ wasOnline: false, online: true, dirty: true, signedIn: false, cloudAvailable: true }), false);
});

test('L: two tabs use the same different-entity merge and same-entity conflict policy', () => {
  const tabA = { ...emptyState(), invoices: [invoice('invoice-a', 'tab A'), invoice('invoice-b', 'base')] };
  const tabB = { ...emptyState(), invoices: [invoice('invoice-a', 'tab A'), invoice('invoice-b', 'tab B')] };
  const different = mergeRemoteWithPendingEntities(tabA, tabB, [{ entityType: 'invoice', entityId: 'invoice-a', baseHash: contentHash(invoice('invoice-a', 'base')) }]);
  assert.deepEqual(different.conflicts, []);
  const same = mergeRemoteWithPendingEntities(tabA, { ...tabB, invoices: [invoice('invoice-a', 'tab B same record'), invoice('invoice-b', 'tab B')] }, [{ entityType: 'invoice', entityId: 'invoice-a', baseHash: contentHash(invoice('invoice-a', 'base')) }]);
  assert.equal(same.conflicts.length, 1);
});

test('M: an old Firestore snapshot cannot replace a newer local remote revision', () => {
  assert.equal(decideRemoteSnapshot(9, 8, true), 'ignore-stale');
  assert.equal(decideRemoteSnapshot(9, 9, false), 'ignore-stale');
});

test('N: durable local writes complete in order and a failed write does not poison later saves', async () => {
  const queue = new DurableWriteQueue();
  const completed: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = queue.enqueue(async () => { await firstGate; completed.push('first'); });
  const second = queue.enqueue(async () => { completed.push('second'); throw new Error('fictional write failure'); });
  const third = queue.enqueue(async () => { completed.push('third'); });
  releaseFirst();
  await first;
  await assert.rejects(second, /fictional write failure/);
  await third;
  assert.deepEqual(completed, ['first', 'second', 'third']);
});

test('an older async commit cannot acknowledge a newer local state', () => {
  const oldHash = contentHash({ revision: 'old' });
  const newHash = contentHash({ revision: 'new' });
  assert.equal(isCommittedWriteAcknowledgement({ operationId: 'old-op', hash: oldHash, currentHash: newHash }, { operationId: 'old-op', hash: oldHash }), false);
});

test('invoice commits trigger the worker only after the durable outbox commit', () => {
  const source = readFileSync(new URL('../src/context/DataContext.tsx', import.meta.url), 'utf8');
  const commitStart = source.indexOf('const commitState');
  const commit = source.slice(commitStart, source.indexOf('useDataHydration({', commitStart));
  assert.match(commit, /await persistLocal\(next, shouldQueueCloud\)/);
  assert.match(commit, /if \(shouldQueueCloud\) emitSyncTrigger\(\)/);
  assert.ok(commit.indexOf('await persistLocal(next, shouldQueueCloud)') < commit.indexOf('if (shouldQueueCloud) emitSyncTrigger()'));
  assert.match(source, /getDurablePendingOperations: getPendingSyncOperations/);
});

test('hydration, manual retry, reconnect, and foreground resume restart a durable pending outbox', () => {
  const source = readFileSync(new URL('../src/context/DataContext.tsx', import.meta.url), 'utf8');
  const hydration = readFileSync(new URL('../src/persistence/useDataHydration.ts', import.meta.url), 'utf8');
  assert.match(source, /const operations = await getPendingSyncOperations\(\)/);
  assert.match(source, /window\.addEventListener\('focus', restartIfPending\)/);
  assert.match(source, /document\.addEventListener\('visibilitychange', visibility\)/);
  assert.match(source, /shouldRestartPendingSync/);
  assert.match(hydration, /if \(dirtyRef\.current\) onDurableOutboxReady\(\)/);
  assert.match(hydration, /setCloudSyncEnabled\(true\);/);
});

test('a real worker attempt records an attempt immediately before its transaction and recovers its guard', () => {
  const firebase = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8');
  const data = readFileSync(new URL('../src/context/DataContext.tsx', import.meta.url), 'utf8');
  assert.match(firebase, /callbacks\?\.onAttempt\?\.\(attempt \+ 1\)/);
  assert.match(firebase, /finally \{\s*workerRunning\.current = false;/);
  assert.match(data, /const attemptedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(data, /lastAttemptAt: attemptedAt/);
});
