import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  createDocumentExportFile,
  documentExportFilename,
  getPdfFileShareSupport,
  preparePdfShareFile,
  sanitizeWhatsAppNumber,
  sharePdfFile,
  whatsappChatUrl,
} from '../src/services/documentShareService.js';

function pdfFile(name = 'Invoice-INV-1.pdf') {
  return new File([Buffer.from('%PDF-1.7\n%%EOF')], name, { type: 'application/pdf' });
}

function environment(
  shareApi: {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  },
  isSecureContext = true,
) {
  return { isSecureContext, shareApi };
}

test('native sharing checks and shares the actual PDF File', async () => {
  const file = pdfFile();
  let checkedData: ShareData | undefined;
  let sharedData: ShareData | undefined;
  const result = await sharePdfFile(file, environment({
    canShare: (data) => {
      checkedData = data;
      return data.files?.[0] === file;
    },
    share: async (data) => { sharedData = data; },
  }));

  assert.deepEqual(result, { status: 'shared' });
  assert.equal(checkedData?.files?.[0], file);
  assert.equal(sharedData?.files?.[0], file);
  assert.equal(sharedData?.files?.[0].name, 'Invoice-INV-1.pdf');
  assert.equal(sharedData?.files?.[0].type, 'application/pdf');
  assert.equal(sharedData?.files?.length, 1);
  assert.equal(sharedData?.title, undefined);
  assert.equal(sharedData?.text, undefined);
});

test('an insecure context does not attempt native sharing', async () => {
  let calls = 0;
  const result = await sharePdfFile(pdfFile(), environment({
    canShare: () => { calls += 1; return true; },
    share: async () => { calls += 1; },
  }, false));
  assert.deepEqual(result, { status: 'unsupported', reason: 'insecure-context' });
  assert.equal(calls, 0);
});

test('missing share and canShare APIs are classified separately', async () => {
  assert.deepEqual(
    await sharePdfFile(pdfFile(), environment({})),
    { status: 'unsupported', reason: 'share-unavailable' },
  );
  assert.deepEqual(
    await sharePdfFile(pdfFile(), environment({ share: async () => undefined })),
    { status: 'unsupported', reason: 'can-share-unavailable' },
  );
});

test('canShare false or failure marks PDF file sharing unsupported', async () => {
  const file = pdfFile();
  assert.deepEqual(
    getPdfFileShareSupport(file, environment({ canShare: () => false, share: async () => undefined })),
    { supported: false, reason: 'file-unsupported' },
  );
  assert.deepEqual(
    getPdfFileShareSupport(file, environment({
      canShare: () => { throw new Error('browser failure'); },
      share: async () => undefined,
    })),
    { supported: false, reason: 'file-unsupported' },
  );
});

test('cancelling the native share sheet is neutral', async () => {
  const result = await sharePdfFile(pdfFile(), environment({
    canShare: () => true,
    share: async () => { throw new DOMException('Cancelled', 'AbortError'); },
  }));
  assert.deepEqual(result, { status: 'cancelled' });
});

test('NotAllowedError and unexpected errors are safe result categories', async () => {
  assert.deepEqual(
    await sharePdfFile(pdfFile(), environment({
      canShare: () => true,
      share: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    })),
    { status: 'not-allowed' },
  );
  assert.deepEqual(
    await sharePdfFile(pdfFile(), environment({
      canShare: () => true,
      share: async () => { throw new Error('private browser details'); },
    })),
    { status: 'failed' },
  );
});

test('unsupported native sharing does not automatically download or open WhatsApp', async () => {
  const result = await sharePdfFile(pdfFile('Delivery-Note-DN-7.pdf'), environment({ canShare: () => false, share: async () => undefined }));
  assert.deepEqual(result, { status: 'unsupported', reason: 'file-unsupported' });
});

test('PDF generation failure rejects before sharing and invalid output is rejected', async () => {
  await assert.rejects(
    preparePdfShareFile(async () => { throw new Error('render failed'); }, 'invoice', '1'),
    /render failed/,
  );
  assert.throws(
    () => createDocumentExportFile(new Blob([], { type: 'application/pdf' }), 'invoice', '1', 'pdf'),
    /EMPTY_DOCUMENT_FILE/,
  );
  assert.throws(
    () => createDocumentExportFile(new Blob(['not pdf'], { type: 'text/plain' }), 'invoice', '1', 'pdf'),
    /INVALID_PDF_BLOB/,
  );
});

test('a generated PDF blob with no MIME type becomes one non-empty typed File', async () => {
  const file = await preparePdfShareFile(async () => new Blob(['%PDF-1.7\n%%EOF']), 'invoice', 'INV/1');
  assert.equal(file.size > 0, true);
  assert.equal(file.type, 'application/pdf');
  assert.match(file.name, /\.pdf$/);
  assert.equal(file instanceof File, true);
});

test('TypeError and DataError are classified without a text-only fallback', async () => {
  assert.deepEqual(await sharePdfFile(pdfFile(), environment({ canShare: () => true, share: async () => { throw new TypeError('unsupported'); } })), { status: 'invalid-data' });
  assert.deepEqual(await sharePdfFile(pdfFile(), environment({ canShare: () => true, share: async () => { throw new DOMException('transport', 'DataError'); } })), { status: 'data-error' });
});

test('customer chat is a separate encoded wa.me URL with a sanitized Indian number', () => {
  assert.equal(sanitizeWhatsAppNumber('+91 (98765) 43210'), '919876543210');
  assert.equal(
    whatsappChatUrl('+91 (98765) 43210', 'Invoice 2 & copy'),
    'https://wa.me/919876543210?text=Invoice%202%20%26%20copy',
  );
});

test('document filenames are sanitized and preserve the expected PDF form', () => {
  assert.equal(documentExportFilename('invoice', '002-26-27', 'pdf'), 'Invoice-002-26-27.pdf');
  assert.equal(documentExportFilename('quotation', '001/26/27', 'pdf'), 'Quotation-001-26-27.pdf');
  assert.equal(documentExportFilename('delivery-note', '001-26-27', 'pdf'), 'Delivery-Note-001-26-27.pdf');
});

test('primary Share PDF handler contains no WhatsApp URL or popup operation', () => {
  const source = readFileSync(new URL('../src/components/export/ExportPanel.tsx', import.meta.url), 'utf8');
  const primaryHandler = source.slice(source.indexOf('  const share = () => {'), source.indexOf('  const pdf = () =>'));
  assert.doesNotMatch(primaryHandler, /api\.whatsapp\.com|wa\.me|window\.open|location\.href/);
  assert.match(primaryHandler, /sharePdfFile\(preparedPdf\)/);
  assert.doesNotMatch(primaryHandler, /download\(/);
});

test('only the explicit customer-chat handler opens the wa.me URL', () => {
  const source = readFileSync(new URL('../src/components/export/ExportPanel.tsx', import.meta.url), 'utf8');
  const handlerStart = source.indexOf('  const openWhatsApp = () => {');
  const chatHandler = source.slice(handlerStart, source.indexOf('  if (!isOpen)', handlerStart));
  assert.match(chatHandler, /whatsappChatUrl/);
  assert.match(chatHandler, /window\.open/);
});

test('misleading WhatsApp delivery success messages are absent', () => {
  const source = [
    readFileSync(new URL('../src/components/export/ExportPanel.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/lib/translations.ts', import.meta.url), 'utf8'),
  ].join('\n');
  assert.doesNotMatch(source, /Customer WhatsApp chat opened|WhatsApp chat opened/);
});
