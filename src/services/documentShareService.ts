export type NativeShareResult =
  | { status: 'shared' }
  | { status: 'unsupported'; reason: 'insecure-context' | 'share-unavailable' | 'can-share-unavailable' | 'file-unsupported' }
  | { status: 'cancelled' }
  | { status: 'not-allowed' }
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
  return file.size > 0
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
  title: string,
  text: string,
  environment: NativeShareEnvironment = browserShareEnvironment(),
): Promise<NativeShareResult> {
  if (!validatePdfFile(file)) throw new Error('INVALID_PDF_FILE');
  const support = getPdfFileShareSupport(file, environment);
  if ('reason' in support) return { status: 'unsupported', reason: support.reason };

  try {
    await environment.shareApi.share!.call(environment.shareApi, { files: [file], title, text });
    return { status: 'shared' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { status: 'cancelled' };
    if (error instanceof Error && error.name === 'NotAllowedError') return { status: 'not-allowed' };
    return { status: 'failed' };
  }
}

export async function sharePdfWithDownloadFallback(input: {
  file: File;
  title: string;
  text: string;
  download: (file: File) => void;
  environment?: NativeShareEnvironment;
}) {
  const result = await sharePdfFile(input.file, input.title, input.text, input.environment);
  if (result.status !== 'unsupported') return result;
  input.download(input.file);
  return { ...result, downloaded: true as const };
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
  if (blob.size <= 0) throw new Error('EMPTY_DOCUMENT_FILE');
  if (extension === 'pdf' && blob.type && blob.type !== mimeType) throw new Error('INVALID_PDF_BLOB');
  return new File(
    [blob],
    documentExportFilename(documentType, documentNumber, extension),
    { type: mimeType },
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
