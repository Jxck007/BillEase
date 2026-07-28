import { HttpError } from '../http/errors';

type DocumentType = 'invoice' | 'quotation' | 'delivery-note';

export async function resolveTrustedDocumentAndCustomer(
  db: any,
  input: {
    documentId: string;
    documentType: string;
    documentNumber: string;
    customerId: string;
  },
) {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(input.documentId)
    || !/^[a-zA-Z0-9_-]{1,160}$/.test(input.customerId)
    || !['invoice', 'quotation', 'delivery-note'].includes(input.documentType)
    || !input.documentNumber
    || input.documentNumber.length > 100) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid document selection');
  }

  const snapshot = await db.doc('billease/appData').get();
  const state = snapshot.data()?.data;
  if (!snapshot.exists || !state) throw new HttpError(400, 'DOCUMENT_NOT_FOUND', 'Document was not found');

  const type = input.documentType as DocumentType;
  const documents = type === 'delivery-note' ? state.deliveryNotes : state.invoices;
  const document = Array.isArray(documents)
    ? documents.find((entry: any) => String(entry?.id) === input.documentId)
    : undefined;
  if (!document) throw new HttpError(400, 'DOCUMENT_NOT_FOUND', 'Document was not found');

  const expectedNumber = type === 'delivery-note' ? document.deliveryNoteNumber : document.invoiceNumber;
  const typeMatches = type === 'delivery-note'
    || (type === 'quotation' ? document.type === 'estimate' : document.type !== 'estimate');
  if (String(expectedNumber) !== input.documentNumber || !typeMatches || String(document.customerId) !== input.customerId) {
    throw new HttpError(400, 'DOCUMENT_MISMATCH', 'Document details do not match');
  }

  const customer = Array.isArray(state.customers)
    ? state.customers.find((entry: any) => String(entry?.id) === input.customerId)
    : undefined;
  if (!customer) throw new HttpError(400, 'CUSTOMER_NOT_FOUND', 'Customer was not found');

  return { document, customer };
}
