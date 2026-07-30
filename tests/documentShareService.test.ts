import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  sanitizeWhatsAppNumber,
  sharePdfFile,
  sharePdfWithWhatsAppFallback,
} from '../src/services/documentShareService.js';

function pdfFile(name = 'Invoice_INV-1.pdf') {
  return new File([Buffer.from('%PDF-1.7\n%%EOF')], name, { type: 'application/pdf' });
}

test('native sharing receives the actual PDF, filename, title and text', async () => {
  const file = pdfFile();
  let sharedData: ShareData | undefined;
  const result = await sharePdfFile(file, 'Invoice INV-1', 'Please find the invoice.', {
    canShare: (data) => data.files?.[0] === file,
    share: async (data) => { sharedData = data; },
  });

  assert.deepEqual(result, { status: 'shared' });
  assert.equal(sharedData?.files?.[0], file);
  assert.equal(sharedData?.files?.[0].name, 'Invoice_INV-1.pdf');
  assert.equal(sharedData?.files?.[0].type, 'application/pdf');
  assert.equal(sharedData?.title, 'Invoice INV-1');
  assert.equal(sharedData?.text, 'Please find the invoice.');
});

test('cancelling the native share sheet is not treated as an application failure', async () => {
  const result = await sharePdfFile(pdfFile(), 'Invoice', 'Document', {
    canShare: () => true,
    share: async () => { throw new DOMException('Cancelled', 'AbortError'); },
  });
  assert.deepEqual(result, { status: 'cancelled' });
});

test('unsupported native sharing downloads once and opens the sanitized customer chat', async () => {
  const file = pdfFile('Delivery_Note_DN-7.pdf');
  const downloads: File[] = [];
  const opened: string[] = [];
  const result = await sharePdfWithWhatsAppFallback({
    file,
    title: 'Delivery Note DN-7',
    text: 'Please find the delivery note.',
    phoneNumber: '+91 98765-43210',
    download: (downloadedFile) => downloads.push(downloadedFile),
    openChat: (url) => opened.push(url),
    shareApi: { canShare: () => false, share: async () => undefined },
  });

  assert.equal(result.status, 'fallback');
  assert.deepEqual(downloads, [file]);
  assert.equal(opened.length, 1);
  assert.equal(opened[0], 'https://wa.me/919876543210?text=Please%20find%20the%20delivery%20note.');
  assert.equal(sanitizeWhatsAppNumber('98765 43210'), '919876543210');
});

test('native share cancellation does not download or open WhatsApp', async () => {
  let downloads = 0;
  let chats = 0;
  const result = await sharePdfWithWhatsAppFallback({
    file: pdfFile(),
    title: 'Invoice',
    text: 'Document',
    phoneNumber: '9876543210',
    download: () => { downloads += 1; },
    openChat: () => { chats += 1; },
    shareApi: {
      canShare: () => true,
      share: async () => { throw new DOMException('Cancelled', 'AbortError'); },
    },
  });

  assert.equal(result.status, 'cancelled');
  assert.equal(downloads, 0);
  assert.equal(chats, 0);
});
