import assert from 'node:assert/strict';
import test from 'node:test';
import { customerSnapshot, normalizeCustomer, normalizeInvoice } from '../src/lib/entitySchemas';
import { AppState, BusinessProfile } from '../src/lib/types';
import { decideRemoteSnapshot, mergeRemoteWithoutLosingLocal } from '../src/services/persistencePolicy';
import { loadLocalAppState } from '../src/services/localDataStore';
import { contentHash, sanitizeForFirestore } from '../src/services/firestoreSerialization';

const now = '2026-07-30T00:00:00.000Z';
const profile: BusinessProfile = { name: 'Test', address: '', phone: '', email: '', gst: '', logo: '' };
const settings = {
  language: 'en', taxMode: 'exclusive', invoicePrefix: '', invoiceStartingNumber: 1, defaultTemplate: 'canonical',
  template: { templateId: 'canonical', themeColor: '#000000', fontFamily: 'sans', footerText: '', headerAlignment: 'left', visibility: { logo: true, gstNumber: true, address: true, phoneEmail: true, discountColumn: true, hsnSac: true, taxBreakdown: true, signature: true, terms: true, qrCode: true, bankDetails: true } },
  businessStateCode: '', enableDrafts: true, enableAutosave: true, enableAuditLog: true, compactMode: false, whatsappCountryCode: '91', estimateDocumentLabel: 'estimate',
  integrations: { serverEmail: false, pinLookup: false, authorizedSignature: false, gstVerification: false, barcodeScanner: false, ocrImport: false, aiQuickActions: false },
  signatureVisibility: { invoice: true, quotation: true, deliveryNote: true }, sealVisibility: { invoice: true, quotation: true, deliveryNote: true }, emailCcBusiness: false,
} as const;
const emptyState = (): AppState => ({ customers: [], products: [], invoices: [], payments: [], expenses: [], deliveryNotes: [], auditLogs: [], profile, settings });

test('name-only customer accepts empty GST, address, phone and email', () => {
  const result = normalizeCustomer({ id: 'customer-1', name: 'பெயர்', gstNumber: '', address: '', phone: '', email: '', createdAt: now });
  assert.deepEqual(result.errors, []);
  assert.equal(result.value?.gstNumber, '');
  assert.equal(result.value?.address, '');
});

test('invoice for name-only customer remains valid and embeds a customer snapshot', () => {
  const customer = normalizeCustomer({ id: 'customer-1', name: 'Minimum Customer', gstNumber: '', address: '', phone: '', email: '', createdAt: now }).value!;
  const result = normalizeInvoice({
    id: 'invoice-1', invoiceNumber: '001/26-27', customerId: customer.id, customerSnapshot: customerSnapshot(customer),
    date: '2026-07-30', items: [{ id: 'item-1', productId: '', name: 'Service', description: '', quantity: 1, price: 100, taxRate: 0, discount: 0 }],
    subtotal: 100, taxableAmount: 100, taxTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, discountTotal: 0,
    total: 100, amountPaid: 0, status: 'unpaid', notes: '', terms: '', createdAt: now, type: 'invoice',
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.value?.customerSnapshot?.name, 'Minimum Customer');
});

test('missing live customer relation does not invalidate a document with a snapshot', () => {
  const result = normalizeInvoice({
    id: 'invoice-1', invoiceNumber: '001', customerId: '', customerSnapshot: { id: 'deleted', name: 'Historical Customer', gstNumber: '', address: '', phone: '', email: '' },
    date: '2026-07-30', items: [{ id: 'item-1', name: 'Item', quantity: 1, price: 0 }], total: 0, createdAt: now, type: 'invoice',
  });
  assert.equal(result.errors.some((entry) => entry.field === 'customerId'), false);
});

test('stale snapshot cannot replace dirty local customer and invoice', () => {
  const local = emptyState();
  const customer = normalizeCustomer({ id: 'customer-1', name: 'Local Customer', gstNumber: '', address: '', phone: '', email: '', createdAt: now }).value!;
  local.customers.push(customer);
  local.invoices.push(normalizeInvoice({
    id: 'invoice-1', invoiceNumber: '001', customerId: customer.id, customerSnapshot: customerSnapshot(customer), date: '2026-07-30',
    items: [{ id: 'item-1', name: 'Item', quantity: 1, price: 1 }], total: 1, createdAt: now, type: 'invoice',
  }).value!);
  const staleRemote = emptyState();
  assert.equal(decideRemoteSnapshot(5, 4, true), 'ignore-stale');
  const merged = mergeRemoteWithoutLosingLocal(local, staleRemote);
  assert.equal(merged.customers.length, 1);
  assert.equal(merged.invoices.length, 1);
});

test('newer remote snapshot is merged while local state is dirty', () => {
  assert.equal(decideRemoteSnapshot(5, 6, true), 'merge-and-preserve');
  assert.equal(decideRemoteSnapshot(5, 6, false), 'apply');
});

test('IndexedDB failure is explicit instead of returning empty application data', async () => {
  await assert.rejects(loadLocalAppState(), /LOCAL_STORAGE_UNAVAILABLE/);
});

test('malformed required data is reported and not silently treated as valid', () => {
  const result = normalizeCustomer({ id: 'customer-1', name: '', gstNumber: '', address: '', createdAt: now });
  assert.equal(result.errors[0]?.message, 'Customer name is required.');
  assert.ok(result.value, 'original record remains available for quarantine/recovery');
});

test('identical application data has one stable content hash regardless of object key order', () => {
  assert.equal(contentHash({ invoices: [{ id: '1', total: 0 }], customers: [] }), contentHash({ customers: [], invoices: [{ total: 0, id: '1' }] }));
});

test('Firestore serialization preserves empty optional strings and numeric zero', () => {
  assert.deepEqual(sanitizeForFirestore({ gstNumber: '', address: '', total: 0 }), { gstNumber: '', address: '', total: 0 });
});
