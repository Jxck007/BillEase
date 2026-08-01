import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Fit Content includes the final footer while export removes the screen-only compact class', () => {
  const viewport = source('src/components/documents/CanonicalDocumentViewport.tsx');
  const exportService = source('src/services/exportService.ts');
  assert.match(viewport, /preview-fit-content/);
  assert.match(viewport, /viewMode === 'content'/);
  assert.match(viewport, /document-final-footer/);
  assert.match(exportService, /classList\.remove\('preview-fit-content'\)/);
});

test('A4 authorization and footer are one protected final-page group with spacer before it', () => {
  const template = source('src/components/invoices/TraditionalTaxInvoice.tsx');
  const spacer = template.indexOf('document-flex-spacer');
  const group = template.indexOf('document-authorization-group');
  const footer = template.indexOf('<ComputerGeneratedFooter />', group);
  assert.ok(spacer >= 0 && spacer < group && group < footer);
  assert.match(source('src/index.css'), /document-authorization-group[\s\S]*break-inside: avoid/);
  assert.match(source('src/services/exportService.ts'), /finalGroup \|\| footer/);
});

test('payment status display defaults off and supports company and invoice overrides', () => {
  assert.match(source('src/services/invoiceService.ts'), /showPaymentStatusOnInvoicePdf: false/);
  assert.match(source('src/pages/Settings.tsx'), /Show payment status on invoice PDF/);
  assert.match(source('src/pages/InvoiceForm.tsx'), /Use company default/);
  assert.match(source('src/pages/InvoiceForm.tsx'), /paymentStatusPdfVisibility/);
  const preview = source('src/pages/InvoicePreview.tsx');
  assert.match(preview, /paymentStatusPdfVisibility === 'show'/);
  assert.match(preview, /paymentStatusPdfVisibility !== 'hide'/);
  assert.match(source('src/pages/Invoices.tsx'), /showPaymentStatus={showPaymentStatus}/);
});

test('customer PDF uses a compact professional status badge only when enabled', () => {
  const template = source('src/components/invoices/TraditionalTaxInvoice.tsx');
  const css = source('src/index.css');
  assert.match(template, /showPaymentStatus \? <span className={`payment-status-badge/);
  assert.doesNotMatch(template, /className="paid-badge"/);
  assert.match(css, /payment-status-badge[\s\S]*font-size: 9px/);
  assert.doesNotMatch(css, /payment-status-badge[^}]*transform:/);
});
