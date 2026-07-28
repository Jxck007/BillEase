type CacheEntry = { blob: Blob; usedAt: number };

const MAX_CACHE_ENTRIES = 2;
const pdfCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Blob>>();

export function documentPdfCacheKey(documentType: string, documentId: string, updatedAt: string) {
  return `${documentType}:${documentId}:${updatedAt}`;
}

export async function getCachedDocumentPdf(
  key: string,
  generate: () => Promise<Blob>,
) {
  const cached = pdfCache.get(key);
  if (cached) {
    cached.usedAt = Date.now();
    return cached.blob;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = generate().then((blob) => {
    if (!blob.size) throw new Error('PDF could not be generated');
    pdfCache.set(key, { blob, usedAt: Date.now() });
    while (pdfCache.size > MAX_CACHE_ENTRIES) {
      const oldest = [...pdfCache.entries()].sort((a, b) => a[1].usedAt - b[1].usedAt)[0]?.[0];
      if (!oldest) break;
      pdfCache.delete(oldest);
    }
    return blob;
  }).finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

export function invalidateDocumentPdf(documentType: string, documentId: string) {
  const prefix = `${documentType}:${documentId}:`;
  for (const key of pdfCache.keys()) {
    if (key.startsWith(prefix)) pdfCache.delete(key);
  }
}
