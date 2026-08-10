export type Language = 'en' | 'ta';
export type TaxMode = 'exclusive' | 'inclusive';
export type GstTaxMode = 'AUTO' | 'INTRA_STATE' | 'INTER_STATE';
export type GstTaxModeSource = 'automatic' | 'manual';
export type InvoiceType = 'invoice' | 'estimate';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
// Legacy values are retained only so existing saved invoices/settings continue to load.
// New invoices always use the single canonical document.
export type InvoiceTemplateId = 'canonical' | 'classic' | 'modern' | 'thermal' | 'wholesale' | 'minimal';
export type DiscountType = 'flat' | 'percent';
export type PaymentMethod = 'cash' | 'UPI' | 'bank_transfer' | 'cheque' | 'card' | 'other';
export type PaymentEntryKind = 'payment' | 'reversal';

export interface AuditLog {
  id: string;
  entityType: 'customer' | 'product' | 'invoice' | 'payment' | 'receipt' | 'expense' | 'profile' | 'settings' | 'deliveryNote';
  entityId: string;
  action: 'created' | 'updated' | 'deleted' | 'draft-saved' | 'draft-restored' | 'duplicated' | 'recorded' | 'reversed' | 'cancelled' | 'recalculated' | 'generated';
  message: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  billingPin?: string;
  shippingAddress?: string;
  shippingPin?: string;
  useDifferentShippingAddress?: boolean;
  gstin?: string;
  gstNumber?: string;
  stateCode?: string;
  whatsapp?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface CustomerSnapshot {
  id: string;
  name: string;
  gstNumber: string;
  address: string;
  phone: string;
  email: string;
  stateCode?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  taxRate: number;
  hsnSac?: string;
  stock?: number;
  isService?: boolean;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  hsnSac?: string;
  unit?: string;
  quantity: number;
  price: number;
  taxRate: number; // percentage
  discount: number; // flat
  discountType?: DiscountType;
}

export interface CustomerFieldVisibility {
  address: boolean;
  phone: boolean;
  email: boolean;
  gstNumber: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerSnapshot?: CustomerSnapshot;
  date: string;
  dueDate?: string;
  poNumber?: string;
  poDate?: string;
  poMode?: string;
  copyType?: 'ORIGINAL COPY' | 'DUPLICATE COPY' | 'TRANSPORT COPY' | 'EXTRA COPY' | 'CUSTOMER COPY' | 'OFFICE COPY';
  placeOfSupply?: string;
  placeOfSupplyStateCode?: string;
  placeOfSupplySource?: 'automatic' | 'manual';
  supplierStateCode?: string;
  taxMode?: GstTaxMode;
  taxModeSource?: GstTaxModeSource;
  taxOverrideReason?: string;
  reverseCharge?: boolean;
  gstMode?: TaxMode;
  templateId?: InvoiceTemplateId;
  draft?: boolean;
  items: InvoiceItem[];
  subtotal: number;
  taxableAmount: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  discountTotal: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  paymentStatusPdfVisibility?: 'default' | 'show' | 'hide';
  /** @deprecated Read-only compatibility mirror for older UI/data. */
  status: 'paid' | 'unpaid' | 'partial' | 'overdue' | 'cancelled';
  payments: Payment[];
  lastPaymentAt?: string;
  notes: string;
  terms: string;
  signatureName?: string;
  customerFieldVisibility?: CustomerFieldVisibility;
  qrCodeData?: string;
  createdAt: string;
  updatedAt?: string;
  type: InvoiceType;
  deletedAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  notes: string;
  reference?: string;
  createdAt: string;
  createdBy: string;
  operationId: string;
  kind: PaymentEntryKind;
  originalPaymentId?: string;
  reason?: string;
  /** @deprecated Compatibility value for payment records saved before paidAt. */
  date?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
}

export interface BusinessProfile {
  name: string;
  address: string;
  pinCode?: string;
  phone: string;
  email: string;
  gst: string;
  stateCode?: string;
  logo: string;
  qrCodeImage?: string;
  bankDetails?: string;
  msmeNumber?: string;
  upiId?: string;
  upiPayeeName?: string;
  upiPaymentNote?: string;
  enableUpiQr?: boolean;
  showUpiQrOnInvoice?: boolean;
  showUpiAmount?: boolean;
  paymentQrImage?: string;
  tagline?: string;
}

export interface TemplateVisibilitySettings {
  logo: boolean;
  gstNumber: boolean;
  address: boolean;
  phoneEmail: boolean;
  discountColumn: boolean;
  hsnSac: boolean;
  taxBreakdown: boolean;
  signature: boolean;
  terms: boolean;
  qrCode: boolean;
  bankDetails: boolean;
}

export interface TemplateCustomization {
  templateId: InvoiceTemplateId;
  themeColor: string;
  fontFamily: string;
  footerText: string;
  headerAlignment: 'left' | 'center' | 'right';
  visibility: TemplateVisibilitySettings;
}

export type EstimateDocumentLabel = 'estimate' | 'quotation';

export interface AppSettings {
  language: Language;
  taxMode: TaxMode;
  invoicePrefix: string;
  invoiceStartingNumber: number;
  defaultTemplate: InvoiceTemplateId;
  template: TemplateCustomization;
  businessStateCode: string;
  enableDrafts: boolean;
  enableAutosave: boolean;
  enableAuditLog: boolean;
  compactMode: boolean;
  whatsappCountryCode: string;
  estimateDocumentLabel: EstimateDocumentLabel;
  integrations: {
    serverEmail: boolean;
    pinLookup: boolean;
    authorizedSignature: boolean;
    gstVerification: false;
    barcodeScanner: false;
    ocrImport: false;
    aiQuickActions: false;
  };
  signatureVisibility: { invoice: boolean; quotation: boolean; deliveryNote: boolean };
  sealVisibility: { invoice: boolean; quotation: boolean; deliveryNote: boolean };
  emailCcBusiness: boolean;
  showPaymentSummaryOnPdf?: boolean;
  showPaymentStatusOnInvoicePdf?: boolean;
}

export interface DeliveryNoteItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  remarks?: string;
  productId?: string;
  name?: string;
  purpose?: string;
  hsnSac?: string;
  price?: number;
  taxRate?: number;
  amount?: number;
}

export interface DeliveryNote {
  id: string;
  dnNumber?: string;
  deliveryNoteNumber: string;
  date: string;
  copyType:
    | 'ORIGINAL FOR CONSIGNEE'
    | 'DUPLICATE FOR TRANSPORTER'
    | 'TRIPLICATE FOR SUPPLIER'
    | 'TRIPLICATE FOR CONSIGNOR'
    | 'Original for Consignee'
    | 'Duplicate for Transporter'
    | 'Triplicate for Consignor'
    | 'Duplicate'
    | 'Triplicate';
  transportPurpose: string;
  fromPlace: string;
  toPlace: string;
  vehicleNumber: string;
  approximateValue: number;
  ewayBillNumber?: string;
  ewayBillDate?: string;
  referenceNumber?: string;
  referenceDate?: string;
  buyersOrderNumber?: string;
  buyersOrderDate?: string;
  dispatchDocNumber?: string;
  dispatchedThrough?: string;
  destination?: string;
  billOfLadingNumber?: string;
  motorVehicleNumber?: string;
  modeOfPayment?: string;
  otherReferences?: string;
  termsOfDelivery?: string;
  consigneeId: string;
  buyerId?: string;
  customerId: string;
  customerSnapshot?: CustomerSnapshot;
  items: DeliveryNoteItem[];
  subtotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  total: number;
  amountInWords: string;
  status: 'draft' | 'delivered';
  notes?: string;
  remarks?: string;
  draft?: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface AppState {
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  deliveryNotes: DeliveryNote[];
  auditLogs: AuditLog[];
  profile: BusinessProfile;
  settings: AppSettings;
}
