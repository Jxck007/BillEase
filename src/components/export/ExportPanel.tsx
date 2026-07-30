import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, FileDown, Image, Loader2, Mail, MessageCircle, Printer, Share2, X } from 'lucide-react';
import type { RefObject } from 'react';
import { useIntegrationAvailability } from '../../hooks/useIntegrationAvailability';
import { documentPdfCacheKey, getCachedDocumentPdf } from '../../services/documentPdfCache';
import {
  createDocumentExportFile,
  isValidWhatsAppNumber,
  sharePdfWithWhatsAppFallback,
  whatsappChatUrl,
} from '../../services/documentShareService';
import DocumentDeliveryModal from './DocumentDeliveryModal';
import { useLanguage } from '../../context/LanguageContext';

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
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<{ type: 'idle' | 'generating' | 'success' | 'failed'; text: string }>({ type: 'idle', text: '' });
  const [active, setActive] = useState<string | null>(null);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [blockedWhatsAppUrl, setBlockedWhatsAppUrl] = useState('');
  const { availability, status: availabilityStatus } = useIntegrationAvailability();
  const [nativeAvailable, setNativeAvailable] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.share && navigator.canShare));
  const cacheKey = documentPdfCacheKey(documentType, documentId, updatedAt);
  const customerNumber = customerWhatsapp || customerPhone || '';
  const validCustomerNumber = isValidWhatsAppNumber(customerNumber);
  const emailReady = emailEnabled && availabilityStatus === 'configured' && availability.email;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

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
  const exportRoot = useCallback(() => {
    const root = exportRootRef.current;
    if (!root) throw new Error('Document is not ready');
    return root;
  }, [exportRootRef]);
  const getFile = useCallback(async (format: 'pdf' | 'png' = 'pdf') => {
    if (format === 'png') {
      const service = await import('../../services/exportService');
      const blob = await service.createPngBlobFromElement(exportRoot(), widthMm);
      return createDocumentExportFile(blob, documentType, documentNumber, 'png');
    }
    const blob = await getCachedDocumentPdf(cacheKey, async () => {
      const service = await import('../../services/exportService');
      return service.createPdfBlobFromElement(exportRoot(), widthMm);
    });
    return createDocumentExportFile(blob, documentType, documentNumber, 'pdf');
  }, [cacheKey, documentNumber, documentType, exportRoot, widthMm]);
  const run = async (name: string, work: () => Promise<void>) => {
    if (active) return;
    setMessage('generating', t('preparingDocument'), name);
    try {
      await work();
    } catch {
      setMessage('failed', language === 'ta' ? 'ஆவணத்தைத் தயாரிக்க முடியவில்லை. மீண்டும் முயலவும்.' : 'Could not prepare the document. Please try again.', name);
    } finally {
      setActive(null);
    }
  };
  const share = () => run('share', async () => {
    setBlockedWhatsAppUrl('');
    const file = await getFile('pdf');
    const result = await sharePdfWithWhatsAppFallback({
      file,
      title: `${documentLabel} ${documentNumber}`,
      text: `Please find the ${documentLabel} ${documentNumber} from ${businessName}.`,
      phoneNumber: validCustomerNumber ? customerNumber : undefined,
      download: (pdfFile) => download(pdfFile, pdfFile.name),
      openChat: (url) => {
        const popup = window.open(url, '_blank');
        if (popup) popup.opener = null;
        return Boolean(popup);
      },
    });
    if (result.status === 'downloaded' || result.status === 'fallback' || result.status === 'fallback-blocked') {
      setNativeAvailable(false);
      if (result.status === 'fallback-blocked') setBlockedWhatsAppUrl(result.url);
      setMessage('success', language === 'ta'
        ? 'PDF பதிவிறக்கம் செய்யப்பட்டது. பதிவிறக்கம் செய்யப்பட்ட ஆவணத்தை WhatsApp-ல் இணைக்கவும்.'
        : 'PDF downloaded. Please attach the downloaded document in WhatsApp.');
      return;
    }
    if (result.status === 'cancelled') {
      setMessage('idle', '');
      return;
    }
    setMessage('success', `${file.name} shared through the system share sheet.`);
  });
  const pdf = () => run('pdf', async () => {
    const file = await getFile('pdf');
    download(file, file.name);
    setMessage('success', t('pdfDownloaded'));
  });
  const image = () => run('image', async () => {
    const file = await getFile('png');
    download(file, file.name);
    setMessage('success', t('imageDownloaded'));
  });
  const print = () => {
    setMessage('generating', language === 'ta' ? 'அச்சு சாளரம் திறக்கப்படுகிறது…' : 'Opening print dialog…', 'print');
    onPrint();
    setMessage('success', t('printDialogOpened'));
  };
  const openWhatsApp = () => {
    if (!validCustomerNumber || active) return;
    const caption = `Hello, this is ${businessName} regarding ${documentLabel} ${documentNumber}.`;
    const url = whatsappChatUrl(customerNumber, caption);
    const popup = window.open(url, '_blank');
    if (popup) popup.opener = null;
    setBlockedWhatsAppUrl(popup ? '' : url);
    setMessage(
      popup ? 'success' : 'failed',
      popup
        ? (language === 'ta' ? 'வாடிக்கையாளர் WhatsApp உரையாடல் திறக்கப்பட்டது. PDF தானாக இணைக்கப்படவில்லை.' : 'Customer WhatsApp chat opened. The PDF was not attached automatically.')
        : (language === 'ta' ? 'WhatsApp திறப்பதை உலாவி தடுத்தது. கீழே உள்ள பொத்தானைத் தட்டவும்.' : 'The browser blocked WhatsApp. Tap the button below to open it.'),
    );
  };

  if (!isOpen) return null;
  const actions = [
    { id: 'print', label: t('print'), text: t('browserPrintDialog'), icon: Printer, run: print, disabled: false },
    { id: 'pdf', label: t('downloadPdf'), text: t('cachedPdfFile'), icon: FileDown, run: pdf, disabled: false },
    { id: 'image', label: t('downloadImage'), text: t('pngImage'), icon: Image, run: image, disabled: false },
    { id: 'share', label: t('sharePdf'), text: t('nativePdfShare'), icon: Share2, run: share, disabled: false },
    { id: 'email', label: t('sendEmail'), text: emailReady ? t('pdfViaGmail') : t('providerUnavailable'), icon: Mail, run: () => setEmailComposerOpen(true), disabled: !emailReady },
    { id: 'whatsapp', label: t('openWhatsApp'), text: t('customerChatNoAttachment'), icon: MessageCircle, run: openWhatsApp, disabled: !validCustomerNumber },
  ];
  const StatusIcon = status.type === 'generating' ? Loader2 : status.type === 'success' ? CheckCircle : AlertCircle;

  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 z-[70] bg-black/30" aria-label={language === 'ta' ? 'ஏற்றுமதி சாளரத்தை மூடு' : 'Close export panel'} />
      <div role="dialog" aria-modal="true" aria-labelledby="export-share-title" className="fixed inset-x-0 bottom-0 z-[80] mx-auto max-h-[calc(100dvh-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl lg:inset-0 lg:my-auto lg:h-fit lg:max-h-[calc(100dvh-3rem)] lg:rounded-3xl lg:pb-5">
        <div className="mb-5 flex items-center justify-between">
          <div><h3 id="export-share-title" className="text-lg font-bold text-stone-800">{t('exportShare')}</h3><p className="text-xs text-stone-500">{documentLabel} #{documentNumber}</p></div>
          <button onClick={onClose} className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100" aria-label={t('cancel')}><X /></button>
        </div>
        {!nativeAvailable && <p className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">{t('systemFileSharingUnavailable')}</p>}
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
              <button key={action.id} onClick={action.run} disabled={Boolean(active) || action.disabled} className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-left text-stone-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-emerald-700">
                  {loading ? <Loader2 className="animate-spin" size={22} /> : <Icon size={22} />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight">{action.label}</span>
                  <span className="mt-1 block text-xs font-normal leading-snug text-stone-500">{action.text}</span>
                </span>
              </button>
            );
          })}
        </div>
        {blockedWhatsAppUrl && (
          <a href={blockedWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 font-semibold text-white">
            {t('tapToOpenWhatsApp')}
          </a>
        )}
        {availabilityStatus !== 'configured' && <p className="mt-3 text-xs text-amber-800">{t('providerStatusFallbacks')}</p>}
      </div>
      <DocumentDeliveryModal
        open={emailComposerOpen}
        onClose={() => setEmailComposerOpen(false)}
        providerReady={emailReady}
        providerReason={language === 'ta' ? 'Gmail SMTP சரியாக அமைக்கப்படவில்லை அல்லது App Password தவறானது.' : 'Gmail SMTP is not configured correctly or the App Password is invalid.'}
        documentId={documentId}
        documentType={documentType}
        documentNumber={documentNumber}
        customerId={customerId}
        customerName={customerName}
        customerEmail={customerEmail || ''}
        defaultCcEmail={defaultCcEmail}
        businessName={businessName}
        getAttachmentFile={getFile}
      />
    </>
  );
}
