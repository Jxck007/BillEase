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
  if (!shareApi.share || !shareApi.canShare?.({ files: [file] })) return { status: 'unsupported' };
  try {
    await shareApi.share({ files: [file], title, text });
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

export function whatsappChatUrl(number: string, text: string) {
  return `https://wa.me/${sanitizeWhatsAppNumber(number)}?text=${encodeURIComponent(text)}`;
}

export async function sharePdfWithWhatsAppFallback(input: {
  file: File;
  title: string;
  text: string;
  phoneNumber: string;
  download: (file: File) => void;
  openChat: (url: string) => void;
  shareApi?: NativeShareApi;
}) {
  const result = await sharePdfFile(input.file, input.title, input.text, input.shareApi);
  if (result.status !== 'unsupported') return result;

  input.download(input.file);
  const url = whatsappChatUrl(input.phoneNumber, input.text);
  input.openChat(url);
  return { status: 'fallback' as const, url };
}
