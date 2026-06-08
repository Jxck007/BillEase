import { Customer, DeliveryNote, DeliveryNoteItem } from './types';

export const DELIVERY_NOTE_COPY_TYPES = [
  'Original for Consignee',
  'Duplicate for Transporter',
  'Triplicate for Consignor',
] as const;

export type DeliveryNoteCopyType = (typeof DELIVERY_NOTE_COPY_TYPES)[number];

export const DELIVERY_NOTE_TRANSPORT_PURPOSES = [
  'Sale',
  'Purchase',
  'Shipment',
  'Branch Office',
  'Labour Work',
  'Cutting',
  'Other',
] as const;

export const DEFAULT_DELIVERY_NOTE_VALUES = {
  transportPurpose: '',
  fromPlace: '',
  toPlace: '',
  vehicleNumber: '',
  approximateValue: 0,
  subtotal: 0,
  taxTotal: 0,
  cgstTotal: 0,
  sgstTotal: 0,
  igstTotal: 0,
  total: 0,
  amountInWords: '',
  notes: '',
  remarks: '',
} as const;

export function normalizeDeliveryNoteCopyType(value?: string): DeliveryNoteCopyType {
  switch (value) {
    case 'ORIGINAL FOR CONSIGNEE':
    case 'Original for Consignee':
      return 'Original for Consignee';
    case 'DUPLICATE FOR TRANSPORTER':
    case 'Duplicate for Transporter':
    case 'Duplicate':
      return 'Duplicate for Transporter';
    case 'TRIPLICATE FOR SUPPLIER':
    case 'TRIPLICATE FOR CONSIGNOR':
    case 'Triplicate for Consignor':
    case 'Triplicate':
      return 'Triplicate for Consignor';
    default:
      return 'Original for Consignee';
  }
}

export function formatDeliveryNoteCopyTypeDisplay(value?: string) {
  switch (normalizeDeliveryNoteCopyType(value)) {
    case 'Original for Consignee':
      return 'ORIGINAL FOR CONSIGNEE';
    case 'Duplicate for Transporter':
      return 'DUPLICATE FOR TRANSPORTER';
    case 'Triplicate for Consignor':
      return 'TRIPLICATE FOR CONSIGNOR';
    default:
      return 'ORIGINAL FOR CONSIGNEE';
  }
}

export function getCustomerGstin(customer?: Customer | null) {
  return customer?.gstin || customer?.gstNumber || '';
}

export function normalizeCustomerRecord(customer: Customer): Customer {
  const gstin = customer.gstin || customer.gstNumber || '';
  return {
    ...customer,
    phone: customer.phone || '',
    email: customer.email || '',
    gstin,
    gstNumber: customer.gstNumber || gstin,
  };
}

  export function normalizeTransportPurpose(value?: string) {
    if (!value) return '';
    if (value === 'Branch Transfer') return 'Branch Office';
    if ((DELIVERY_NOTE_TRANSPORT_PURPOSES as readonly string[]).includes(value)) return value;
    return value;
  }

export function normalizeDeliveryNoteItem(item: Partial<DeliveryNoteItem> & Record<string, unknown> = {}): DeliveryNoteItem {
  const description = String(item.description || item.name || '');
  return {
    id: typeof item.id === 'string' && item.id ? item.id : undefined,
    description,
    quantity: Number(item.quantity || 0),
    unit: String(item.unit || 'Nos'),
    remarks: typeof item.remarks === 'string' && item.remarks.trim() ? item.remarks : typeof item.purpose === 'string' && item.purpose.trim() ? item.purpose : undefined,
    productId: typeof item.productId === 'string' ? item.productId : undefined,
    name: typeof item.name === 'string' ? item.name : undefined,
    purpose: typeof item.purpose === 'string' ? item.purpose : undefined,
    hsnSac: typeof item.hsnSac === 'string' ? item.hsnSac : undefined,
    price: typeof item.price === 'number' ? item.price : Number(item.price || 0),
    taxRate: typeof item.taxRate === 'number' ? item.taxRate : Number(item.taxRate || 0),
    amount: typeof item.amount === 'number' ? item.amount : Number(item.amount || 0),
  };
}

export function normalizeDeliveryNote(note: Partial<DeliveryNote> & Record<string, unknown>): DeliveryNote {
  const deliveryNoteNumber = String(note.deliveryNoteNumber || note.dnNumber || '');
  const items = Array.isArray(note.items) ? note.items.map((item) => normalizeDeliveryNoteItem(item as Partial<DeliveryNoteItem>)) : [];
    const transportPurpose = normalizeTransportPurpose(String(note.transportPurpose || ''));
    const fromPlace = String(note.fromPlace || '');
    const toPlace = String(note.toPlace || '');
  const vehicleNumber = String(note.vehicleNumber || '');
  const approximateValue = Number(note.approximateValue || 0);
  return {
    id: String(note.id || ''),
    dnNumber: String(note.dnNumber || deliveryNoteNumber),
    deliveryNoteNumber,
    date: String(note.date || new Date().toISOString().split('T')[0]),
    copyType: normalizeDeliveryNoteCopyType(note.copyType as string),
    transportPurpose,
    fromPlace,
    toPlace,
    vehicleNumber,
    approximateValue,
    ewayBillNumber: typeof note.ewayBillNumber === 'string' ? note.ewayBillNumber : undefined,
    ewayBillDate: typeof note.ewayBillDate === 'string' ? note.ewayBillDate : undefined,
    referenceNumber: typeof note.referenceNumber === 'string' ? note.referenceNumber : undefined,
    referenceDate: typeof note.referenceDate === 'string' ? note.referenceDate : undefined,
    buyersOrderNumber: typeof note.buyersOrderNumber === 'string' ? note.buyersOrderNumber : undefined,
    buyersOrderDate: typeof note.buyersOrderDate === 'string' ? note.buyersOrderDate : undefined,
    dispatchDocNumber: typeof note.dispatchDocNumber === 'string' ? note.dispatchDocNumber : undefined,
    dispatchedThrough: typeof note.dispatchedThrough === 'string' ? note.dispatchedThrough : undefined,
    destination: typeof note.destination === 'string' ? note.destination : undefined,
    billOfLadingNumber: typeof note.billOfLadingNumber === 'string' ? note.billOfLadingNumber : undefined,
    motorVehicleNumber: typeof note.motorVehicleNumber === 'string' ? note.motorVehicleNumber : undefined,
    modeOfPayment: typeof note.modeOfPayment === 'string' ? note.modeOfPayment : undefined,
    otherReferences: typeof note.otherReferences === 'string' ? note.otherReferences : undefined,
    termsOfDelivery: typeof note.termsOfDelivery === 'string' ? note.termsOfDelivery : undefined,
    consigneeId: String(note.consigneeId || note.customerId || ''),
    buyerId: typeof note.buyerId === 'string' ? note.buyerId : undefined,
    customerId: String(note.customerId || note.consigneeId || ''),
    items,
    subtotal: Number(note.subtotal || 0),
    taxTotal: Number(note.taxTotal || 0),
    cgstTotal: Number(note.cgstTotal || 0),
    sgstTotal: Number(note.sgstTotal || 0),
    igstTotal: Number(note.igstTotal || 0),
    total: Number(note.total || approximateValue || 0),
    amountInWords: String(note.amountInWords || ''),
    status: (note.status as DeliveryNote['status']) || 'draft',
    notes: typeof note.notes === 'string' ? note.notes : '',
    remarks: typeof note.remarks === 'string' ? note.remarks : '',
    draft: Boolean(note.draft),
    createdAt: String(note.createdAt || new Date().toISOString()),
  };
}