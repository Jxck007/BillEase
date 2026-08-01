import { AppSettings, EstimateDocumentLabel, Invoice, InvoiceItem, Language, Product } from './types';

export const ESTIMATE_COPY_TYPES = [
  { value: 'ORIGINAL COPY', label: 'Original Copy' },
  { value: 'CUSTOMER COPY', label: 'Customer Copy' },
  { value: 'OFFICE COPY', label: 'Office Copy' },
  { value: 'DUPLICATE COPY', label: 'Duplicate Copy' },
] as const;

export type EstimateCopyTypeValue = (typeof ESTIMATE_COPY_TYPES)[number]['value'];

export function normalizeEstimateCopyType(value?: string): EstimateCopyTypeValue {
  switch (value) {
    case 'ORIGINAL COPY':
    case 'Original Copy':
      return 'ORIGINAL COPY';
    case 'CUSTOMER COPY':
    case 'Customer Copy':
      return 'CUSTOMER COPY';
    case 'OFFICE COPY':
    case 'Office Copy':
      return 'OFFICE COPY';
    case 'DUPLICATE COPY':
    case 'Duplicate Copy':
      return 'DUPLICATE COPY';
    default:
      return 'ORIGINAL COPY';
  }
}

export function formatEstimateCopyTypeDisplay(value?: string) {
  return normalizeEstimateCopyType(value).replace(/\s+/g, ' ');
}

export function getEstimateDocumentLabel(settings: AppSettings): EstimateDocumentLabel {
  return settings.estimateDocumentLabel === 'quotation' ? 'quotation' : 'estimate';
}

export function getEstimateDocumentTitle(settings: AppSettings) {
  return getEstimateDocumentLabel(settings) === 'quotation' ? 'QUOTATION' : 'ESTIMATE';
}

export function getEstimateDocumentName(settings: AppSettings, language: Language = 'en') {
  if (getEstimateDocumentLabel(settings) === 'quotation') {
    return language === 'en' ? 'Quotation' : 'விலைமதிப்பீடு';
  }
  return language === 'en' ? 'Estimate' : 'மதிப்பீடு';
}

export function getEstimateNumberLabel(settings: AppSettings) {
  return getEstimateDocumentLabel(settings) === 'quotation' ? 'Quotation No' : 'Estimate No';
}

export function getEstimatesNavLabel(settings: AppSettings, language: Language = 'en') {
  if (getEstimateDocumentLabel(settings) === 'quotation') {
    return language === 'en' ? 'Quotations' : 'விலைமதிப்பீடுகள்';
  }
  return language === 'en' ? 'Estimates' : 'மதிப்பீடுகள்';
}

export function getEstimateLineAmount(item: InvoiceItem) {
  const base = (item.quantity || 0) * (item.price || 0);
  const discount = item.discountType === 'flat'
    ? (item.discount || 0)
    : (base * (item.discount || 0)) / 100;
  return Math.max(0, base - discount);
}

export function getEstimateItemUnit(item: InvoiceItem, products: Product[]) {
  if (item.unit?.trim()) return item.unit.trim();
  const product = products.find((entry) => entry.id === item.productId);
  return product?.unit || 'Nos';
}

export function numberToWordsIndian(num: number) {
  if (num === 0) return 'zero';
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const words = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ` ${a[n % 10]}` : '');
    if (n < 1000) return `${a[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ''}`;
    return '';
  };

  let n = Math.floor(num);
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  if (crore) { parts.push(`${words(crore)} crore`); n %= 10000000; }
  const lakh = Math.floor(n / 100000);
  if (lakh) { parts.push(`${words(lakh)} lakh`); n %= 100000; }
  const thousand = Math.floor(n / 1000);
  if (thousand) { parts.push(`${words(thousand)} thousand`); n %= 1000; }
  if (n) parts.push(words(n));
  return parts.join(' ');
}

export function getEstimateAmountInWords(invoice: Invoice) {
  return `${numberToWordsIndian(Math.floor(invoice.total || 0))} rupees only`;
}

export function isEstimateRecord(invoice: Invoice) {
  return invoice.type === 'estimate';
}
