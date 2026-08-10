import { Customer, GstTaxMode, Invoice, InvoiceItem, TaxMode } from '../lib/types';
import { roundMoney } from '../lib/utils';
import { fromPaise, toPaise } from '../services/paymentService';

export const INDIAN_GST_STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'],
  ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'],
  ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'],
  ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'],
  ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'],
  ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'], ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory'],
] as const;

const indianStateCodes: Record<string, string> = Object.fromEntries(INDIAN_GST_STATES);
const legacyIndianStateCodes: Record<string, string> = {
  '25': 'Daman and Diu',
  '28': 'Andhra Pradesh',
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
  const code = normalized.slice(0, 2);
  return validateGSTIN(normalized) && indianStateCodes[code] ? code : '';
}

export function getStateNameFromCode(code?: string) {
  if (!code) return '';
  return indianStateCodes[code] || legacyIndianStateCodes[code] || code;
}

export function isValidGstStateCode(code?: string) {
  return Boolean(code && indianStateCodes[code]);
}

export function formatGstState(code?: string) {
  return code && isValidGstStateCode(code) ? `${getStateNameFromCode(code)} (${code})` : '';
}

export function getStateCodeFromName(name?: string) {
  const normalized = (name || '').trim().toLowerCase();
  return INDIAN_GST_STATES.find(([, stateName]) => stateName.toLowerCase() === normalized)?.[0] || '';
}

function getStateCodeFromAddress(address?: string) {
  const normalized = (address || '').toLowerCase().replace(/[^a-z\s]/g, ' ');
  if (!normalized.trim()) return '';
  const match = [...INDIAN_GST_STATES]
    .sort((left, right) => right[1].length - left[1].length)
    .find(([, name]) => normalized.includes(name.toLowerCase()));
  return match?.[0] || '';
}

export function resolveSupplierStateCode(profileStateCode?: string, gstin?: string) {
  return isValidGstStateCode(profileStateCode) ? profileStateCode! : getStateCodeFromGSTIN(gstin) || '33';
}

export function resolvePlaceOfSupplyStateCode(
  savedStateCode?: string,
  customer?: Partial<Pick<Customer, 'gstNumber' | 'gstin' | 'stateCode' | 'address' | 'shippingAddress' | 'useDifferentShippingAddress'>>,
  fallback = '33',
) {
  if (isValidGstStateCode(savedStateCode)) return savedStateCode!;
  const gstinCode = getStateCodeFromGSTIN(customer?.gstNumber || customer?.gstin);
  if (gstinCode) return gstinCode;
  if (isValidGstStateCode(customer?.stateCode)) return customer!.stateCode!;
  const addressCode = getStateCodeFromAddress(customer?.useDifferentShippingAddress
    ? customer.shippingAddress || customer.address
    : customer?.address || customer?.shippingAddress);
  return addressCode || (isValidGstStateCode(fallback) ? fallback : '33');
}

export function resolveGstTaxMode(taxMode: GstTaxMode = 'AUTO', supplierStateCode = '33', placeOfSupplyStateCode = '33') {
  if (taxMode === 'INTRA_STATE' || taxMode === 'INTER_STATE') return taxMode;
  return supplierStateCode === placeOfSupplyStateCode ? 'INTRA_STATE' : 'INTER_STATE';
}

export function inferHistoricalGstTaxMode(
  invoice: Pick<Invoice, 'taxMode' | 'cgstTotal' | 'sgstTotal' | 'igstTotal' | 'supplierStateCode' | 'placeOfSupplyStateCode'>,
  supplierFallback = '33',
) {
  if (invoice.taxMode) return resolveGstTaxMode(invoice.taxMode, invoice.supplierStateCode || supplierFallback, invoice.placeOfSupplyStateCode || supplierFallback);
  if ((invoice.igstTotal || 0) > 0) return 'INTER_STATE';
  if ((invoice.cgstTotal || 0) > 0 || (invoice.sgstTotal || 0) > 0) return 'INTRA_STATE';
  if (invoice.placeOfSupplyStateCode) return resolveGstTaxMode('AUTO', invoice.supplierStateCode || supplierFallback, invoice.placeOfSupplyStateCode);
  return 'INTRA_STATE';
}

export function getDocumentTaxRateLabel(invoice: Pick<Invoice, 'items'>, part: 'CGST' | 'SGST' | 'IGST') {
  const rates = Array.from(new Set((invoice.items || []).map((item) => Number(item.taxRate || 0)).filter((rate) => rate > 0)));
  if (rates.length !== 1) return part;
  const rate = part === 'IGST' ? rates[0] : rates[0] / 2;
  const formatted = Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${part} @ ${formatted}%`;
}

export function calculateTaxBreakdown(
  items: InvoiceItem[],
  options: {
    customerStateCode?: string;
    businessStateCode?: string;
    placeOfSupplyStateCode?: string;
    supplierStateCode?: string;
    taxMode?: GstTaxMode;
    gstMode?: TaxMode;
    shippingCharge?: number;
    adjustment?: number;
  } = {}
): TaxBreakdown {
  const gstMode = options.gstMode || 'exclusive';
  const shippingCharge = roundMoney(options.shippingCharge || 0);
  const adjustment = roundMoney(options.adjustment || 0);
  const supplierStateCode = options.supplierStateCode || options.businessStateCode || '33';
  const placeOfSupplyStateCode = options.placeOfSupplyStateCode || options.customerStateCode || supplierStateCode;
  const effectiveTaxMode = resolveGstTaxMode(options.taxMode || 'AUTO', supplierStateCode, placeOfSupplyStateCode);

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
    const itemTaxPaise = toPaise(itemTax);
    const cgstPaise = effectiveTaxMode === 'INTRA_STATE' ? Math.floor(itemTaxPaise / 2) : 0;
    const sgstPaise = effectiveTaxMode === 'INTRA_STATE' ? itemTaxPaise - cgstPaise : 0;
    const cgst = fromPaise(cgstPaise);
    const sgst = fromPaise(sgstPaise);
    const igst = effectiveTaxMode === 'INTER_STATE' ? fromPaise(itemTaxPaise) : 0;

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
