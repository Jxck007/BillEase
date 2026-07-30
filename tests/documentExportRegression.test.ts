import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDocumentExportFile,
  documentExportFilename,
} from '../src/services/documentShareService.js';

test('uses stable production filenames for every PDF document type', () => {
  assert.equal(documentExportFilename('invoice', 'INV-001', 'pdf'), 'Invoice-INV-001.pdf');
  assert.equal(documentExportFilename('quotation', 'QT-001', 'pdf'), 'Quotation-QT-001.pdf');
  assert.equal(documentExportFilename('delivery-note', 'DN-001', 'pdf'), 'Delivery-Note-DN-001.pdf');
  assert.equal(documentExportFilename('invoice', '2026/001', 'png'), 'Invoice-2026-001.png');
});

test('creates actual one-page and multi-page PDF File objects without changing bytes', async () => {
  for (const pages of [1, 2] as const) {
    const bytes = Buffer.from(`%PDF-1.7\n/Type /Pages /Count ${pages}\n%%EOF`, 'ascii');
    const file = createDocumentExportFile(
      new Blob([bytes], { type: 'application/pdf' }),
      pages === 1 ? 'invoice' : 'quotation',
      pages === 1 ? 'INV-001' : 'QT-002',
      'pdf',
    );
    assert.equal(file.type, 'application/pdf');
    assert.equal(file.name, pages === 1 ? 'Invoice-INV-001.pdf' : 'Quotation-QT-002.pdf');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  }
});
