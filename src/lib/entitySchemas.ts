import { Customer, CustomerSnapshot, DeliveryNote, Invoice, InvoiceItem } from './types';
import { legacyStatus, normalizePayment, recalculateInvoicePayments } from '../services/paymentService';

export type ValidationIssue = {
  field: string;
  message: string;
  code: string;
};

export type NormalizationResult<T> = {
  value: T | null;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const finite = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};
const issue = (field: string, message: string, code: string): ValidationIssue => ({ field, message, code });

export const ENTITY_CONTRACTS = {
  customer: {
    required: ['id', 'name'],
    optional: ['gstNumber', 'address', 'phone', 'email', 'stateCode', 'postalCode', 'notes'],
  },
  invoice: {
    required: ['id', 'invoiceNumber', 'date', 'customerId/customerSnapshot', 'items', 'totals'],
    optional: ['gstNumber', 'address', 'phone', 'email', 'notes', 'terms', 'poNumber', 'poDate', 'placeOfSupply', 'placeOfSupplyStateCode', 'taxMode', 'taxModeSource'],
  },
  quotation: {
    required: ['id', 'invoiceNumber', 'date', 'customerId/customerSnapshot', 'items', 'totals'],
    optional: ['gstNumber', 'address', 'phone', 'email', 'notes', 'terms', 'validUntil', 'placeOfSupplyStateCode', 'taxMode', 'taxModeSource'],
  },
  deliveryNote: {
    required: ['id', 'deliveryNoteNumber', 'date', 'customerId/customerSnapshot', 'items'],
    optional: ['gstNumber', 'address', 'phone', 'email', 'transport details', 'notes', 'remarks'],
  },
} as const;

export function normalizeCustomer(input: unknown): NormalizationResult<Customer> {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const id = text(source.id);
  const name = text(source.name);
  if (!id) errors.push(issue('id', 'Customer ID is required.', 'customer.id.required'));
  if (!name) errors.push(issue('name', 'Customer name is required.', 'customer.name.required'));
  const gstNumber = text(source.gstNumber || source.gstin).toUpperCase();
  const address = text(source.address);
  const shippingAddress = text(source.shippingAddress);
  const value: Customer = {
    ...source,
    id,
    name,
    phone: text(source.phone),
    email: text(source.email),
    address,
    billingPin: text(source.billingPin),
    shippingAddress,
    shippingPin: text(source.shippingPin),
    useDifferentShippingAddress: typeof source.useDifferentShippingAddress === 'boolean'
      ? source.useDifferentShippingAddress
      : Boolean(shippingAddress && shippingAddress !== address),
    gstin: gstNumber,
    gstNumber,
    stateCode: text(source.stateCode),
    whatsapp: text(source.whatsapp),
    notes: text(source.notes),
    createdAt: text(source.createdAt) || new Date().toISOString(),
    updatedAt: text(source.updatedAt) || undefined,
    deletedAt: text(source.deletedAt) || undefined,
  };
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    errors.push(issue('email', 'Enter a valid customer email address.', 'customer.email.invalid'));
  }
  if (value.billingPin && !/^\d{6}$/.test(value.billingPin)) {
    errors.push(issue('billingPin', 'Enter a valid 6-digit PIN / postal code.', 'customer.pin.invalid'));
  }
  if (value.useDifferentShippingAddress && value.shippingPin && !/^\d{6}$/.test(value.shippingPin)) {
    errors.push(issue('shippingPin', 'Enter a valid 6-digit shipping PIN / postal code.', 'customer.shippingPin.invalid'));
  }
  return { value, warnings, errors };
}

export function customerSnapshot(customer: Customer): CustomerSnapshot {
  return {
    id: customer.id,
    name: text(customer.name),
    gstNumber: text(customer.gstNumber || customer.gstin).toUpperCase(),
    address: text(customer.address),
    phone: text(customer.phone),
    email: text(customer.email),
    stateCode: text(customer.stateCode) || undefined,
  };
}

export function normalizeInvoiceItem(input: unknown, index: number): NormalizationResult<InvoiceItem> {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const errors: ValidationIssue[] = [];
  const name = text(source.name || source.description);
  const quantity = finite(source.quantity);
  const price = finite(source.price);
  if (!name) errors.push(issue(`items.${index}.name`, `Line item ${index + 1} needs a name.`, 'invoice.item.name.required'));
  if (quantity <= 0) errors.push(issue(`items.${index}.quantity`, `Line item ${index + 1} quantity must be greater than zero.`, 'invoice.item.quantity.invalid'));
  if (price < 0) errors.push(issue(`items.${index}.price`, `Line item ${index + 1} price cannot be negative.`, 'invoice.item.price.invalid'));
  return {
    value: {
      id: text(source.id),
      productId: text(source.productId),
      name,
      description: text(source.description),
      hsnSac: text(source.hsnSac),
      unit: text(source.unit) || 'Nos',
      quantity,
      price,
      taxRate: finite(source.taxRate),
      discount: finite(source.discount),
      discountType: source.discountType === 'flat' ? 'flat' : 'percent',
    },
    warnings: [],
    errors,
  };
}

export function normalizeInvoice(input: unknown): NormalizationResult<Invoice> {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const itemResults = rawItems.map(normalizeInvoiceItem);
  itemResults.forEach((result) => errors.push(...result.errors));
  const id = text(source.id);
  const invoiceNumber = text(source.invoiceNumber);
  const date = text(source.date);
  const customerId = text(source.customerId);
  const snapshotSource = source.customerSnapshot && typeof source.customerSnapshot === 'object'
    ? source.customerSnapshot as Record<string, unknown>
    : null;
  if (!id) errors.push(issue('id', 'Document ID is required.', 'invoice.id.required'));
  if (!invoiceNumber) errors.push(issue('invoiceNumber', 'Invoice number is required.', 'invoice.number.required'));
  if (!date) errors.push(issue('date', 'Invoice date is required.', 'invoice.date.required'));
  if (!customerId && !text(snapshotSource?.name)) errors.push(issue('customerId', 'Select a customer.', 'invoice.customer.required'));
  if (rawItems.length === 0) errors.push(issue('items', 'Add at least one valid line item.', 'invoice.items.required'));
  const total = finite(source.total);
  if (total < 0) errors.push(issue('total', 'Invoice total cannot be negative.', 'invoice.total.invalid'));
  const legacyPaymentStatus = source.paymentStatus === 'cancelled' || source.status === 'cancelled'
    ? 'cancelled'
    : 'unpaid';
  const normalizedPayments = (Array.isArray(source.payments) ? source.payments : [])
    .map((payment) => normalizePayment(payment as Record<string, unknown>, id))
    .filter((payment): payment is NonNullable<typeof payment> => Boolean(payment));
  const value = {
    ...source,
    id,
    invoiceNumber,
    customerId,
    date,
    items: itemResults.map((result) => result.value as InvoiceItem),
    subtotal: finite(source.subtotal),
    taxableAmount: finite(source.taxableAmount),
    taxTotal: finite(source.taxTotal),
    cgstTotal: finite(source.cgstTotal),
    sgstTotal: finite(source.sgstTotal),
    igstTotal: finite(source.igstTotal),
    discountTotal: finite(source.discountTotal),
    total,
    payments: normalizedPayments,
    amountPaid: 0,
    balanceDue: total,
    paymentStatus: legacyPaymentStatus,
    status: legacyStatus(legacyPaymentStatus),
    notes: text(source.notes),
    terms: text(source.terms),
    createdAt: text(source.createdAt) || new Date().toISOString(),
    updatedAt: text(source.updatedAt) || undefined,
    type: source.type === 'estimate' ? 'estimate' : 'invoice',
    placeOfSupplyStateCode: text(source.placeOfSupplyStateCode) || undefined,
    placeOfSupplySource: source.placeOfSupplySource === 'manual' ? 'manual' : source.placeOfSupplySource === 'automatic' ? 'automatic' : undefined,
    supplierStateCode: text(source.supplierStateCode) || undefined,
    taxMode: source.taxMode === 'INTRA_STATE' || source.taxMode === 'INTER_STATE' ? source.taxMode : source.taxMode === 'AUTO' ? 'AUTO' : undefined,
    taxModeSource: source.taxModeSource === 'manual' ? 'manual' : source.taxModeSource === 'automatic' ? 'automatic' : undefined,
    taxOverrideReason: text(source.taxOverrideReason) || undefined,
    customerSnapshot: snapshotSource ? {
      id: text(snapshotSource.id || customerId),
      name: text(snapshotSource.name),
      gstNumber: text(snapshotSource.gstNumber).toUpperCase(),
      address: text(snapshotSource.address),
      phone: text(snapshotSource.phone),
      email: text(snapshotSource.email),
      stateCode: text(snapshotSource.stateCode) || undefined,
    } : undefined,
  } as Invoice;
  return { value: recalculateInvoicePayments(value, normalizedPayments), warnings, errors };
}

export function validateDeliveryNote(input: Partial<DeliveryNote>): NormalizationResult<Partial<DeliveryNote>> {
  const errors: ValidationIssue[] = [];
  if (!text(input.id)) errors.push(issue('id', 'Document ID is required.', 'deliveryNote.id.required'));
  if (!text(input.deliveryNoteNumber || input.dnNumber)) errors.push(issue('deliveryNoteNumber', 'Delivery note number is required.', 'deliveryNote.number.required'));
  if (!text(input.date)) errors.push(issue('date', 'Delivery note date is required.', 'deliveryNote.date.required'));
  if (!text(input.customerId) && !text(input.customerSnapshot?.name)) errors.push(issue('customerId', 'Select a customer.', 'deliveryNote.customer.required'));
  if (!Array.isArray(input.items) || !input.items.some((item) => text(item.description || item.name) && finite(item.quantity) > 0)) {
    errors.push(issue('items', 'Add at least one valid goods row.', 'deliveryNote.items.required'));
  }
  return { value: { ...input }, warnings: [], errors };
}
