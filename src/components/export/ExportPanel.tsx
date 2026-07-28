import { useCallback, useState } from 'react';
import { AlertCircle, CheckCircle, FileDown, Image, Loader2, Mail, MessageCircle, Printer, Share2, X } from 'lucide-react';
import type { RefObject } from 'react';
import { useIntegrationAvailability } from '../../hooks/useIntegrationAvailability';
import { documentPdfCacheKey, getCachedDocumentPdf } from '../../services/documentPdfCache';
import DocumentDeliveryModal from './DocumentDeliveryModal';

export type DocumentType = 'invoice' | 'quotation' | 'delivery-note';
interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: DocumentType;
  documentNumber: string;
  documentLabel: string;
  updatedAt: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  customerEmail?: string;
  defaultCcEmail?: string;
  emailEnabled?: boolean;
  businessName: string;
  exportRootRef: RefObject<HTMLElement | null>;
  onPrint: () => void;
  widthMm?: number;
}

export default function ExportPanel({
  isOpen,
  onClose,
  documentId,
  documentType,
  documentNumber,
  documentLabel,
  updatedAt,
  customerId,
  customerName,
  customerPhone,
  customerWhatsapp,
  customerEmail,
  defaultCcEmail,
  emailEnabled = true,
  businessName,
  exportRootRef,
  onPrint,
  widthMm = 190,
}: ExportPanelProps) {
  const [status, setStatus] = useState<{ type: 'idle' | 'generating' | 'success' | 'failed'; text: string }>({ type: 'idle', text: '' });
  const [active, setActive] = useState<string | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<'email' | 'whatsapp' | null>(null);
  const { availability, status: availabilityStatus } = useIntegrationAvailability();
  const [nativeAvailable, setNativeAvailable] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.share && navigator.canShare));
  const fileName = `${documentLabel.replace(/[^a-z0-9_-]+/gi, '_')}_${documentNumber.replace(/[^a-z0-9_-]+/gi, '_')}.pdf`;
  const cacheKey = documentPdfCacheKey(documentType, documentId, updatedAt);
  const customerNumber = customerWhatsapp || customerPhone || '';
  const emailReady = emailEnabled && availabilityStatus === 'configured' && availability.email;
  const whatsappReady = availabilityStatus === 'configured' && availability.whatsapp && availability.whatsappConnected;

  const setMessage = (type: typeof status.type, text: string, action: string | null = null) => {
    setStatus({ type, text });
    setActive(action);
  };
  const download = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);
  const exportRoot = () => {
    const root = exportRootRef.current;
    if (!root) throw new Error('Document is not ready');
    return root;
  };
  const getFile = async () => {
    const blob = await getCachedDocumentPdf(cacheKey, async () => {
      const service = await import('../../services/exportService');
      return service.createPdfBlobFromElement(exportRoot(), widthMm);
    });
    return new File([blob], fileName, { type: 'application/pdf' });
  };
  const run = async (name: string, work: () => Promise<void>) => {
    if (active) return;
    setMessage('generating', 'Preparing document…', name);
    try {
      await work();
    } catch {
      setMessage('failed', 'Could not prepare the document. Please try again.', name);
    } finally {
      setActive(null);
    }
  };
  const share = () => run('share', async () => {
    const file = await getFile();
    if (!navigator.share || !navigator.canShare || !navigator.canShare({ files: [file] })) {
      setNativeAvailable(false);
      setMessage('failed', 'File sharing is unavailable. Use a fallback below.');
      return;
    }
    try {
      await navigator.share({
        title: `${documentLabel} ${documentNumber}`,
        text: `Please find the ${documentLabel} ${documentNumber} from ${businessName}.`,
        files: [file],
      });
      setMessage('success', 'Document shared with the PDF attached.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setMessage('idle', 'Sharing cancelled.');
      else throw error;
    }
  });
  const pdf = () => run('pdf', async () => {
    const file = await getFile();
    download(file, file.name);
    setMessage('success', 'PDF downloaded.');
  });
  const image = () => run('image', async () => {
    await (await import('../../services/exportService')).exportInvoiceAsImage(exportRoot(), fileName.replace(/\.pdf$/, ''), widthMm);
    setMessage('success', 'Image downloaded.');
  });
  const print = () => {
    setMessage('generating', 'Opening print dialog…', 'print');
    onPrint();
    setMessage('success', 'Print dialog opened.');
  };
  const emailFallback = async (to = customerEmail || '', subject = `${documentLabel} ${documentNumber} from ${businessName}`, message = `Please find the ${documentLabel} ${documentNumber}.`) => {
    await run('email-fallback', async () => {
      const file = await getFile();
      download(file, file.name);
      window.location.href = `mailto:${to.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      setMessage('success', 'PDF downloaded and mail app opened. Attach the PDF manually.');
    });
  };
  const whatsappFallback = async (number = customerNumber, caption = `Please find the ${documentLabel} ${documentNumber} from ${businessName}.`) => {
    const popup = window.open('about:blank', '_blank');
    await run('whatsapp-fallback', async () => {
      if (!number) throw new Error('Missing WhatsApp number');
      const file = await getFile();
      download(file, file.name);
      const digits = number.replace(/\D/g, '');
      const normalized = digits.length === 10 ? `91${digits}` : digits;
      const url = `https://wa.me/${normalized}?text=${encodeURIComponent(caption)}`;
      if (popup) popup.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
      setMessage('success', 'PDF downloaded and WhatsApp opened. Attach the PDF manually.');
    });
    if (popup && popup.location.href === 'about:blank') popup.close();
  };

  if (!isOpen) return null;
  const actions = [
    { id: 'print', label: 'Print', text: 'Browser print dialog', icon: Printer, run: print, disabled: false },
    { id: 'pdf', label: 'Download PDF', text: 'Cached PDF file', icon: FileDown, run: pdf, disabled: false },
    { id: 'image', label: 'Download Image', text: 'PNG image', icon: Image, run: image, disabled: false },
    { id: 'share', label: 'Share Document', text: nativeAvailable ? 'Native PDF share' : 'Unavailable here', icon: Share2, run: share, disabled: !nativeAvailable },
    { id: 'email', label: 'Send Email', text: emailReady ? 'PDF via Resend' : 'Provider unavailable', icon: Mail, run: () => setDeliveryChannel('email'), disabled: !emailReady },
    { id: 'whatsapp', label: 'Send WhatsApp', text: whatsappReady ? 'PDF via Evolution Go' : 'Provider unavailable', icon: MessageCircle, run: () => setDeliveryChannel('whatsapp'), disabled: !whatsappReady },
  ];
  const StatusIcon = status.type === 'generating' ? Loader2 : status.type === 'success' ? CheckCircle : AlertCircle;

  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 z-40 bg-black/30" aria-label="Close export panel" />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-5 flex items-center justify-between">
          <div><h3 className="text-lg font-bold text-stone-800">Export & Share</h3><p className="text-xs text-stone-500">{documentLabel} #{documentNumber}</p></div>
          <button onClick={onClose} className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100" aria-label="Close"><X /></button>
        </div>
        {status.text && (
          <div className={`mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm ${status.type === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-800' : status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
            <StatusIcon size={18} className={status.type === 'generating' ? 'animate-spin' : ''} />{status.text}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            const loading = active === action.id;
            return (
              <button key={action.id} onClick={action.run} disabled={Boolean(active) || action.disabled} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-left font-semibold text-stone-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45">
                {loading ? <Loader2 className="animate-spin" /> : <Icon size={22} />}
                <span>{action.label}</span><span className="ml-auto text-[10px] font-normal text-stone-500">{action.text}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-2 border-t border-stone-100 pt-4 sm:grid-cols-2">
          <button type="button" onClick={() => emailFallback()} disabled={Boolean(active) || !customerEmail} className="min-h-12 rounded-xl border px-3 text-sm font-semibold disabled:opacity-45">Download PDF & open mailto</button>
          <button type="button" onClick={() => whatsappFallback()} disabled={Boolean(active) || !customerNumber} className="min-h-12 rounded-xl border px-3 text-sm font-semibold disabled:opacity-45">Download PDF & open wa.me</button>
        </div>
        {availabilityStatus !== 'configured' && <p className="mt-3 text-xs text-amber-800">Provider status is unavailable. Download, print, native share, mailto and wa.me remain available.</p>}
      </div>
      <DocumentDeliveryModal
        channel={deliveryChannel}
        onClose={() => setDeliveryChannel(null)}
        providerReady={deliveryChannel === 'email' ? emailReady : whatsappReady}
        providerReason={deliveryChannel === 'email' ? 'Resend is not configured or reachable. Use the mail-app fallback.' : 'Evolution Go is not configured, reachable, or connected. Use the WhatsApp fallback.'}
        documentId={documentId}
        documentType={documentType}
        documentNumber={documentNumber}
        customerId={customerId}
        customerName={customerName}
        customerEmail={customerEmail || ''}
        defaultCcEmail={defaultCcEmail}
        customerNumber={customerNumber}
        businessName={businessName}
        getPdfFile={getFile}
        onEmailFallback={emailFallback}
        onWhatsAppFallback={whatsappFallback}
      />
    </>
  );
}
