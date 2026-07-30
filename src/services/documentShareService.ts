export type NativeShareResult =
  | { status: 'shared' }
  | { status: 'unsupported' }
  | { status: 'cancelled' };

type NativeShareApi = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export async function sharePdfFile(
  file: File,
  title: string,
  text: string,
  shareApi: NativeShareApi = navigator,
): Promise<NativeShareResult> {
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('A PDF file is required');
  }
  const shareData: ShareData = { files: [file], title, text };
  if (!shareApi.share || !shareApi.canShare || !shareApi.canShare(shareData)) return { status: 'unsupported' };
  try {
    await shareApi.share(shareData);
    return { status: 'shared' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { status: 'cancelled' };
    throw error;
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
  documentType: 'invoice' | 'quotation' | 'delivery-note',
  documentNumber: string,
  extension: 'pdf' | 'png',
) {
  const prefix = documentType === 'delivery-note'
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
  documentType: 'invoice' | 'quotation' | 'delivery-note',
  documentNumber: string,
  extension: 'pdf' | 'png',
) {
  const mimeType = extension === 'pdf' ? 'application/pdf' : 'image/png';
  return new File(
    [blob],
    documentExportFilename(documentType, documentNumber, extension),
    { type: mimeType },
  );
}

export async function sharePdfWithWhatsAppFallback(input: {
  file: File;
  title: string;
  text: string;
  phoneNumber?: string;
  download: (file: File) => void;
  openChat: (url: string) => boolean;
  shareApi?: NativeShareApi;
}) {
  const result = await sharePdfFile(input.file, input.title, input.text, input.shareApi);
  if (result.status !== 'unsupported') return result;

  input.download(input.file);
  if (!input.phoneNumber || !isValidWhatsAppNumber(input.phoneNumber)) {
    return { status: 'downloaded' as const };
  }
  const url = whatsappChatUrl(input.phoneNumber, input.text);
  const popupOpened = input.openChat(url);
  return { status: popupOpened ? 'fallback' as const : 'fallback-blocked' as const, url };
}
