import { HttpError } from '../http/errors';
import { MAX_PDF_BYTES } from './parseDocumentMultipart';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PDF_FILENAME_PATTERN = /^[^/\\\u0000-\u001f\u007f]{1,150}\.pdf$/i;
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
    if (size > 4_100_000) throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function validEmail(value: string) {
  return value.length <= 254 && EMAIL_PATTERN.test(value) && !/[\r\n]/.test(value);
}

export function parseBase64Pdf(value: unknown) {
  const pdfBase64 = String(value || '').trim();
  if (!pdfBase64 || !BASE64_PATTERN.test(pdfBase64)) {
    throw new HttpError(400, 'INVALID_PDF', 'Invalid request');
  }

  const estimatedBytes = Math.floor((pdfBase64.length * 3) / 4);
  if (estimatedBytes > MAX_PDF_BYTES) {
    throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
  }

  const buffer = Buffer.from(pdfBase64, 'base64');
  if (!buffer.length || buffer.length > MAX_PDF_BYTES || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new HttpError(buffer.length > MAX_PDF_BYTES ? 413 : 400, buffer.length > MAX_PDF_BYTES ? 'ATTACHMENT_TOO_LARGE' : 'INVALID_PDF', 'Invalid request');
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

  if (!validEmail(recipientEmail)
    || (ccEmail && !validEmail(ccEmail))
    || !subject || subject.length > 200 || /[\r\n]/.test(subject)
    || !message || message.length > 3000
    || !PDF_FILENAME_PATTERN.test(filename)) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid request');
  }

  return {
    recipientEmail,
    ccEmail: ccEmail || undefined,
    subject,
    message,
    filename,
    pdf: parseBase64Pdf(input.pdfBase64),
    documentId: String(input.documentId || 'email-attachment').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 160) || 'email-attachment',
    idempotencyKey: String(input.idempotencyKey || '').trim(),
  };
}

export function normalizeWhatsAppNumber(value: unknown) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (!/^[1-9]\d{9,14}$/.test(digits)) {
    throw new HttpError(400, 'INVALID_RECIPIENT_NUMBER', 'Invalid request');
  }
  return digits;
}
