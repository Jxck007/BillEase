import { DeliveryNote, Invoice } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { sanitizeForHtml2Canvas } from '../utils/sanitizeForHtml2Canvas';


const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 5;

/** Use lower scale on mobile/tablet to avoid memory crashes on older devices */
export function getSafeExportScale(): number {
  if (typeof window === 'undefined') return 1;
  // Check if screen is small (mobile/tablet) or device has limited memory
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
  if (isMobile || isTablet) return 1;
  return 2;
}

export type ShareResult = {
  shared: boolean;
  reason?: 'unsupported' | 'files_not_supported' | 'cancelled' | 'generation_failed';
  downloaded?: boolean;
};

function normalizeIndianWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('91') && digits.length >= 12) return digits;
  const tenDigit = digits.slice(-10);
  return `91${tenDigit}`;
}

function mmToPx(mm: number) {
  return Math.round(mm * MM_TO_PX);
}

function pxToMm(px: number) {
  return px / MM_TO_PX;
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

function prepareExportClone(element: HTMLElement, widthMm = A4_WIDTH_MM) {
  const targetWidthPx = mmToPx(widthMm);
  if (!element.matches('[data-export-root="true"]')) {
    throw new Error('Export failed: document content not found');
  }

  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-10000px';
  sandbox.style.top = '0';
  sandbox.style.width = `${targetWidthPx}px`;
  sandbox.style.background = '#ffffff';
  sandbox.style.zIndex = '-1';
  sandbox.style.opacity = '1';
  sandbox.style.pointerEvents = 'none';
  sandbox.style.display = 'block';
  sandbox.style.visibility = 'visible';
  sandbox.style.overflow = 'visible';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.hidden.print\\:block').forEach((el) => ((el as HTMLElement).style.display = 'none'));
  clone.style.width = `${targetWidthPx}px`;
  clone.style.minWidth = `${targetWidthPx}px`;
  clone.style.maxWidth = `${targetWidthPx}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';
  clone.style.scale = 'none';
  clone.style.borderRadius = '0';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';
  clone.style.padding = clone.style.padding || '0';
  clone.style.background = '#ffffff';
  clone.style.color = '#111111';
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.opacity = '1';
  clone.setAttribute('data-export-root', 'true');

  sandbox.appendChild(clone);
  return { sandbox, clone, targetWidthPx };
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

    const width = clone.scrollWidth || clone.clientWidth || targetWidthPx;
    const height = clone.scrollHeight || clone.clientHeight;
    const text = (clone.innerText || '').trim();
    console.log('export root size', { width, height, text: text.slice(0, 200) });
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
      logging: true,
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
    console.log('EXPORT CANVAS', {
      width: canvas.width,
      height: canvas.height,
      dataUrlStart: canvas.toDataURL('image/png').slice(0, 50),
    });
    return { canvas, scale: safeScale };
  } catch (error) {
    throw new Error(`Export rendering failed: ${(error as Error).message}`);
  } finally {
    sandbox.parentNode?.removeChild(sandbox);
  }
}

async function createPngBlobFromElement(element: HTMLElement, widthMm = A4_WIDTH_MM, scale?: number) {
  const { canvas } = await renderExportCanvas(element, widthMm, scale);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to generate PNG blob'))), 'image/png', 1.0);
  });
}

export async function createPdfBlobFromElement(element: HTMLElement, widthMm = A4_WIDTH_MM) {
  const { jsPDF } = await import('jspdf');
  const { canvas, scale } = await renderExportCanvas(element, widthMm);
  if (!canvas.width || !canvas.height) {
    throw new Error('Export failed: document size is zero');
  }
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const imageWidthPx = canvas.width / scale;
  const imageHeightPx = canvas.height / scale;
  const imgWidthMm = pxToMm(imageWidthPx);
  const imgHeightMm = pxToMm(imageHeightPx);
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
  const renderHeight = (imgHeightMm * renderWidth) / imgWidthMm;

  let heightLeft = renderHeight;
  let positionY = PDF_MARGIN_MM;
  let pageIndex = 0;

  while (heightLeft > 0) {
    if (pageIndex > 0) {
      pdf.addPage();
      positionY = PDF_MARGIN_MM - (pageIndex * contentHeight);
    }

    pdf.addImage(
      dataUrl,
      'PNG',
      PDF_MARGIN_MM,
      positionY,
      renderWidth,
      renderHeight,
      undefined,
      'FAST',
    );

    heightLeft -= contentHeight;
    pageIndex += 1;

    if (pageIndex > 20) break;
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
    const blob = await createPngBlobFromElement(element, A4_WIDTH_MM);
    downloadBlob(blob, `${fileName}.png`);
  } catch (err) {
    console.error('Delivery note export failed:', err);
    throw new Error('Unable to generate PNG file');
  }
}

export async function shareElementAsImage(
  element: HTMLElement,
  fileName: string,
  title: string,
  text: string,
  widthMm = A4_WIDTH_MM,
): Promise<ShareResult> {
  try {
    const blob = await createPngBlobFromElement(element, widthMm);
    if (!blob.size) {
      return { shared: false, reason: 'generation_failed' };
    }

    const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
    if (!canShareFiles([file])) {
      downloadBlob(blob, `${fileName}.png`);
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
    const blob = await createPdfBlobFromElement(element, widthMm);
    if (!blob.size) {
      return { shared: false, reason: 'generation_failed' };
    }

    const file = new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });
    if (!canShareFiles([file])) {
      downloadBlob(blob, `${fileName}.pdf`);
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

export function shareInvoiceOnWhatsApp(
  invoice: Invoice,
  customerName: string,
  phone: string,
  businessName: string,
  documentLabel = 'Invoice',
) {
  const text = encodeURIComponent([
    `Hello ${customerName || 'Customer'},`,
    '',
    `Please find your ${documentLabel.toLowerCase()} ${invoice.invoiceNumber} from ${businessName}.`,
    `Total: ${formatCurrency(invoice.total)}`,
    `Paid: ${formatCurrency(invoice.amountPaid)}`,
    `Balance: ${formatCurrency(Math.max(0, invoice.total - invoice.amountPaid))}`,
    '',
    'Thank you.',
  ].join('\n'));
  window.open(`https://wa.me/${normalizeIndianWhatsAppNumber(phone)}?text=${text}`, '_blank', 'noopener,noreferrer');
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

export function shareDeliveryNoteOnWhatsApp(note: DeliveryNote, customerName: string, phone: string, businessName: string) {
  const text = encodeURIComponent([
    `Hello ${customerName || 'Customer'},`,
    '',
    `Please find your delivery note ${note.deliveryNoteNumber} from ${businessName}.`,
    `Date: ${note.date}`,
    note.transportPurpose ? `Transport Purpose: ${note.transportPurpose}` : '',
    note.vehicleNumber ? `Vehicle No: ${note.vehicleNumber}` : '',
    note.approximateValue ? `Approximate Value: ${formatCurrency(note.approximateValue)}` : '',
    '',
    'Thank you.',
  ].join('\n'));
  window.open(`https://wa.me/${normalizeIndianWhatsAppNumber(phone)}?text=${text}`, '_blank', 'noopener,noreferrer');
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
