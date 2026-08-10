import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTrustedDocumentAndCustomer } from '../server/delivery/trustedApplicationData';

function fakeDatabase(documents: Record<string, unknown>) {
  return {
    doc: (path: string) => ({
      get: async () => ({
        exists: Object.prototype.hasOwnProperty.call(documents, path),
        data: () => documents[path],
      }),
    }),
  };
}

const invoice = { id: 'inv-1', invoiceNumber: 'INV-1', customerId: 'customer-1', type: 'invoice' };
const customer = { id: 'customer-1', name: 'Fictional Customer', email: 'test@example.invalid' };

test('server document validation reads normalized invoice and customer wrappers', async () => {
  const db = fakeDatabase({
    'companies/kimera-vel-tech': { migrationState: 'prepared' },
    'companies/kimera-vel-tech/invoices/inv-1': { data: invoice },
    'companies/kimera-vel-tech/customers/customer-1': { data: customer },
  });
  const result = await resolveTrustedDocumentAndCustomer(db, { documentId: 'inv-1', documentType: 'invoice', documentNumber: 'INV-1', customerId: 'customer-1' });
  assert.deepEqual(result, { document: invoice, customer });
});

test('server document validation falls back to aggregate during compatibility phase', async () => {
  const db = fakeDatabase({
    'billease/appData': { data: { invoices: [invoice], customers: [customer], payments: [], deliveryNotes: [] } },
  });
  const result = await resolveTrustedDocumentAndCustomer(db, { documentId: 'inv-1', documentType: 'invoice', documentNumber: 'INV-1', customerId: 'customer-1' });
  assert.deepEqual(result, { document: invoice, customer });
});

test('normalized payment receipt resolves its invoice and customer', async () => {
  const payment = { id: 'pay-1', invoiceId: 'inv-1' };
  const db = fakeDatabase({
    'companies/kimera-vel-tech': { migrationState: 'prepared' },
    'companies/kimera-vel-tech/payments/pay-1': { data: payment },
    'companies/kimera-vel-tech/invoices/inv-1': { data: invoice },
    'companies/kimera-vel-tech/customers/customer-1': { data: customer },
  });
  const result = await resolveTrustedDocumentAndCustomer(db, { documentId: 'pay-1', documentType: 'payment-receipt', documentNumber: 'R-pay-1', customerId: 'customer-1' });
  assert.deepEqual(result, { document: payment, customer });
});
