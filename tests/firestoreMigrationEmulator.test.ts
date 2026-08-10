import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test, { after, before } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, disableNetwork, doc, enableNetwork, getDoc, getDocFromServer, getFirestore, setDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { AppState, Invoice, Payment } from '../src/lib/types';
import { getDefaultSettings } from '../src/services/invoiceService';
import { createAggregateBackup } from '../scripts/lib/migrationBackup';
import { commitNormalizedOperation } from '../src/services/normalizedFirestoreWriter';
import { contentHash } from '../src/services/firestoreSerialization';
import type { DurableSyncOutbox } from '../src/services/localDataStore';

const execute = promisify(execFile);
const projectId = 'billease-migration-test';
const companyId = 'kimera-vel-tech';
const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080');
const [host, portText] = emulatorHost.split(':');
const port = Number(portText);
let environment: RulesTestEnvironment;
let temporaryDirectory: string;
let backupFile: string;

function stateFixture(): AppState {
  const profile = { name: 'Fictional Works', address: 'Test Street', phone: '', email: '', gst: '', stateCode: '33', logo: '' };
  const invoice = (id: string): Invoice => ({
    id, invoiceNumber: id.toUpperCase(), customerId: 'customer-1', date: '2026-08-01',
    customerSnapshot: { id: 'customer-1', name: 'Fictional Customer', gstNumber: '', address: 'Test Street', phone: '', email: '' },
    items: [], subtotal: 1000, taxableAmount: 1000, taxTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0,
    discountTotal: 0, total: 1000, amountPaid: 0, balanceDue: 1000, paymentStatus: 'unpaid', status: 'unpaid',
    payments: [], notes: '', terms: '', createdAt: '2026-08-01T00:00:00.000Z', type: 'invoice',
  });
  return {
    customers: [{ id: 'customer-1', name: 'Fictional Customer', phone: '', email: '', address: 'Test Street', createdAt: '2026-08-01T00:00:00.000Z' }],
    products: [], invoices: [invoice('inv-1'), invoice('inv-2')], payments: [], expenses: [], deliveryNotes: [], auditLogs: [],
    profile, settings: getDefaultSettings(profile),
  };
}

async function runMigration(...args: string[]) {
  return execute(path.resolve('node_modules/.bin/tsx'), ['scripts/firestoreMigration.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: emulatorHost },
  });
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host, port, rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
  await environment.clearFirestore();
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'billease-migration-'));
  backupFile = path.join(temporaryDirectory, 'aggregate-backup.json');
  const state = stateFixture();
  const envelope = { data: state, revision: 4, updatedAt: null, clientOperationId: 'aggregate-op', sourceDeviceId: 'device-a' };
  const backup = createAggregateBackup(projectId, envelope, '2026-08-10T00:00:00.000Z');
  fs.writeFileSync(backupFile, JSON.stringify(backup), { mode: 0o600 });
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'billease', 'appData'), envelope);
    await setDoc(doc(context.firestore(), 'admins', 'admin-a'), { active: true, role: 'admin', companyId });
    await setDoc(doc(context.firestore(), 'admins', 'legacy-admin'), { active: true, role: 'admin' });
    await setDoc(doc(context.firestore(), 'admins', 'viewer'), { active: true, role: 'viewer', companyId });
  });
});

after(async () => {
  await environment.cleanup();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('migration apply is idempotent and verification is lossless', { timeout: 30_000 }, async () => {
  const first = await runMigration('migrate', '--backup', backupFile, '--apply', '--project', projectId, '--company', companyId);
  assert.match(first.stdout, /"mode": "apply"/);
  const second = await runMigration('migrate', '--backup', backupFile, '--apply', '--project', projectId, '--company', companyId);
  assert.match(second.stdout, /"missingDocuments": 0/);
  const verify = await runMigration('verify', '--backup', backupFile, '--project', projectId, '--company', companyId);
  assert.match(verify.stdout, /"ok": true/);
});

test('rules allow only active company admins and retain legacy aggregate access', async () => {
  const admin = environment.authenticatedContext('admin-a').firestore();
  const legacyAdmin = environment.authenticatedContext('legacy-admin').firestore();
  const viewer = environment.authenticatedContext('viewer').firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(admin, 'companies', companyId, 'invoices', 'inv-1')));
  await assertSucceeds(getDoc(doc(legacyAdmin, 'companies', companyId, 'invoices', 'inv-1')));
  await assertSucceeds(getDoc(doc(legacyAdmin, 'billease', 'appData')));
  await assertFails(getDoc(doc(viewer, 'companies', companyId, 'invoices', 'inv-1')));
  await assertFails(getDoc(doc(anonymous, 'billease', 'appData')));
  await assertFails(getDoc(doc(legacyAdmin, 'companies', 'another-company', 'invoices', 'inv-1')));
});

test('two clients can update different invoice documents without conflict', async () => {
  const appA = initializeApp({ projectId, apiKey: 'test', appId: 'device-a' }, 'device-a');
  const appB = initializeApp({ projectId, apiKey: 'test', appId: 'device-b' }, 'device-b');
  const dbA = getFirestore(appA);
  const dbB = getFirestore(appB);
  connectFirestoreEmulator(dbA, host, port, { mockUserToken: { sub: 'admin-a', user_id: 'admin-a' } });
  connectFirestoreEmulator(dbB, host, port, { mockUserToken: { sub: 'admin-a', user_id: 'admin-a' } });
  const firstRef = doc(dbA, 'companies', companyId, 'invoices', 'inv-1');
  const secondRef = doc(dbB, 'companies', companyId, 'invoices', 'inv-2');
  const [first, second] = await Promise.all([getDoc(firstRef), getDoc(secondRef)]);
  const operationA: DurableSyncOutbox = { operationId: 'op-a', operationType: 'update', queuedAt: new Date().toISOString(), retryCount: 0, entities: [{ entityType: 'invoice', entityId: 'inv-1', baseHash: first.data()?.contentHash, data: { ...first.data()?.data, notes: 'edited on A' }, position: first.data()?.position, operationType: 'update' }] };
  const operationB: DurableSyncOutbox = { operationId: 'op-b', operationType: 'update', queuedAt: new Date().toISOString(), retryCount: 0, entities: [{ entityType: 'invoice', entityId: 'inv-2', baseHash: second.data()?.contentHash, data: { ...second.data()?.data, notes: 'edited on B' }, position: second.data()?.position, operationType: 'update' }] };
  await Promise.all([
    commitNormalizedOperation(dbA, operationA, 'device-a', 2, companyId),
    commitNormalizedOperation(dbB, operationB, 'device-b', 2, companyId),
  ]);
  assert.equal((await getDoc(firstRef)).data()?.data.notes, 'edited on A');
  assert.equal((await getDoc(secondRef)).data()?.data.notes, 'edited on B');
  await Promise.all([deleteApp(appA), deleteApp(appB)]);
});

test('payment and affected invoice update commit atomically with a stable operation ID', async () => {
  const admin = environment.authenticatedContext('admin-a').firestore();
  const invoiceRef = doc(admin, 'companies', companyId, 'invoices', 'inv-1');
  const invoiceSnapshot = await getDoc(invoiceRef);
  const payment: Payment = {
    id: 'pay-1', invoiceId: 'inv-1', amount: 400, paidAt: '2026-08-10', method: 'cash', notes: '',
    createdAt: '2026-08-10T00:00:00.000Z', createdBy: 'admin-a', operationId: 'stable-payment-op', kind: 'payment',
  };
  const operation: DurableSyncOutbox = {
    operationId: payment.operationId, operationType: 'create', queuedAt: new Date().toISOString(), retryCount: 0,
    entities: [
      { entityType: 'payment', entityId: payment.id, baseHash: null, data: payment, position: 0, operationType: 'create' },
      { entityType: 'invoice', entityId: 'inv-1', baseHash: invoiceSnapshot.data()?.contentHash, data: { ...invoiceSnapshot.data()?.data, payments: [payment], amountPaid: 400, balanceDue: 600 }, position: invoiceSnapshot.data()?.position, operationType: 'update' },
    ],
  };
  await commitNormalizedOperation(admin as any, operation, 'device-b', 3, companyId);
  const [savedPayment, savedInvoice] = await Promise.all([
    getDoc(doc(admin, 'companies', companyId, 'payments', payment.id)),
    getDoc(invoiceRef),
  ]);
  assert.equal(savedPayment.data()?.data.operationId, 'stable-payment-op');
  assert.equal(savedInvoice.data()?.data.balanceDue, 600);
});

test('same-invoice stale base hash is rejected without overwriting the winner', async () => {
  const admin = environment.authenticatedContext('admin-a').firestore();
  const reference = doc(admin, 'companies', companyId, 'invoices', 'inv-2');
  const original = await getDoc(reference);
  const makeOperation = (operationId: string, notes: string): DurableSyncOutbox => ({
    operationId, operationType: 'update', queuedAt: new Date().toISOString(), retryCount: 0,
    entities: [{ entityType: 'invoice', entityId: 'inv-2', baseHash: original.data()?.contentHash, data: { ...original.data()?.data, notes }, position: original.data()?.position, operationType: 'update' }],
  });
  await commitNormalizedOperation(admin as any, makeOperation('same-winner', 'winner'), 'device-a', 4, companyId);
  await assert.rejects(commitNormalizedOperation(admin as any, makeOperation('same-stale', 'stale'), 'device-b', 4, companyId));
  assert.equal((await getDoc(reference)).data()?.data.notes, 'winner');
});

test('offline queued invoice edit reaches the server after reconnect', { timeout: 20_000 }, async () => {
  const appA = initializeApp({ projectId, apiKey: 'test', appId: 'offline-a' }, 'offline-a');
  const appB = initializeApp({ projectId, apiKey: 'test', appId: 'online-b' }, 'online-b');
  const dbA = getFirestore(appA);
  const dbB = getFirestore(appB);
  connectFirestoreEmulator(dbA, host, port, { mockUserToken: { sub: 'admin-a', user_id: 'admin-a' } });
  connectFirestoreEmulator(dbB, host, port, { mockUserToken: { sub: 'admin-a', user_id: 'admin-a' } });
  const referenceA = doc(dbA, 'companies', companyId, 'invoices', 'inv-1');
  const current = await getDocFromServer(referenceA);
  const data = { ...current.data()?.data, notes: 'offline edit' };
  const operation: DurableSyncOutbox = { operationId: 'offline-op', operationType: 'update', queuedAt: new Date().toISOString(), retryCount: 0, entities: [{ entityType: 'invoice', entityId: 'inv-1', baseHash: current.data()?.contentHash, data, position: current.data()?.position, operationType: 'update' }] };
  await disableNetwork(dbA);
  const pending = commitNormalizedOperation(dbA, operation, 'device-a', 5, companyId);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await enableNetwork(dbA);
  await pending;
  const received = await getDocFromServer(doc(dbB, 'companies', companyId, 'invoices', 'inv-1'));
  assert.equal(received.data()?.data.notes, 'offline edit');
  assert.equal(received.data()?.contentHash, contentHash(data));
  await Promise.all([deleteApp(appA), deleteApp(appB)]);
});

test('rollback dry-run and apply rebuild the aggregate without deleting normalized documents', { timeout: 30_000 }, async () => {
  const dryRun = await runMigration('rollback', '--project', projectId, '--company', companyId);
  assert.match(dryRun.stdout, /"mode": "dry-run"/);
  await runMigration('rollback', '--apply', '--project', projectId, '--company', companyId, '--output', path.join(temporaryDirectory, 'pre-rollback.json'));
  const unrestricted = environment.authenticatedContext('admin-a').firestore();
  const aggregate = await getDoc(doc(unrestricted, 'billease', 'appData'));
  const normalizedInvoice = await getDoc(doc(unrestricted, 'companies', companyId, 'invoices', 'inv-1'));
  assert.equal(aggregate.data()?.data.invoices.find((entry: Invoice) => entry.id === 'inv-1').balanceDue, 600);
  assert.equal(normalizedInvoice.exists(), true);
});
