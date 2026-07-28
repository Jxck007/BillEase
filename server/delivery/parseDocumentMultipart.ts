import { readFile, unlink } from 'node:fs/promises';
import formidable from 'formidable';
import { HttpError } from '../http/errors';

export const MAX_PDF_BYTES = 3_000_000;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

export async function parseDocumentMultipart(request: any) {
  if (!String(request.headers?.['content-type'] || '').toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(400, 'MULTIPART_REQUIRED', 'multipart/form-data is required');
  }

  const contentLength = Number(request.headers?.['content-length'] || 0);
  if (contentLength > MAX_PDF_BYTES + 500_000) {
    throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'PDF attachment is too large');
  }

  let temporaryPath = '';
  try {
    const form = formidable({
      allowEmptyFiles: false,
      maxFiles: 1,
      maxFileSize: MAX_PDF_BYTES,
      maxTotalFileSize: MAX_PDF_BYTES,
      multiples: false,
    });
    const [fields, files] = await form.parse(request);
    const candidate = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    if (!candidate) throw new HttpError(400, 'PDF_REQUIRED', 'A PDF attachment is required');
    temporaryPath = candidate.filepath;
    if (candidate.mimetype !== 'application/pdf') {
      throw new HttpError(400, 'INVALID_PDF_MIME', 'Attachment must be an application/pdf file');
    }

    const buffer = await readFile(candidate.filepath);
    if (!buffer.length || buffer.length > MAX_PDF_BYTES) {
      throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'PDF attachment is too large');
    }
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new HttpError(400, 'INVALID_PDF', 'Attachment is not a valid PDF');
    }

    const originalName = String(candidate.originalFilename || 'document.pdf');
    const safeFilename = `${originalName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[-_.]+/, '').slice(0, 120) || 'document'}.pdf`;
    return {
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, first(value)])),
      pdf: { buffer, filename: safeFilename },
    };
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    if (error?.code === 1009 || /maxFileSize|maxTotalFileSize/i.test(String(error?.message))) {
      throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'PDF attachment is too large');
    }
    throw new HttpError(400, 'INVALID_MULTIPART', 'Invalid document request');
  } finally {
    if (temporaryPath) await unlink(temporaryPath).catch(() => undefined);
  }
}
