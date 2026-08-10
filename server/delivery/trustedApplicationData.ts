import { HttpError } from '../http/errors.js';

type DocumentType = 'invoice' | 'quotation' | 'delivery-note' | 'payment-receipt';

export async function resolveTrustedDocumentAndCustomer(
  db: any,
  input: {
    documentId: string;
    documentType: string;
    documentNumber: string;
    customerId: string;
  },
  companyId = 'kimera-vel-tech',
) {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(input.documentId)
    || !/^[a-zA-Z0-9_-]{1,160}$/.test(input.customerId)
    || !['invoice', 'quotation', 'delivery-note', 'payment-receipt'].includes(input.documentType)
    || !input.documentNumber
    || input.documentNumber.length > 100) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid document selection');
  }

  const type = input.documentType as DocumentType;
  const normalizedCollection = type === 'delivery-note' ? 'deliveryNotes'
    : type === 'payment-receipt' ? 'payments'
      : type === 'quotation' ? 'quotations' : 'invoices';
  const normalizedRoot = await db.doc(`companies/${companyId}`).get();
  if (normalizedRoot.exists && normalizedRoot.data()?.migrationState === 'prepared') {
    const documentSnapshot = await db.doc(`companies/${companyId}/${normalizedCollection}/${input.documentId}`).get();
    const document = documentSnapshot.data()?.data;
    if (!documentSnapshot.exists || !document || documentSnapshot.data()?.deleted === true) {
      throw new HttpError(400, 'DOCUMENT_NOT_FOUND', 'Document was not found');
    }
    const receiptInvoiceSnapshot = type === 'payment-receipt'
      ? await db.doc(`companies/${companyId}/invoices/${document.invoiceId}`).get()
      : null;
    const receiptInvoice = receiptInvoiceSnapshot?.data()?.data;
    const expectedNumber = type === 'delivery-note' ? document.deliveryNoteNumber : type === 'payment-receipt' ? `R-${document.id}` : document.invoiceNumber;
    const expectedCustomerId = type === 'payment-receipt' ? receiptInvoice?.customerId : document.customerId;
    if (String(expectedNumber) !== input.documentNumber || String(expectedCustomerId) !== input.customerId) {
      throw new HttpError(400, 'DOCUMENT_MISMATCH', 'Document details do not match');
    }
    const customerSnapshot = await db.doc(`companies/${companyId}/customers/${input.customerId}`).get();
    const customer = customerSnapshot.data()?.data;
    if (!customerSnapshot.exists || !customer || customerSnapshot.data()?.deleted === true) {
      throw new HttpError(400, 'CUSTOMER_NOT_FOUND', 'Customer was not found');
    }
    return { document, customer };
  }

  const snapshot = await db.doc('billease/appData').get();
  const state = snapshot.data()?.data;
  if (!snapshot.exists || !state) throw new HttpError(400, 'DOCUMENT_NOT_FOUND', 'Document was not found');

  const documents = type === 'delivery-note' ? state.deliveryNotes : type === 'payment-receipt' ? state.payments : state.invoices;
  const document = Array.isArray(documents)
    ? documents.find((entry: any) => String(entry?.id) === input.documentId)
    : undefined;
  if (!document) throw new HttpError(400, 'DOCUMENT_NOT_FOUND', 'Document was not found');

  const receiptInvoice = type === 'payment-receipt' && Array.isArray(state.invoices)
    ? state.invoices.find((entry: any) => String(entry?.id) === String(document.invoiceId))
    : undefined;
  const expectedNumber = type === 'delivery-note' ? document.deliveryNoteNumber : type === 'payment-receipt' ? `R-${document.id}` : document.invoiceNumber;
  const typeMatches = type === 'delivery-note' || type === 'payment-receipt'
    || (type === 'quotation' ? document.type === 'estimate' : document.type !== 'estimate');
  const expectedCustomerId = type === 'payment-receipt' ? receiptInvoice?.customerId : document.customerId;
  if (String(expectedNumber) !== input.documentNumber || !typeMatches || String(expectedCustomerId) !== input.customerId) {
    throw new HttpError(400, 'DOCUMENT_MISMATCH', 'Document details do not match');
  }

  const customer = Array.isArray(state.customers)
    ? state.customers.find((entry: any) => String(entry?.id) === input.customerId)
    : undefined;
  if (!customer) throw new HttpError(400, 'CUSTOMER_NOT_FOUND', 'Customer was not found');

  return { document, customer };
}
