import { DeliveryNote, Invoice } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { sanitizeForHtml2Canvas } from '../utils/sanitizeForHtml2Canvas';


const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 0;
const PAGE_ROUNDING_TOLERANCE_CSS_PX = 2;
const KEEP_TOGETHER_SELECTOR = 'tr, .document-final-section, .authorization-assets';

/** Scale 2 keeps text and image assets sharp while remaining practical on older tablets. */
export function getSafeExportScale(): number {
  return 2;
}

export type ShareResult = {
  shared: boolean;
  reason?: 'unsupported' | 'files_not_supported' | 'cancelled' | 'generation_failed';
  downloaded?: boolean;
};

function mmToPx(mm: number) {
  return Math.round(mm * MM_TO_PX);
}

export function canUseNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function canShareFiles(files: File[]) {
  if (!canUseNativeShare()) return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function measureExportRootSize(element: HTMLElement, targetWidth: number) {
  const rootRect = element.getBoundingClientRect();
  let maxBottom = rootRect.height;

  const descendants = element.querySelectorAll<HTMLElement>('*');
  descendants.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    maxBottom = Math.max(maxBottom, rect.bottom - rootRect.top);
  });

  return {
    width: targetWidth,
    height: Math.ceil(Math.max(element.scrollHeight, element.clientHeight, element.offsetHeight, rootRect.height, maxBottom)),
  };
}

function prepareExportClone(element: HTMLElement, widthMm = A4_WIDTH_MM) {
  const targetWidthPx = mmToPx(widthMm);
  if (!element.matches('[data-export-root="true"]')) {
    throw new Error('Export failed: document content not found');
  }

  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '0';
  sandbox.style.top = '0';
  sandbox.style.width = `${targetWidthPx}px`;
  sandbox.style.background = '#ffffff';
  sandbox.style.zIndex = '-1';
  sandbox.style.opacity = '1';
  sandbox.style.pointerEvents = 'none';
  sandbox.style.display = 'block';
  sandbox.style.visibility = 'visible';
  sandbox.style.overflow = 'visible';
  sandbox.style.isolation = 'isolate';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.hidden.print\\:block').forEach((el) => ((el as HTMLElement).style.display = 'none'));
  clone.style.width = `${targetWidthPx}px`;
  clone.style.minWidth = `${targetWidthPx}px`;
  clone.style.maxWidth = `${targetWidthPx}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.overflow = 'visible';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.transform = 'none';
  clone.style.scale = 'none';
  clone.style.borderRadius = '0';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';
  clone.style.background = '#ffffff';
  clone.style.color = '#111111';
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.opacity = '1';
  clone.setAttribute('data-export-root', 'true');

  sandbox.appendChild(clone);
  return { sandbox, clone, targetWidthPx };
}

type KeepTogetherRange = {
  startPx: number;
  endPx: number;
};

function measureKeepTogetherRanges(element: HTMLElement): KeepTogetherRange[] {
  const rootRect = element.getBoundingClientRect();
  return Array.from(element.querySelectorAll<HTMLElement>(KEEP_TOGETHER_SELECTOR))
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        startPx: Math.max(0, rect.top - rootRect.top),
        endPx: Math.max(0, rect.bottom - rootRect.top),
      };
    })
    .filter(({ startPx, endPx }) => endPx > startPx);
}

async function waitForExportAssets(clone: HTMLElement) {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font loading failures and continue with export.
    }
  }

  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    if (typeof img.decode === 'function') {
      return img.decode().catch(() => undefined);
    }
    return new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });
  }));

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function renderExportCanvas(element: HTMLElement, widthMm = A4_WIDTH_MM, scale?: number) {
  const html2canvas = (await import('html2canvas')).default;
  await new Promise((resolve) => setTimeout(resolve, 100));
  const { sandbox, clone, targetWidthPx } = prepareExportClone(element, widthMm);
  document.body.appendChild(sandbox);

  try {
    const safeScale = scale ?? getSafeExportScale();
    await waitForExportAssets(clone);
    sanitizeForHtml2Canvas(clone);
    clone.style.background = '#ffffff';
    clone.style.color = '#111111';
    clone.style.opacity = '1';
    clone.style.visibility = 'visible';
    clone.style.display = 'block';
    clone.style.transform = 'none';

    const { width, height } = measureExportRootSize(clone, targetWidthPx);
    const measuredKeepTogetherRanges = measureKeepTogetherRanges(clone);
    const text = (clone.innerText || '').trim();
    if (!width || !height) {
      throw new Error('Export failed: document size is zero');
    }
    if (!text) {
      throw new Error('Export failed: document content not found');
    }

    const canvas = await html2canvas(clone, {
      scale: safeScale,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 5000,
      scrollX: 0,
      scrollY: 0,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      ignoreElements: (el) => {
        const classList = el.className?.toString() || '';
        return classList.includes('print:hidden') || classList.includes('no-export');
      },
      onclone: (clonedDoc) => {
        const clonedExportRoot = clonedDoc.querySelector<HTMLElement>('[data-export-root="true"]');
        if (!clonedExportRoot) return;
        sanitizeForHtml2Canvas(clonedExportRoot);
        clonedDoc.querySelectorAll('[data-no-export]').forEach((el) => {
          if (!(el as HTMLElement).closest('[data-export-root="true"]')) {
            el.remove();
          }
        });
        clonedExportRoot.style.background = '#ffffff';
        clonedExportRoot.style.color = '#111111';
        clonedExportRoot.style.opacity = '1';
        clonedExportRoot.style.visibility = 'visible';
        clonedExportRoot.style.display = 'block';
        clonedExportRoot.style.transform = 'none';
      },
    });
    if (!canvas.width || !canvas.height) {
      throw new Error('Export failed: document size is zero');
    }
    const canvasScaleY = canvas.height / height;
    const keepTogetherRanges = measuredKeepTogetherRanges.map(({ startPx, endPx }) => ({
      startPx: Math.round(startPx * canvasScaleY),
      endPx: Math.round(endPx * canvasScaleY),
    }));
    return { canvas, scale: safeScale, keepTogetherRanges };
  } catch (error) {
    throw new Error(`Export rendering failed: ${(error as Error).message}`);
  } finally {
    sandbox.parentNode?.removeChild(sandbox);
  }
}

export async function createPngBlobFromElement(element: HTMLElement, widthMm = A4_WIDTH_MM, scale?: number) {
  const { canvas } = await renderExportCanvas(element, widthMm, scale);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to generate PNG blob'))), 'image/png', 1.0);
  });
}

function pageHasMeaningfulPixels(canvas: HTMLCanvasElement, startPx: number) {
  const startY = Math.max(0, Math.floor(startPx));
  const height = canvas.height - startY;
  if (height <= 0) return false;

  const sampleStep = Math.max(1, Math.floor(canvas.width / 800));
  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = Math.ceil(canvas.width / sampleStep);
  scanCanvas.height = Math.min(64, height);
  const context = scanCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return true;

  for (let y = startY; y < canvas.height; y += scanCanvas.height) {
    const scanHeight = Math.min(scanCanvas.height, canvas.height - y);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, scanCanvas.width, scanCanvas.height);
    context.drawImage(canvas, 0, y, canvas.width, scanHeight, 0, 0, scanCanvas.width, scanHeight);
    const pixels = context.getImageData(0, 0, scanCanvas.width, scanHeight).data;
    let visiblePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (alpha > 16 && (red < 245 || green < 245 || blue < 245)) {
        visiblePixels += 1;
        if (visiblePixels >= 12) return true;
      }
    }
  }
  return false;
}

function choosePageSliceHeight(
  offsetPx: number,
  pageContentHeightPx: number,
  canvasHeight: number,
  keepTogetherRanges: KeepTogetherRange[],
  tolerancePx: number,
) {
  const remainingPx = canvasHeight - offsetPx;
  if (remainingPx <= pageContentHeightPx + tolerancePx) return remainingPx;

  const nominalEndPx = offsetPx + pageContentHeightPx;
  const crossingRanges = keepTogetherRanges
    .filter(({ startPx, endPx }) => startPx > offsetPx && startPx < nominalEndPx && endPx > nominalEndPx)
    .sort((a, b) => a.startPx - b.startPx);
  const safeEndPx = crossingRanges[0]?.startPx ?? nominalEndPx;

  // Never create an extremely short page for an unusually tall unbreakable block.
  if (safeEndPx - offsetPx < pageContentHeightPx * 0.35) return pageContentHeightPx;
  return Math.max(1, Math.floor(safeEndPx - offsetPx));
}

export async function createPdfBlobFromElement(element: HTMLElement, widthMm = A4_WIDTH_MM) {
  const { jsPDF } = await import('jspdf');
  const { canvas, scale, keepTogetherRanges } = await renderExportCanvas(element, widthMm);
  if (!canvas.width || !canvas.height) {
    throw new Error('Export failed: document size is zero');
  }
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = A4_WIDTH_MM;
  const pageHeight = A4_HEIGHT_MM;
  const contentWidth = pageWidth - PDF_MARGIN_MM * 2;
  const contentHeight = pageHeight - PDF_MARGIN_MM * 2;
  const renderWidth = contentWidth;
  // Derive page capacity directly from the captured width and the A4 aspect ratio.
  // Converting a rounded CSS height back through 96-DPI millimetres can lose one pixel.
  const pageContentHeightPx = Math.max(1, Math.floor(canvas.width * (contentHeight / contentWidth)));
  const tolerancePx = Math.max(1, Math.ceil(PAGE_ROUNDING_TOLERANCE_CSS_PX * scale));

  let offsetPx = 0;
  let pageIndex = 0;

  while (offsetPx < canvas.height) {
    if (pageIndex > 0 && !pageHasMeaningfulPixels(canvas, offsetPx)) break;

    let sliceHeightPx = choosePageSliceHeight(
      offsetPx,
      pageContentHeightPx,
      canvas.height,
      keepTogetherRanges,
      tolerancePx,
    );
    const trailingPx = canvas.height - (offsetPx + sliceHeightPx);
    if (trailingPx > 0 && trailingPx <= tolerancePx) {
      sliceHeightPx += trailingPx;
    }

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const ctx = pageCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to prepare PDF page');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      offsetPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      pageCanvas.width,
      pageCanvas.height,
    );

    const sliceHeightMm = Math.min(contentHeight, (sliceHeightPx / canvas.width) * renderWidth);
    const pageDataUrl = pageCanvas.toDataURL('image/png', 1.0);

    pdf.addImage(
      pageDataUrl,
      'PNG',
      PDF_MARGIN_MM,
      PDF_MARGIN_MM,
      renderWidth,
      sliceHeightMm,
      undefined,
      'FAST',
    );

    offsetPx += sliceHeightPx;
    pageIndex += 1;

    if (pageIndex > 50) break;
  }

  return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
}

export async function exportInvoiceAsImage(
  element: HTMLElement,
  fileName: string,
  widthMm = 190,
) {
  try {
    const { canvas } = await renderExportCanvas(element, widthMm);
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1.0);
    });
    if (pngBlob && pngBlob.size > 0) {
      downloadBlob(pngBlob, `${fileName}.png`);
      return;
    }
    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });
    if (jpegBlob && jpegBlob.size > 0) {
      downloadBlob(jpegBlob, `${fileName}.jpg`);
      return;
    }
    throw new Error('Unable to generate image file');
  } catch (err) {
    console.error('Image export failed:', err);
    throw new Error('Unable to generate image file');
  }
}

export async function exportDeliveryNoteAsImage(element: HTMLElement, fileName: string) {
  try {
    await exportInvoiceAsImage(element, fileName, A4_WIDTH_MM);
  } catch (err) {
    console.error('Delivery note export failed:', err);
    throw new Error('Unable to generate PNG file');
  }
}

export async function createPdfFileFromElement(element: HTMLElement, fileName: string, widthMm = A4_WIDTH_MM) {
  const blob = await createPdfBlobFromElement(element, widthMm);
  if (!blob.size) throw new Error('Empty PDF');
  return new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });
}

export async function createImageFileFromElement(element: HTMLElement, fileName: string, widthMm = A4_WIDTH_MM) {
  const { canvas } = await renderExportCanvas(element, widthMm);
  const pngBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png', 1.0);
  });
  if (pngBlob && pngBlob.size > 0) {
    return new File([pngBlob], `${fileName}.png`, { type: 'image/png' });
  }
  const jpegBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.9);
  });
  if (jpegBlob && jpegBlob.size > 0) {
    return new File([jpegBlob], `${fileName}.jpg`, { type: 'image/jpeg' });
  }
  throw new Error('Unable to generate image file');
}

export async function shareElementAsImage(
  element: HTMLElement,
  fileName: string,
  title: string,
  text: string,
  widthMm = A4_WIDTH_MM,
): Promise<ShareResult> {
  try {
    const file = await createImageFileFromElement(element, fileName, widthMm);
    if (!canShareFiles([file])) {
      downloadBlob(file, file.name);
      return { shared: false, reason: 'files_not_supported', downloaded: true };
    }

    await navigator.share({ title, text, files: [file] });
    return { shared: true };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { shared: false, reason: 'cancelled' };
    }
    throw err;
  }
}

export async function shareElementAsPdf(
  element: HTMLElement,
  fileName: string,
  title: string,
  text: string,
  widthMm = A4_WIDTH_MM,
): Promise<ShareResult> {
  try {
    const file = await createPdfFileFromElement(element, fileName, widthMm);
    if (!canShareFiles([file])) {
      downloadBlob(file, file.name);
      return { shared: false, reason: 'files_not_supported', downloaded: true };
    }

    await navigator.share({ title, text, files: [file] });
    return { shared: true };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { shared: false, reason: 'cancelled' };
    }
    throw err;
  }
}

export function shareInvoice(invoice: Invoice, businessName: string, documentLabel = 'Invoice'): ShareResult {
  if (!canUseNativeShare()) {
    return { shared: false, reason: 'unsupported' };
  }

  navigator.share({
    title: `${documentLabel} ${invoice.invoiceNumber}`,
    text: `${businessName} - ${documentLabel} #${invoice.invoiceNumber}\nAmount: ${formatCurrency(invoice.total)}\nStatus: ${invoice.status}`,
  }).catch((err) => {
    if (err.name !== 'AbortError') console.error('Share failed:', err);
  });
  return { shared: true };
}

export function shareDeliveryNote(note: DeliveryNote, businessName: string): ShareResult {
  if (!canUseNativeShare()) {
    return { shared: false, reason: 'unsupported' };
  }

  navigator.share({
    title: `Delivery Note ${note.deliveryNoteNumber}`,
    text: [
      `${businessName} - Delivery Note #${note.deliveryNoteNumber}`,
      note.transportPurpose ? `Purpose: ${note.transportPurpose}` : '',
      note.vehicleNumber ? `Vehicle: ${note.vehicleNumber}` : '',
      note.approximateValue ? `Approximate Value: ${formatCurrency(note.approximateValue)}` : '',
    ].filter(Boolean).join('\n'),
  }).catch((err) => {
    if (err.name !== 'AbortError') console.error('Share failed:', err);
  });
  return { shared: true };
}

export function openPrintDialog(title: string, html: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!win) return;
  win.document.open();
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          @media print { body { padding: 0; } }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export function getShareResultMessage(result: ShareResult, language: 'en' | 'ta' = 'en') {
  if (result.shared) {
    return language === 'en' ? 'Shared successfully' : 'வெற்றிகரமாக பகிரப்பட்டது';
  }
  if (result.reason === 'cancelled') return '';
  if (result.reason === 'unsupported') {
    return language === 'en' ? 'Sharing is not supported on this device' : 'இந்த சாதனத்தில் Share ஆதரவு கிடையாது';
  }
  if (result.reason === 'generation_failed') {
    return language === 'en' ? 'Unable to generate file' : 'கோப்பை உருவாக்க முடியவில்லை';
  }
  if (result.reason === 'files_not_supported' && result.downloaded) {
    return language === 'en'
      ? 'File sharing is not supported on this device. The file has been downloaded instead.'
      : 'இந்த சாதனத்தில் கோப்பு பகிர்வு ஆதரிக்கப்படவில்லை. கோப்பு பதிவிறக்கம் செய்யப்பட்டது.';
  }
  return language === 'en' ? 'Unable to share file' : 'கோப்பை பகிர முடியவில்லை';
}
