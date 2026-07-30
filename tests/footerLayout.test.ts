import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('canonical renderer aligns the final footer to an A4 page boundary', async () => {
  const source = await readFile('src/components/documents/CanonicalDocumentViewport.tsx', 'utf8');
  assert.match(source, /297\s*\/\s*210/);
  assert.match(source, /document-final-footer/);
});

test('invoice, quotation and delivery note use the same final footer component', async () => {
  for (const file of ['src/components/invoices/TraditionalTaxInvoice.tsx', 'src/templates/QuotationEstimateTemplate.tsx', 'src/templates/IndustrialDeliveryNoteTemplate.tsx']) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /<ComputerGeneratedFooter\s*\/>/);
  }
});

test('footer includes the exact English and Tamil translations', async () => {
  const source = await readFile('src/lib/translations.ts', 'utf8');
  assert.match(source, /This is a Computer Generated Document\./);
  assert.match(source, /இது கணினி மூலம் உருவாக்கப்பட்ட ஆவணம்\./);
});

test('rows, authorization and final footer are protected from splitting', async () => {
  const source = await readFile('src/index.css', 'utf8');
  assert.match(source, /\.canonical-a4-document tr[\s\S]*break-inside:\s*avoid/);
  assert.match(source, /\.document-final-footer[\s\S]*page-break-inside:\s*avoid/);
});
