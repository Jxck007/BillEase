import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared overlays expose dialog semantics and isolate background focus', () => {
  const modal = source('src/components/ui/Modal.tsx');
  const overlay = source('src/hooks/useAccessibleOverlay.ts');
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby/);
  assert.match(modal, /createPortal/);
  assert.match(overlay, /element\.inert = true/);
  assert.match(overlay, /event\.key !== 'Tab'/);
  assert.match(overlay, /previouslyFocused\?\.focus/);
});

test('mobile drawer is only mounted while open and uses shared focus isolation', () => {
  const drawer = source('src/components/layout/Sidebar.tsx');
  assert.match(drawer, /mobileOpen && typeof document/);
  assert.match(drawer, /useAccessibleOverlay/);
  assert.match(drawer, /aria-modal="true"/);
});

test('settings fields programmatically connect visible labels to controls', () => {
  const settings = source('src/pages/Settings.tsx');
  assert.match(settings, /aria-labelledby/);
  assert.match(settings, /useId/);
  assert.match(source('src/components/forms/PinLookupField.tsx'), /htmlFor={inputId}/);
});

test('mobile financial records remain visible without raw payment enums', () => {
  const customers = source('src/pages/Customers.tsx');
  const payments = source('src/pages/InvoicePreview.tsx');
  assert.match(customers, /Outstanding/);
  assert.match(customers, /lg:hidden/);
  assert.match(payments, /Current invoice balance/);
  assert.match(payments, /paymentMethodLabel/);
  assert.doesNotMatch(payments, />{payment\.method}</);
});

test('invoice dates have labelled range controls and save actions do not compete', () => {
  const invoices = source('src/pages/Invoices.tsx');
  assert.match(invoices, /Date range/);
  assert.match(invoices, /Select start date/);
  assert.match(invoices, /aria-label={label}/);
  assert.doesNotMatch(source('src/pages/InvoiceForm.tsx'), /Save Draft/);
  assert.doesNotMatch(source('src/pages/DeliveryNoteForm.tsx'), /Save Draft/);
});

test('normal login errors do not expose Firebase implementation details', () => {
  const login = source('src/pages/Login.tsx');
  assert.doesNotMatch(login, /Firebase Authentication is not initialized/);
  assert.match(login, /role="alert"/);
  assert.match(login, /Sign-in is temporarily unavailable/);
});
