import { readFile, unlink } from 'node:fs/promises';
import formidable from 'formidable';
import { HttpError } from '../http/errors.js';

export const MAX_ATTACHMENT_BYTES = 2_000_000;
export const MAX_REQUEST_BYTES = 3_000_000;

const SUPPORTED_ATTACHMENTS = {
  'application/pdf': { extension: '.pdf', signature: Buffer.from('%PDF-', 'ascii') },
  'image/png': { extension: '.png', signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

export async function parseDocumentMultipart(request: any) {
  if (!String(request.headers?.['content-type'] || '').toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(400, 'MULTIPART_REQUIRED', 'multipart/form-data is required');
  }

  const contentLength = Number(request.headers?.['content-length'] || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
  }

  let temporaryPath = '';
  try {
    const form = formidable({
      allowEmptyFiles: false,
      maxFiles: 1,
      maxFileSize: MAX_ATTACHMENT_BYTES,
      maxTotalFileSize: MAX_ATTACHMENT_BYTES,
      multiples: false,
    });
    const [fields, files] = await form.parse(request);
    const supplied = files.attachment || files.pdf;
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
    if (!candidate) throw new HttpError(400, 'ATTACHMENT_REQUIRED', 'A document attachment is required');
    temporaryPath = candidate.filepath;
    const mimeType = String(candidate.mimetype || '') as keyof typeof SUPPORTED_ATTACHMENTS;
    const definition = SUPPORTED_ATTACHMENTS[mimeType];
    if (!definition) {
      throw new HttpError(400, 'INVALID_ATTACHMENT_TYPE', 'Attachment must be a PDF or PNG file');
    }

    const buffer = await readFile(candidate.filepath);
    if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
    }
    if (!buffer.subarray(0, definition.signature.length).equals(definition.signature)) {
      throw new HttpError(400, 'INVALID_ATTACHMENT', 'Attachment content is invalid');
    }

    const originalName = String(candidate.originalFilename || `document${definition.extension}`);
    const baseName = originalName.replace(/\.(?:pdf|png)$/i, '');
    const safeFilename = `${baseName.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[-_.]+/, '').slice(0, 120) || 'document'}${definition.extension}`;
    return {
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, first(value)])),
      attachment: { buffer, filename: safeFilename, mimeType, decodedBytes: buffer.length },
    };
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    if (error?.code === 1009 || /maxFileSize|maxTotalFileSize/i.test(String(error?.message))) {
      throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
    }
    throw new HttpError(400, 'INVALID_MULTIPART', 'Invalid document request');
  } finally {
    if (temporaryPath) await unlink(temporaryPath).catch(() => {
      // Temporary-file cleanup failure must not replace the original parsing error.
    });
  }
}
