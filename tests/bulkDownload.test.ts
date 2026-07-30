import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { createZipBlob, MAX_BULK_PDFS, sanitizeFileName, uniqueFileNames } from '../src/services/bulkDownloadService';

test('bulk limit is bounded', () => assert.equal(MAX_BULK_PDFS, 25));
test('filenames are sanitized and duplicate names become unique', () => {
  assert.equal(sanitizeFileName('../../Invoice / 002.pdf'), 'Invoice-002.pdf');
  assert.deepEqual(uniqueFileNames(['Invoice.pdf', 'Invoice.pdf', 'Invoice.pdf']), ['Invoice.pdf', 'Invoice-2.pdf', 'Invoice-3.pdf']);
});
test('ZIP contains every prepared PDF with its copy label filename', async () => {
  const blob = await createZipBlob([
    { name: 'Invoice-002-Original.pdf', blob: new Blob(['original']) },
    { name: 'Invoice-002-Duplicate.pdf', blob: new Blob(['duplicate']) },
    { name: 'Invoice-002-Triplicate.pdf', blob: new Blob(['triplicate']) },
  ]);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files).sort(), ['Invoice-002-Duplicate.pdf', 'Invoice-002-Original.pdf', 'Invoice-002-Triplicate.pdf']);
});
