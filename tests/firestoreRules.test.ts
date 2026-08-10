import fs from 'node:fs';
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';

const projectId = 'billease-security-test';
const companyId = 'kimera-vel-tech';
const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080');
const [host, portText] = emulatorHost.split(':');
const port = Number(portText);
let environment: RulesTestEnvironment;

function wrapper(data: Record<string, unknown>, input: {
  baseHash?: string | null;
  contentHash?: string;
  operationId?: string;
} = {}) {
  return {
    data,
    position: 0,
    revision: 1,
    baseHash: input.baseHash ?? null,
    contentHash: input.contentHash || `hash-${String(data.id || 'document')}`,
    clientOperationId: input.operationId || 'seed-operation',
    sourceDeviceId: 'security-test',
  };
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, 'admins', 'company-admin'), { active: true, role: 'admin', companyId }),
      setDoc(doc(database, 'admins', 'legacy-admin'), { active: true, role: 'admin' }),
      setDoc(doc(database, 'admins', 'inactive-admin'), { active: false, role: 'admin', companyId }),
      setDoc(doc(database, 'admins', 'non-admin'), { active: true, role: 'viewer', companyId }),
      setDoc(doc(database, 'billease', 'appData'), { data: { customers: [], invoices: [], payments: [] }, revision: 1 }),
      setDoc(doc(database, 'companies', companyId), {
        schemaVersion: 2,
        migrationState: 'prepared',
        data: { profile: { name: 'Fictional Company' } },
        baseHash: null,
        contentHash: 'profile-base',
        clientOperationId: 'migration',
      }),
      setDoc(doc(database, 'companies', companyId, 'settings', 'company'), wrapper({ language: 'en' }, { contentHash: 'settings-base' })),
      setDoc(doc(database, 'companies', companyId, 'customers', 'customer-1'), wrapper({ id: 'customer-1', name: 'Fictional Customer' }, { contentHash: 'customer-base' })),
      setDoc(doc(database, 'companies', companyId, 'invoices', 'invoice-1'), wrapper({ id: 'invoice-1', customerId: 'customer-1', total: 1000, payments: [] }, { contentHash: 'invoice-base' })),
      setDoc(doc(database, 'companies', companyId, 'migrations', 'aggregate-v1'), { schemaVersion: 2, state: 'prepared' }),
    ]);
  });
});

after(async () => {
  await environment.cleanup();
});

test('authorized admin read succeeds', async () => {
  const database = environment.authenticatedContext('company-admin').firestore();
  await assertSucceeds(getDoc(doc(database, 'companies', companyId, 'customers', 'customer-1')));
});

test('authorized admin write succeeds with a valid base hash', async () => {
  const database = environment.authenticatedContext('company-admin').firestore();
  await assertSucceeds(setDoc(doc(database, 'companies', companyId, 'customers', 'customer-1'), wrapper(
    { id: 'customer-1', name: 'Updated Fictional Customer' },
    { baseHash: 'customer-base', contentHash: 'customer-updated', operationId: 'customer-update' },
  )));
});

test('unauthenticated read is denied', async () => {
  const database = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(database, 'companies', companyId, 'customers', 'customer-1')));
  await assertFails(getDoc(doc(database, 'billease', 'appData')));
});

test('unauthenticated write is denied', async () => {
  const database = environment.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(database, 'companies', companyId, 'customers', 'anonymous-customer'), wrapper({ id: 'anonymous-customer' })));
  await assertFails(setDoc(doc(database, 'billease', 'appData'), { data: {} }));
});

test('non-admin and inactive admin are denied', async () => {
  for (const uid of ['non-admin', 'inactive-admin']) {
    const database = environment.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(database, 'companies', companyId, 'customers', 'customer-1')));
    await assertFails(setDoc(doc(database, 'companies', companyId, 'customers', 'blocked'), wrapper({ id: 'blocked' })));
  }
});

test('customer create and hash-guarded update are allowed; stale update is denied', async () => {
  const database = environment.authenticatedContext('company-admin').firestore();
  const reference = doc(database, 'companies', companyId, 'customers', 'customer-2');
  await assertSucceeds(setDoc(reference, wrapper({ id: 'customer-2', name: 'New Fictional Customer' }, { contentHash: 'customer-2-base', operationId: 'customer-create' })));
  await assertSucceeds(setDoc(reference, wrapper({ id: 'customer-2', name: 'Updated' }, { baseHash: 'customer-2-base', contentHash: 'customer-2-updated', operationId: 'customer-update' })));
  await assertFails(setDoc(reference, wrapper({ id: 'customer-2', name: 'Stale' }, { baseHash: 'customer-2-base', contentHash: 'customer-2-stale', operationId: 'stale-update' })));
});

test('invoice write is independently authorized and hash guarded', async () => {
  const database = environment.authenticatedContext('company-admin').firestore();
  const reference = doc(database, 'companies', companyId, 'invoices', 'invoice-2');
  await assertSucceeds(setDoc(reference, wrapper({ id: 'invoice-2', customerId: 'customer-1', total: 500 }, { contentHash: 'invoice-2-base', operationId: 'invoice-create' })));
  await assertSucceeds(setDoc(reference, wrapper({ id: 'invoice-2', customerId: 'customer-1', total: 600 }, { baseHash: 'invoice-2-base', contentHash: 'invoice-2-updated', operationId: 'invoice-update' })));
});

test('payment write requires an atomic affected-invoice update', async () => {
  const database = environment.authenticatedContext('company-admin').firestore();
  const paymentReference = doc(database, 'companies', companyId, 'payments', 'payment-1');
  const payment = wrapper(
    { id: 'payment-1', invoiceId: 'invoice-1', amount: 400, kind: 'payment', operationId: 'payment-operation' },
    { contentHash: 'payment-1-hash', operationId: 'payment-operation' },
  );
  await assertFails(setDoc(paymentReference, payment));

  const batch = writeBatch(database);
  batch.set(paymentReference, payment);
  batch.set(doc(database, 'companies', companyId, 'invoices', 'invoice-1'), wrapper(
    { id: 'invoice-1', customerId: 'customer-1', total: 1000, amountPaid: 400, balanceDue: 600 },
    { baseHash: 'invoice-base', contentHash: 'invoice-paid', operationId: 'payment-operation' },
  ));
  await assertSucceeds(batch.commit());
});

test('payment reversal is a new immutable payment and updates the invoice atomically', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'companies', companyId, 'payments', 'payment-original'), wrapper(
      { id: 'payment-original', invoiceId: 'invoice-1', amount: 400, kind: 'payment', operationId: 'original-operation' },
      { contentHash: 'original-payment-hash', operationId: 'original-operation' },
    ));
  });
  const database = environment.authenticatedContext('company-admin').firestore();
  const reversal = wrapper(
    { id: 'payment-reversal', invoiceId: 'invoice-1', amount: 400, kind: 'reversal', originalPaymentId: 'payment-original', operationId: 'reversal-operation' },
    { contentHash: 'reversal-hash', operationId: 'reversal-operation' },
  );
  const batch = writeBatch(database);
  batch.set(doc(database, 'companies', companyId, 'payments', 'payment-reversal'), reversal);
  batch.set(doc(database, 'companies', companyId, 'invoices', 'invoice-1'), wrapper(
    { id: 'invoice-1', customerId: 'customer-1', total: 1000, amountPaid: 0, balanceDue: 1000 },
    { baseHash: 'invoice-base', contentHash: 'invoice-reversed', operationId: 'reversal-operation' },
  ));
  await assertSucceeds(batch.commit());
  await assertFails(setDoc(doc(database, 'companies', companyId, 'payments', 'payment-original'), wrapper(
    { id: 'payment-original', invoiceId: 'invoice-1', amount: 999, kind: 'payment' },
    { baseHash: 'original-payment-hash', contentHash: 'tampered-payment', operationId: 'tamper' },
  )));
});

test('settings access is admin-only and hash guarded', async () => {
  const admin = environment.authenticatedContext('company-admin').firestore();
  const settingsReference = doc(admin, 'companies', companyId, 'settings', 'company');
  await assertSucceeds(getDoc(settingsReference));
  await assertSucceeds(setDoc(settingsReference, wrapper(
    { language: 'ta' },
    { baseHash: 'settings-base', contentHash: 'settings-updated', operationId: 'settings-update' },
  )));
  await assertFails(getDoc(doc(environment.authenticatedContext('non-admin').firestore(), 'companies', companyId, 'settings', 'company')));
});

test('migration compatibility preserves aggregate access and read-only migration metadata', async () => {
  const companyAdmin = environment.authenticatedContext('company-admin').firestore();
  const legacyAdmin = environment.authenticatedContext('legacy-admin').firestore();
  await assertSucceeds(getDoc(doc(companyAdmin, 'billease', 'appData')));
  await assertSucceeds(setDoc(doc(companyAdmin, 'billease', 'appData'), { data: { customers: [], invoices: [], payments: [] }, revision: 2 }));
  await assertSucceeds(getDoc(doc(legacyAdmin, 'companies', companyId, 'migrations', 'aggregate-v1')));
  await assertFails(setDoc(doc(legacyAdmin, 'companies', companyId, 'migrations', 'aggregate-v1'), { state: 'tampered' }));
  await assertFails(getDoc(doc(legacyAdmin, 'companies', 'another-company', 'migrations', 'aggregate-v1')));
});

test('admin authorization documents cannot be modified by clients', async () => {
  const database = environment.authenticatedContext('company-admin').firestore();
  await assertSucceeds(getDoc(doc(database, 'admins', 'company-admin')));
  await assertFails(setDoc(doc(database, 'admins', 'company-admin'), { active: true, role: 'admin', companyId: 'another-company' }));
  assert.ok(true);
});
