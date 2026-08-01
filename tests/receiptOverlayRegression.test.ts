import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('receipt replaces invoice full screen and remains one dialog', () => {
  const invoice = source('src/pages/InvoicePreview.tsx');
  const viewport = source('src/components/documents/CanonicalDocumentViewport.tsx');
  const receipt = source('src/components/payments/PaymentReceiptModal.tsx');
  assert.match(invoice, /billease:close-document-fullscreen/);
  assert.match(viewport, /billease:document-fullscreen-closed/);
  assert.match(receipt, /containedFullScreen/);
  assert.doesNotMatch(receipt, /<Modal[\s\S]*<Modal/);
});

test('shared overlay stack owns inert state, escape, focus restoration and scroll locking', () => {
  const overlay = source('src/hooks/useAccessibleOverlay.ts');
  assert.match(overlay, /overlayStack\.at\(-1\)/);
  assert.match(overlay, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(overlay, /entry\.restoreFocus\?\.focus/);
  assert.match(overlay, /event\.key === 'Escape'/);
  assert.match(overlay, /event\.key !== 'Tab'/);
});

test('receipt actions remain available in receipt full screen', () => {
  const receipt = source('src/components/payments/PaymentReceiptModal.tsx');
  assert.match(receipt, /fullScreen \? .*Close Full Screen/s);
  assert.match(receipt, /Download \/ share/);
  assert.match(receipt, /setExportOpen\(true\)/);
  assert.match(receipt, /billEaseReceipt: 'modal'/);
  assert.match(receipt, /billEaseReceipt: 'fullscreen'/);
  assert.match(receipt, /window\.history\.back\(\)/);
  assert.match(receipt, /popstate/);
});

test('receipt authorization images retain aspect ratio and bounded print dimensions', () => {
  const css = source('src/index.css');
  assert.match(css, /receipt-print-page \.company-seal[\s\S]*max-width: 26mm[\s\S]*max-height: 26mm[\s\S]*object-fit: contain/);
  assert.match(css, /receipt-print-page \.company-signature[\s\S]*max-width: 42mm[\s\S]*max-height: 20mm[\s\S]*object-fit: contain/);
  assert.match(source('src/components/documents/InvoiceAuthorizationAssets.tsx'), /if \(!src \|\| failed\) return null/);
});
