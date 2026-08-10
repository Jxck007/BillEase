import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  calculateTaxBreakdown,
  formatGstState,
  getStateCodeFromGSTIN,
  resolvePlaceOfSupplyStateCode,
} from '../src/gst/gstService.js';
import { normalizeInvoice } from '../src/lib/entitySchemas.js';
import type { InvoiceItem } from '../src/lib/types.js';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const item = (taxRate: number): InvoiceItem => ({
  id: 'line-1', productId: '', name: 'Fictional taxable item', description: '', quantity: 1,
  price: 100, taxRate, discount: 0, discountType: 'percent', unit: 'Nos',
});

test('supplier 33 and Place of Supply 33 splits 18% into CGST 9% and SGST 9%', () => {
  const result = calculateTaxBreakdown([item(18)], { supplierStateCode: '33', placeOfSupplyStateCode: '33', taxMode: 'AUTO' });
  assert.equal(result.cgstTotal, 9);
  assert.equal(result.sgstTotal, 9);
  assert.equal(result.igstTotal, 0);
  assert.equal(result.totalTax, 18);
});

test('supplier 33 and Place of Supply 29 applies IGST 18%', () => {
  const result = calculateTaxBreakdown([item(18)], { supplierStateCode: '33', placeOfSupplyStateCode: '29', taxMode: 'AUTO' });
  assert.equal(result.cgstTotal, 0);
  assert.equal(result.sgstTotal, 0);
  assert.equal(result.igstTotal, 18);
  assert.equal(result.totalTax, 18);
});

test('supplier 33 and Place of Supply 33 splits 5% into 2.5% and 2.5%', () => {
  const result = calculateTaxBreakdown([item(5)], { supplierStateCode: '33', placeOfSupplyStateCode: '33', taxMode: 'AUTO' });
  assert.equal(result.cgstTotal, 2.5);
  assert.equal(result.sgstTotal, 2.5);
  assert.equal(result.igstTotal, 0);
});

test('GSTIN defaults Place of Supply only when the GSTIN and state prefix are valid', () => {
  assert.equal(getStateCodeFromGSTIN('33ABCDE1234F1Z5'), '33');
  assert.equal(resolvePlaceOfSupplyStateCode(undefined, { gstNumber: '33ABCDE1234F1Z5' }), '33');
  assert.equal(formatGstState('33'), 'Tamil Nadu (33)');
  assert.equal(getStateCodeFromGSTIN('29ABCDE1234F1Z5'), '29');
  assert.equal(resolvePlaceOfSupplyStateCode(undefined, { gstNumber: '29ABCDE1234F1Z5' }), '29');
  assert.equal(formatGstState('29'), 'Karnataka (29)');
  assert.equal(getStateCodeFromGSTIN('33INVALID'), '');
});

test('customer without GSTIN remains invoiceable and uses state/address/fallback priority', () => {
  assert.equal(resolvePlaceOfSupplyStateCode(undefined, { gstNumber: '', stateCode: '29' }), '29');
  assert.equal(resolvePlaceOfSupplyStateCode(undefined, { gstNumber: '', address: 'Bengaluru, Karnataka' }), '29');
  assert.equal(resolvePlaceOfSupplyStateCode(undefined, { gstNumber: '', address: '' }), '33');
  const result = calculateTaxBreakdown([item(18)], { supplierStateCode: '33', placeOfSupplyStateCode: '33', taxMode: 'AUTO' });
  assert.equal(result.grandTotal, 118);
});

test('manual IGST and CGST/SGST overrides remain authoritative', () => {
  const manualIgst = calculateTaxBreakdown([item(18)], { supplierStateCode: '33', placeOfSupplyStateCode: '33', taxMode: 'INTER_STATE' });
  assert.deepEqual([manualIgst.cgstTotal, manualIgst.sgstTotal, manualIgst.igstTotal], [0, 0, 18]);
  const manualSplit = calculateTaxBreakdown([item(18)], { supplierStateCode: '33', placeOfSupplyStateCode: '29', taxMode: 'INTRA_STATE' });
  assert.deepEqual([manualSplit.cgstTotal, manualSplit.sgstTotal, manualSplit.igstTotal], [9, 9, 0]);
});

test('paise allocation never applies CGST, SGST and IGST together or creates an extra paisa', () => {
  const oddPaiseItem = { ...item(5), price: 0.2 };
  for (const taxMode of ['AUTO', 'INTRA_STATE', 'INTER_STATE'] as const) {
    const result = calculateTaxBreakdown([oddPaiseItem], { supplierStateCode: '33', placeOfSupplyStateCode: '29', taxMode });
    assert.equal(result.totalTax, result.cgstTotal + result.sgstTotal + result.igstTotal);
    assert.equal(Boolean(result.igstTotal) && Boolean(result.cgstTotal || result.sgstTotal), false);
  }
});

test('historical invoice totals load exactly without adding the new tax fields', () => {
  const legacy = {
    id: 'historical-1', invoiceNumber: 'OLD-001', customerId: 'customer-1', date: '2025-01-01',
    items: [item(18)], subtotal: 100, taxableAmount: 100, taxTotal: 18,
    cgstTotal: 9, sgstTotal: 9, igstTotal: 0, discountTotal: 0, total: 118,
    payments: [], amountPaid: 0, balanceDue: 118, paymentStatus: 'unpaid', status: 'unpaid',
    notes: '', terms: '', createdAt: '2025-01-01T00:00:00.000Z', type: 'invoice',
  };
  const normalized = normalizeInvoice(legacy).value!;
  assert.deepEqual(
    [normalized.taxTotal, normalized.cgstTotal, normalized.sgstTotal, normalized.igstTotal, normalized.total],
    [18, 9, 9, 0, 118],
  );
  assert.equal(normalized.placeOfSupplyStateCode, undefined);
  assert.equal(normalized.taxMode, undefined);
});

test('editor, preview, PDF, print, email, native share, copies, English and Tamil share one tax-aware document DOM', () => {
  const editor = source('src/pages/InvoiceForm.tsx');
  assert.match(editor, /GST and Place of Supply/);
  assert.match(editor, /value="AUTO"/);
  assert.match(editor, /value="INTRA_STATE"/);
  assert.match(editor, /value="INTER_STATE"/);
  assert.match(editor, /Tax calculation has been manually overridden/);
  assert.match(editor, /மாநிலத்திற்குள் — CGST \+ SGST/);
  assert.match(editor, /மாநிலங்களுக்கு இடையே — IGST/);

  const invoiceTemplate = source('src/components/invoices/TraditionalTaxInvoice.tsx');
  const quotationTemplate = source('src/templates/QuotationEstimateTemplate.tsx');
  for (const template of [invoiceTemplate, quotationTemplate]) {
    assert.match(template, /Place of Supply/);
    assert.match(template, /Tax Type/);
    assert.match(template, /getDocumentTaxRateLabel/);
  }
  assert.match(invoiceTemplate, /hasGstSupplyModel \? getDocumentTaxRateLabel\(invoice, 'CGST'\)/);
  assert.match(invoiceTemplate, /hasGstSupplyModel \? getDocumentTaxRateLabel\(invoice, 'SGST'\)/);

  const preview = source('src/pages/InvoicePreview.tsx');
  assert.match(preview, /CanonicalDocumentViewport/);
  assert.match(preview, /CanonicalInvoiceDocument/);
  assert.match(preview, /QuotationEstimateTemplate/);
  const exportPanel = source('src/components/export/ExportPanel.tsx');
  assert.match(exportPanel, /exportRootRef/);
  assert.match(exportPanel, /preparePdfShareFile/);
  assert.match(exportPanel, /DocumentDeliveryModal/);
  assert.match(exportPanel, /onPrint/);
  assert.match(invoiceTemplate, /copyLabel \|\| invoice\.copyType/);
});
