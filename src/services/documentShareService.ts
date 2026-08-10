export type NativeShareResult =
  | { status: 'shared' }
  | { status: 'unsupported'; reason: 'insecure-context' | 'share-unavailable' | 'can-share-unavailable' | 'file-unsupported' }
  | { status: 'cancelled' }
  | { status: 'not-allowed' }
  | { status: 'invalid-data' }
  | { status: 'data-error' }
  | { status: 'failed' };

export type NativeShareApi = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export type NativeShareEnvironment = {
  isSecureContext: boolean;
  shareApi: NativeShareApi;
};

function browserShareEnvironment(): NativeShareEnvironment {
  return {
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
    shareApi: typeof navigator === 'undefined' ? {} : navigator,
  };
}

export function validatePdfFile(file: File) {
  return file instanceof File
    && file.size > 0
    && file.type === 'application/pdf'
    && file.name.toLowerCase().endsWith('.pdf');
}

export function getPdfFileShareSupport(
  file: File,
  environment: NativeShareEnvironment = browserShareEnvironment(),
): { supported: true } | { supported: false; reason: Extract<NativeShareResult, { status: 'unsupported' }>['reason'] } {
  if (!environment.isSecureContext) return { supported: false, reason: 'insecure-context' };
  if (typeof environment.shareApi.share !== 'function') return { supported: false, reason: 'share-unavailable' };
  if (typeof environment.shareApi.canShare !== 'function') return { supported: false, reason: 'can-share-unavailable' };
  try {
    return environment.shareApi.canShare.call(environment.shareApi, { files: [file] })
      ? { supported: true }
      : { supported: false, reason: 'file-unsupported' };
  } catch {
    return { supported: false, reason: 'file-unsupported' };
  }
}

export async function sharePdfFile(
  file: File,
  environment: NativeShareEnvironment = browserShareEnvironment(),
): Promise<NativeShareResult> {
  if (!validatePdfFile(file)) throw new Error('INVALID_PDF_FILE');
  const support = getPdfFileShareSupport(file, environment);
  if ('reason' in support) return { status: 'unsupported', reason: support.reason };

  try {
    if (typeof import.meta.env !== 'undefined' && import.meta.env.DEV) {
      console.info('[PDF Share]', {
        secureContext: environment.isSecureContext,
        hasNavigatorShare: typeof environment.shareApi.share === 'function',
        hasNavigatorCanShare: typeof environment.shareApi.canShare === 'function',
        canSharePdfFile: true,
        pdfSize: file.size,
        pdfMimeType: file.type,
        pdfFilename: file.name,
      });
    }
    // Keep this deliberately file-only: Android targets such as WhatsApp must
    // receive the actual File, never a chat URL or a text-only fallback.
    await environment.shareApi.share!.call(environment.shareApi, { files: [file] });
    return { status: 'shared' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { status: 'cancelled' };
    if (error instanceof Error && error.name === 'NotAllowedError') return { status: 'not-allowed' };
    if (error instanceof Error && error.name === 'TypeError') return { status: 'invalid-data' };
    if (error instanceof Error && error.name === 'DataError') return { status: 'data-error' };
    return { status: 'failed' };
  }
}

export function sanitizeWhatsAppNumber(number: string) {
  const digits = number.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export function isValidWhatsAppNumber(number: string) {
  return /^\d{8,15}$/.test(sanitizeWhatsAppNumber(number));
}

export function whatsappChatUrl(number: string, text: string) {
  return `https://wa.me/${sanitizeWhatsAppNumber(number)}?text=${encodeURIComponent(text)}`;
}

export function documentExportFilename(
  documentType: 'invoice' | 'quotation' | 'delivery-note' | 'payment-receipt',
  documentNumber: string,
  extension: 'pdf' | 'png',
) {
  const prefix = documentType === 'payment-receipt'
    ? 'Payment-Receipt'
    : documentType === 'delivery-note'
    ? 'Delivery-Note'
    : documentType === 'quotation' ? 'Quotation' : 'Invoice';
  const safeNumber = documentNumber
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 100) || 'Document';
  return `${prefix}-${safeNumber}.${extension}`;
}

export function createDocumentExportFile(
  blob: Blob,
  documentType: 'invoice' | 'quotation' | 'delivery-note' | 'payment-receipt',
  documentNumber: string,
  extension: 'pdf' | 'png',
) {
  const mimeType = extension === 'pdf' ? 'application/pdf' : 'image/png';
  if (!(blob instanceof Blob)) throw new Error('INVALID_DOCUMENT_BLOB');
  if (blob.size <= 0) throw new Error('EMPTY_DOCUMENT_FILE');
  if (extension === 'pdf' && blob.type && blob.type !== mimeType) throw new Error('INVALID_PDF_BLOB');
  const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  return new File(
    [typedBlob],
    documentExportFilename(documentType, documentNumber, extension),
    { type: mimeType, lastModified: Date.now() },
  );
}

export async function preparePdfShareFile(
  generatePdf: () => Promise<Blob>,
  documentType: 'invoice' | 'quotation' | 'delivery-note' | 'payment-receipt',
  documentNumber: string,
) {
  const blob = await generatePdf();
  return createDocumentExportFile(blob, documentType, documentNumber, 'pdf');
}
