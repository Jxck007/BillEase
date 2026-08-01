import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('help is searchable and organized into contextual accordion topics', () => {
  const help = source('src/components/layout/FloatingHelp.tsx');
  assert.match(help, /Search help topics/);
  assert.match(help, /<details/);
  for (const topic of ['Saving and cloud sync', 'Invoice payment status', 'Payment History actions', 'Document preview modes', 'Customer address', 'Sharing documents', 'Static UPI QR']) assert.match(help, new RegExp(topic));
});

test('payment, preview and sync definitions are available in English and Tamil', () => {
  const help = source('src/components/layout/FloatingHelp.tsx');
  assert.match(help, /Correct: Fix an incorrect date, method, amount or reference/);
  assert.match(help, /திருத்து: தவறான தேதி, முறை, தொகை அல்லது குறிப்பைச் சரிசெய்யவும்/);
  assert.match(help, /Fit Content is a compact screen view/);
  assert.match(help, /உள்ளடக்கத்தைப் பொருத்து என்பது/);
  assert.match(help, /matching server revision was confirmed/);
  assert.match(help, /பொருந்தும் சேவையகப் பதிப்பு உறுதிசெய்யப்பட்டது/);
});

test('context help links exist near payment history, preview, sync and customer address', () => {
  assert.match(source('src/pages/InvoicePreview.tsx'), /openHelp\('payment-history'\)/);
  assert.match(source('src/components/documents/CanonicalDocumentViewport.tsx'), /openHelp\('preview'\)/);
  assert.match(source('src/components/layout/AppLayout.tsx'), /openHelp\('sync'\)/);
  assert.match(source('src/pages/Customers.tsx'), /openHelp\('address'\)/);
});

test('sharing and static UPI help state their important limitations', () => {
  const help = source('src/components/layout/FloatingHelp.tsx');
  assert.match(help, /WhatsApp URL cannot attach a local PDF automatically/);
  assert.match(help, /Scanning a static UPI QR does not confirm payment/);
});
