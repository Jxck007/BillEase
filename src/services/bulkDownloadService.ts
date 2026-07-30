import { zip } from 'fflate';
import { downloadBlob } from './exportService';

export const MAX_BULK_PDFS = 25;

export type BulkFileRequest = {
  id: string;
  fileName: string;
  generate: () => Promise<Blob>;
};

export type BulkProgress = {
  stage: 'preparing' | 'zipping' | 'ready';
  current: number;
  total: number;
};

export type BulkDownloadResult = {
  prepared: number;
  failed: { id: string; fileName: string; error: string }[];
  fileName: string;
};

export function sanitizeFileName(value: string, fallback = 'Document') {
  const safe = value.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 120);
  return safe || fallback;
}

export function uniqueFileNames(values: string[]) {
  const counts = new Map<string, number>();
  return values.map((value) => {
    const safe = sanitizeFileName(value);
    const dot = safe.toLowerCase().endsWith('.pdf') ? safe.length - 4 : -1;
    const stem = dot >= 0 ? safe.slice(0, dot) : safe;
    const extension = dot >= 0 ? '.pdf' : '';
    const key = safe.toLowerCase();
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    return count ? `${stem}-${count + 1}${extension}` : safe;
  });
}

export function createZipBlob(files: { name: string; blob: Blob }[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    Promise.all(files.map(async ({ name, blob }) => [name, new Uint8Array(await blob.arrayBuffer())] as const))
      .then((entries) => zip(Object.fromEntries(entries), { level: 6 }, (error, data) => {
        if (error) reject(error);
        else resolve(new Blob([data as BlobPart], { type: 'application/zip' }));
      }))
      .catch(reject);
  });
}

export async function prepareBulkDownload(
  requests: BulkFileRequest[],
  zipFileName: string,
  onProgress: (progress: BulkProgress) => void = () => undefined,
  signal?: AbortSignal,
): Promise<BulkDownloadResult> {
  if (!requests.length) throw new Error('Select at least one document.');
  if (requests.length > MAX_BULK_PDFS) throw new Error(`A batch can contain up to ${MAX_BULK_PDFS} PDFs.`);
  const names = uniqueFileNames(requests.map((request) => request.fileName));
  const successful: { name: string; blob: Blob }[] = [];
  const failed: BulkDownloadResult['failed'] = [];

  for (let index = 0; index < requests.length; index += 1) {
    if (signal?.aborted) throw new DOMException('Bulk download cancelled.', 'AbortError');
    const request = requests[index];
    onProgress({ stage: 'preparing', current: index + 1, total: requests.length });
    try {
      const blob = await request.generate();
      if (!blob.size) throw new Error('Generated PDF was empty.');
      successful.push({ name: names[index], blob });
    } catch (error) {
      failed.push({ id: request.id, fileName: names[index], error: (error as Error).message });
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (!successful.length) throw new Error('None of the selected documents could be generated.');
  if (signal?.aborted) throw new DOMException('Bulk download cancelled.', 'AbortError');

  if (successful.length === 1 && requests.length === 1) {
    downloadBlob(successful[0].blob, successful[0].name);
  } else {
    onProgress({ stage: 'zipping', current: successful.length, total: requests.length });
    const blob = await createZipBlob(successful);
    downloadBlob(blob, sanitizeFileName(zipFileName.endsWith('.zip') ? zipFileName : `${zipFileName}.zip`));
  }
  onProgress({ stage: 'ready', current: successful.length, total: requests.length });
  return { prepared: successful.length, failed, fileName: zipFileName };
}
