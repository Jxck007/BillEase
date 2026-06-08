import { Invoice, InvoiceItem, TaxMode } from '../lib/types';
import { roundMoney } from '../lib/utils';

const indianStateCodes: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
};

export interface TaxBreakdown {
  subtotal: number;
  taxableAmount: number;
  discountTotal: number;
  shippingCharge: number;
  adjustment: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  items: Array<InvoiceItem & { lineTotal: number; taxableValue: number; cgst: number; sgst: number; igst: number }>;
}

export function validateGSTIN(gstin: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(gstin.replace(/\s+/g, '').toUpperCase());
}

export function normalizeGSTIN(gstin?: string) {
  return gstin ? gstin.replace(/\s+/g, '').toUpperCase() : '';
}

export function getStateCodeFromGSTIN(gstin?: string) {
  const normalized = normalizeGSTIN(gstin);
  return normalized.length >= 2 ? normalized.slice(0, 2) : '';
}

export function getStateNameFromCode(code?: string) {
  if (!code) return '';
  return indianStateCodes[code] || code;
}

export function calculateTaxBreakdown(
  items: InvoiceItem[],
  options: {
    customerStateCode?: string;
    businessStateCode?: string;
    gstMode?: TaxMode;
    shippingCharge?: number;
    adjustment?: number;
  } = {}
): TaxBreakdown {
  const gstMode = options.gstMode || 'exclusive';
  const shippingCharge = roundMoney(options.shippingCharge || 0);
  const adjustment = roundMoney(options.adjustment || 0);

  let subtotal = 0;
  let taxableAmount = 0;
  let discountTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const taxedItems = items.map((item) => {
    const baseValue = roundMoney(item.quantity * item.price);
    const discountValue = item.discountType === 'flat'
      ? roundMoney(item.discount || 0)
      : roundMoney((baseValue * (item.discount || 0)) / 100);
    const discountedBase = Math.max(0, roundMoney(baseValue - discountValue));
    const taxableValue = gstMode === 'inclusive'
      ? roundMoney(discountedBase * 100 / (100 + (item.taxRate || 0)))
      : discountedBase;
    const lineTaxableValue = Math.max(0, taxableValue);
    const itemTax = gstMode === 'inclusive'
      ? roundMoney(discountedBase - lineTaxableValue)
      : roundMoney((lineTaxableValue * item.taxRate) / 100);
    const sameState = options.customerStateCode && options.businessStateCode && options.customerStateCode === options.businessStateCode;
    const cgst = sameState ? roundMoney(itemTax / 2) : 0;
    const sgst = sameState ? roundMoney(itemTax / 2) : 0;
    const igst = sameState ? 0 : itemTax;

    subtotal += baseValue;
    taxableAmount += lineTaxableValue;
    discountTotal += discountValue;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;

    return {
      ...item,
      lineTotal: baseValue,
      taxableValue: lineTaxableValue,
      cgst,
      sgst,
      igst,
    };
  });

  const totalTax = roundMoney(cgstTotal + sgstTotal + igstTotal);
  const computedTotal = roundMoney(taxableAmount + totalTax + shippingCharge + adjustment);
  const roundedTotal = roundMoney(Math.round(computedTotal));
  const roundOff = roundMoney(roundedTotal - computedTotal);

  return {
    subtotal: roundMoney(subtotal),
    taxableAmount: roundMoney(taxableAmount),
    discountTotal: roundMoney(discountTotal),
    shippingCharge,
    adjustment,
    cgstTotal: roundMoney(cgstTotal),
    sgstTotal: roundMoney(sgstTotal),
    igstTotal: roundMoney(igstTotal),
    totalTax,
    roundOff,
    grandTotal: roundedTotal,
    items: taxedItems,
  };
}

export function buildQrPlaceholder(invoice: Invoice, businessName: string) {
  return JSON.stringify({
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.total,
    paid: invoice.amountPaid,
    balance: roundMoney(invoice.total - invoice.amountPaid),
    businessName,
  });
}