import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DeliveryNote, Invoice } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { uploadExport } from '../lib/firebase';

const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
] as const;

const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 5;
const CANVAS_SCALE = 2;

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

function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toSafeColorValue(value: string, cache: Map<string, string>) {
  if (!value || !value.includes('oklch')) return value;
  const cached = cache.get(value);
  if (cached) return cached;
  const probe = document.createElement('span');
  probe.style.color = value;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color || 'rgb(0, 0, 0)';
  document.body.removeChild(probe);
  cache.set(value, resolved);
  return resolved;
}

function normalizeColorsForCanvas(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const sourceNodes = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll<HTMLElement>('*'))];
  const cloneNodes = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll<HTMLElement>('*'))];
  const colorCache = new Map<string, string>();

  sourceNodes.forEach((sourceNode, index) => {
    const cloneNode = cloneNodes[index];
    if (!cloneNode) return;
    const computed = getComputedStyle(sourceNode);

    COLOR_PROPERTIES.forEach((prop) => {
      const value = computed.getPropertyValue(prop).trim();
      if (!value) return;
      cloneNode.style.setProperty(prop, toSafeColorValue(value, colorCache), 'important');
    });
  });
}

function prepareExportClone(element: HTMLElement, widthMm = A4_WIDTH_MM) {
  const targetWidthPx = mmToPx(widthMm);
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.hidden.print\\:block').forEach((el) => ((el as HTMLElement).style.display = 'none'));
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.zIndex = '-1';
  clone.style.width = `${targetWidthPx}px`;
  clone.style.minWidth = `${targetWidthPx}px`;
  clone.style.maxWidth = `${targetWidthPx}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';
  clone.style.borderRadius = '0';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.background = '#ffffff';

  const templateRoot = clone.querySelector('.dn-export-page, .quotation-export-page') as HTMLElement | null;
  if (templateRoot) {
    templateRoot.style.width = `${targetWidthPx}px`;
    templateRoot.style.minWidth = `${targetWidthPx}px`;
    templateRoot.style.maxWidth = `${targetWidthPx}px`;
    templateRoot.style.margin = '0';
    templateRoot.style.boxSizing = 'border-box';
  }

  return { clone, targetWidthPx };
}

async function createPngBlobFromElement(element: HTMLElement, widthMm = A4_WIDTH_MM) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const { clone, targetWidthPx } = prepareExportClone(element, widthMm);
  document.body.appendChild(clone);
  normalizeColorsForCanvas(element, clone);

  try {
    const canvas = await html2canvas(clone, {
      scale: CANVAS_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 5000,
      scrollX: 0,
      scrollY: 0,
      width: targetWidthPx,
      windowWidth: targetWidthPx,
      windowHeight: clone.scrollHeight || clone.clientHeight,
      ignoreElements: (el) => {
        const classList = el.className?.toString() || '';
        return classList.includes('print:hidden') || classList.includes('no-export');
      },
    });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to generate PNG blob'))), 'image/png', 1.0);
    });
  } finally {
    clone.parentNode?.removeChild(clone);
  }
}

async function createPdfBlobFromElement(element: HTMLElement, widthMm = A4_WIDTH_MM) {
  const pngBlob = await createPngBlobFromElement(element, widthMm);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read PNG for PDF conversion'));
    reader.readAsDataURL(pngBlob);
  });

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to decode PNG for PDF conversion'));
    image.src = dataUrl;
  });

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

  const imgWidthMm = pxToMm(image.width / CANVAS_SCALE);
  const imgHeightMm = pxToMm(image.height / CANVAS_SCALE);
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
  uploadToCloud = false,
  docType: 'invoice' | 'estimate' = 'invoice',
) {
  try {
    const blob = await createPngBlobFromElement(element, 190);
    if (uploadToCloud) {
      try {
        await uploadExport(`${fileName}.png`, blob, docType);
      } catch (err) {
        console.warn('Failed to upload to cloud:', (err as Error).message);
      }
    }
    downloadBlob(blob, `${fileName}.png`);
  } catch (err) {
    console.error('Export failed:', err);
    throw new Error('Unable to generate PNG file');
  }
}

export async function exportDeliveryNoteAsImage(element: HTMLElement, fileName: string, uploadToCloud = false) {
  try {
    const blob = await createPngBlobFromElement(element, A4_WIDTH_MM);
    if (uploadToCloud) {
      try {
        await uploadExport(`${fileName}.png`, blob, 'delivery-note');
      } catch (err) {
        console.warn('Failed to upload delivery note to cloud:', (err as Error).message);
      }
    }
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
  if (!canUseNativeShare()) {
    return { shared: false, reason: 'unsupported' };
  }

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
  if (!canUseNativeShare()) {
    return { shared: false, reason: 'unsupported' };
  }

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
