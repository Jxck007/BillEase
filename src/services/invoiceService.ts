import { AuditLog, AppSettings, BusinessProfile, Customer, Invoice, InvoiceItem, InvoiceTemplateId } from '../lib/types';
import { buildQrPlaceholder, calculateTaxBreakdown, getStateCodeFromGSTIN } from '../gst/gstService';
import { DEFAULT_TEMPLATE_VISIBILITY, TEMPLATE_PRESETS } from '../templates/invoiceTemplates';
import { digitsOnly, generateId, roundMoney, safeParseJson } from '../lib/utils';

const DRAFT_STORAGE_KEY = 'billease.invoiceDraft';

export function getDefaultSettings(profile: BusinessProfile): AppSettings {
  return {
    language: 'en',
    taxMode: 'exclusive',
    invoicePrefix: '',
    invoiceStartingNumber: 1,
    defaultTemplate: 'classic',
    template: {
      templateId: 'classic',
      ...TEMPLATE_PRESETS.classic,
    },
    businessStateCode: profile.stateCode || getStateCodeFromGSTIN(profile.gst),
    enableDrafts: true,
    enableAutosave: true,
    enableAuditLog: true,
    compactMode: false,
    whatsappCountryCode: '91',
    estimateDocumentLabel: 'estimate',
  };
}

export function buildDefaultInvoiceNumber(prefix: string, nextNumber: number, type: 'invoice' | 'estimate' = 'invoice') {
  const year = new Date().getFullYear();
  const fyStart = (year % 100).toString().padStart(2, '0');
  const fyEnd = ((year + 1) % 100).toString().padStart(2, '0');
  const serial = String(nextNumber).padStart(3, '0');
  const base = `${serial}/${fyStart}-${fyEnd}`;
  return type === 'estimate' ? `EST-${base}` : base;
}

export function getNextInvoiceNumber(invoices: Invoice[], prefix: string, type: 'invoice' | 'estimate' = 'invoice') {
  const latest = invoices
    .filter((invoice) => invoice.type === type)
    .map((invoice) => Number((invoice.invoiceNumber.match(/^(\d{1,})\//)?.[1] || '0')))
    .sort((left, right) => right - left)[0] || 0;
  return buildDefaultInvoiceNumber(prefix, latest + 1, type);
}

export function calculateInvoiceFromDraft(
  draft: Partial<Invoice>,
  profile: BusinessProfile,
  customer?: Customer
): Partial<Invoice> {
  const items = draft.items || [];
  const customerStateCode = customer?.stateCode || getStateCodeFromGSTIN(customer?.gstNumber);
  const businessStateCode = profile.stateCode || getStateCodeFromGSTIN(profile.gst);
  const totals = calculateTaxBreakdown(items, {
    customerStateCode,
    businessStateCode,
    gstMode: draft.gstMode || 'exclusive',
    shippingCharge: draft.shippingCharge || 0,
    adjustment: draft.adjustment || 0,
  });

  return {
    ...draft,
    items: totals.items,
    subtotal: totals.subtotal,
    taxableAmount: totals.taxableAmount,
    taxTotal: totals.totalTax,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    discountTotal: totals.discountTotal,
    roundOff: totals.roundOff,
    total: roundMoney(totals.grandTotal),
    qrCodeData: buildQrPlaceholder(
      { ...(draft as Invoice), total: totals.grandTotal, amountPaid: draft.amountPaid || 0, invoiceNumber: draft.invoiceNumber || '', items: totals.items as InvoiceItem[] } as Invoice,
      profile.name
    ),
  };
}

export function duplicateInvoice(source: Invoice, prefix: string, nextNumber: number): Partial<Invoice> {
  return {
    ...source,
    id: undefined,
    invoiceNumber: buildDefaultInvoiceNumber(prefix, nextNumber, source.type),
    date: new Date().toISOString().split('T')[0],
    dueDate: undefined,
    amountPaid: 0,
    status: 'unpaid',
    draft: true,
    qrCodeData: '',
    createdAt: new Date().toISOString(),
  };
}

export function buildAuditLog(entityType: AuditLog['entityType'], entityId: string, action: AuditLog['action'], message: string, meta?: Record<string, unknown>): AuditLog {
  return {
    id: generateId(),
    entityType,
    entityId,
    action,
    message,
    createdAt: new Date().toISOString(),
    meta,
  };
}

export function saveDraft(draft: Partial<Invoice>) {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft() {
  return safeParseJson<Partial<Invoice> | null>(localStorage.getItem(DRAFT_STORAGE_KEY), null);
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function sanitizePhone(phone: string) {
  return digitsOnly(phone);
}

export function selectTemplate(templateId: InvoiceTemplateId) {
  return {
    templateId,
    ...TEMPLATE_PRESETS[templateId],
    visibility: { ...DEFAULT_TEMPLATE_VISIBILITY, ...TEMPLATE_PRESETS[templateId].visibility },
  };
}
