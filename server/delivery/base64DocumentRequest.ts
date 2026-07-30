import { HttpError } from '../http/errors.js';
import { MAX_ATTACHMENT_BYTES, MAX_REQUEST_BYTES } from './parseDocumentMultipart.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FILENAME_PATTERN = /^[^/\\\u0000-\u001f\u007f]{1,150}\.(?:pdf|png)$/i;
const BASE64_PATTERN = /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/;

function bodyObject(body: unknown): Record<string, unknown> {
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // The caller receives the same safe validation response as other bad payloads.
    }
  }
  throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid request');
}

export async function readJsonRequestBody(request: any) {
  if (request.body !== undefined && request.body !== null) return request.body;
  if (!request || typeof request[Symbol.asyncIterator] !== 'function') {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid request');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function validEmail(value: string) {
  return value.length <= 254 && EMAIL_PATTERN.test(value) && !/[\r\n]/.test(value);
}

export function parseBase64Attachment(value: unknown, mimeType: string) {
  const base64 = String(value || '').trim();
  if (!base64 || !BASE64_PATTERN.test(base64)) {
    throw new HttpError(400, 'INVALID_ATTACHMENT', 'Invalid request');
  }

  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_ATTACHMENT_BYTES) {
    throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
  }

  const buffer = Buffer.from(base64, 'base64');
  const validSignature = mimeType === 'application/pdf'
    ? buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    : buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES || !validSignature) {
    throw new HttpError(buffer.length > MAX_ATTACHMENT_BYTES ? 413 : 400, buffer.length > MAX_ATTACHMENT_BYTES ? 'ATTACHMENT_TOO_LARGE' : 'INVALID_ATTACHMENT', 'Invalid request');
  }
  return buffer;
}

export function parseBase64EmailRequest(body: unknown) {
  const input = bodyObject(body);
  const recipientEmail = String(input.to || input.recipientEmail || '').trim().toLowerCase();
  const ccEmail = String(input.cc || input.ccEmail || '').trim().toLowerCase();
  const subject = String(input.subject || '').trim();
  const message = String(input.message || '').trim();
  const filename = String(input.fileName || input.filename || '').trim();
  const mimeType = String(input.mimeType || input.contentType || (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'application/pdf')).trim().toLowerCase();
  const base64Content = input.attachmentBase64 || input.pdfBase64;
  const documentType = String(input.documentType || '').trim();

  if (!validEmail(recipientEmail)
    || (ccEmail && !validEmail(ccEmail))
    || !subject || subject.length > 200 || /[\r\n]/.test(subject)
    || !message || message.length > 3000
    || !FILENAME_PATTERN.test(filename)
    || !['invoice', 'quotation', 'delivery-note', 'payment-receipt'].includes(documentType)
    || !['application/pdf', 'image/png'].includes(mimeType)
    || (mimeType === 'application/pdf') !== filename.toLowerCase().endsWith('.pdf')) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid request');
  }

  return {
    recipientEmail,
    ccEmail: ccEmail || undefined,
    subject,
    message,
    filename,
    attachment: parseBase64Attachment(base64Content, mimeType),
    mimeType,
    documentType,
    documentId: String(input.documentId || 'email-attachment').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 160) || 'email-attachment',
    idempotencyKey: String(input.idempotencyKey || '').trim(),
  };
}
