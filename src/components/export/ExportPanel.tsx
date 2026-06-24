import { useState, useRef, useEffect, useCallback } from 'react';
import { Printer, FileDown, Image, Share2, Smartphone, Mail, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { exportInvoiceAsImage, shareElementAsPdf, shareElementAsImage, canUseNativeShare, canShareFiles, downloadBlob } from '../../services/exportService';

export type ExportState = 'idle' | 'generating' | 'success' | 'failed';
export type DocumentType = 'invoice' | 'quotation' | 'delivery-note';

interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: DocumentType;
  documentNumber: string;
  documentLabel: string;
  customerName: string;
  customerPhone?: string;
  businessName: string;
  getExportElement: () => HTMLElement | null;
  onPrint: () => void;
  widthMm?: number;
}

export default function ExportPanel({
  isOpen,
  onClose,
  documentType,
  documentNumber,
  documentLabel,
  customerName,
  customerPhone,
  businessName,
  getExportElement,
  onPrint,
  widthMm = 190,
}: ExportPanelProps) {
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const messageTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isOpen) {
      setExportState('idle');
      setExportMessage('');
      setActiveAction(null);
    }
  }, [isOpen]);

  const clearMessage = useCallback(() => {
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
    messageTimeout.current = setTimeout(() => {
      setExportState('idle');
      setExportMessage('');
      setActiveAction(null);
    }, 3000);
  }, []);

  const showMessage = useCallback((state: ExportState, message: string, action: string) => {
    setExportState(state);
    setExportMessage(message);
    setActiveAction(action);
    if (state === 'success' || state === 'failed') {
      clearMessage();
    }
  }, [clearMessage]);

  const handlePrint = () => {
    showMessage('generating', 'Opening print dialog...', 'print');
    setTimeout(() => {
      onPrint();
      showMessage('success', 'Print dialog opened', 'print');
    }, 100);
  };

  const handleDownloadPdf = async () => {
    const target = getExportElement();
    if (!target) {
      showMessage('failed', 'Unable to generate PDF - document not found', 'pdf');
      return;
    }
    showMessage('generating', 'Generating PDF...', 'pdf');
    try {
      const blob = await (await import('../../services/exportService')).createPdfBlobFromElement(target, widthMm);
      if (blob && blob.size > 0) {
        downloadBlob(blob, `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}.pdf`);
        showMessage('success', 'PDF downloaded', 'pdf');
      } else {
        throw new Error('Empty PDF');
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      showMessage('failed', 'PDF failed. Try image export instead.', 'pdf');
    }
  };

  const handleDownloadImage = async () => {
    const target = getExportElement();
    if (!target) {
      showMessage('failed', 'Unable to generate image', 'image');
      return;
    }
    showMessage('generating', 'Generating image...', 'image');
    try {
      await exportInvoiceAsImage(target, `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}`);
      showMessage('success', 'Image downloaded', 'image');
    } catch (err) {
      console.error('Image export failed:', err);
      showMessage('failed', 'Image export failed. Try PDF instead.', 'image');
    }
  };

  const handleSharePdf = async () => {
    const target = getExportElement();
    if (!target) {
      showMessage('failed', 'Unable to generate PDF', 'share-pdf');
      return;
    }
    showMessage('generating', 'Generating PDF for sharing...', 'share-pdf');
    try {
      const result = await shareElementAsPdf(
        target,
        `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}`,
        `${documentLabel} ${documentNumber}`,
        `${businessName} - ${documentLabel} #${documentNumber}\nCustomer: ${customerName}`,
        widthMm,
      );
      if (result.shared) {
        showMessage('success', 'PDF shared successfully', 'share-pdf');
      } else if (result.downloaded) {
        showMessage('success', 'PDF downloaded (sharing not supported)', 'share-pdf');
      } else {
        showMessage('failed', 'Unable to share PDF', 'share-pdf');
      }
    } catch (err) {
      console.error('PDF share failed:', err);
      showMessage('failed', 'PDF share failed. Try sharing as image.', 'share-pdf');
    }
  };

  const handleShareImage = async () => {
    const target = getExportElement();
    if (!target) {
      showMessage('failed', 'Unable to generate image', 'share-image');
      return;
    }
    showMessage('generating', 'Generating image for sharing...', 'share-image');
    try {
      const result = await shareElementAsImage(
        target,
        `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}`,
        `${documentLabel} ${documentNumber}`,
        `${businessName} - ${documentLabel} #${documentNumber}\nCustomer: ${customerName}`,
        widthMm,
      );
      if (result.shared) {
        showMessage('success', 'Image shared successfully', 'share-image');
      } else if (result.downloaded) {
        showMessage('success', 'Image downloaded (sharing not supported)', 'share-image');
      } else {
        showMessage('failed', 'Unable to share image', 'share-image');
      }
    } catch (err) {
      console.error('Image share failed:', err);
      showMessage('failed', 'Image share failed. Try text share.', 'share-image');
    }
  };

  const handleWhatsApp = async () => {
    if (customerPhone) {
      const digits = customerPhone.replace(/\D/g, '');
      const waNumber = digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
      const text = encodeURIComponent([
        `Hello ${customerName || 'Customer'},`,
        '',
        `Please find the attached ${documentLabel.toLowerCase()} ${documentNumber} from ${businessName}.`,
        '',
        'Thank you.',
      ].join('\n'));

      // Try sharing PDF first via native share
      const target = getExportElement();
      if (target && canUseNativeShare() && canShareFiles([new File([], 'test.pdf')])) {
        showMessage('generating', 'Generating PDF for WhatsApp...', 'whatsapp');
        try {
          const result = await shareElementAsPdf(
            target,
            `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}`,
            `${documentLabel} ${documentNumber}`,
            `Please find the attached ${documentLabel.toLowerCase()} ${documentNumber} from ${businessName}.`,
            widthMm,
          );
          if (result.shared) {
            showMessage('success', 'Sent via share sheet', 'whatsapp');
            return;
          }
        } catch {}
      }

      // Fallback: open WhatsApp URL
      window.open(`https://wa.me/${waNumber}?text=${text}`, '_blank', 'noopener,noreferrer');
      showMessage('success', 'WhatsApp opened', 'whatsapp');
    } else {
      // No customer phone: download first then open generic WhatsApp
      showMessage('generating', 'No customer phone. Downloading...', 'whatsapp');
      try {
        await handleDownloadPdf();
        window.open('https://wa.me', '_blank', 'noopener,noreferrer');
        showMessage('success', 'WhatsApp opened. Attach the downloaded file manually.', 'whatsapp');
      } catch {
        window.open('https://wa.me', '_blank', 'noopener,noreferrer');
        showMessage('success', 'WhatsApp opened', 'whatsapp');
      }
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`${documentLabel} ${documentNumber} from ${businessName}`);
    const body = encodeURIComponent([
      `Dear ${customerName || 'Customer'},`,
      '',
      `Please find the ${documentLabel.toLowerCase()} details from ${businessName}.`,
      `Document No: ${documentNumber}`,
      '',
      'Thank you.',
    ].join('\n'));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
    showMessage('success', 'Email draft opened', 'email');
    // Also offer download PDF for attachment
    if (getExportElement()) {
      setTimeout(() => handleDownloadPdf(), 500);
    }
  };

  const isLoading = exportState === 'generating';

  const actions = [
    { id: 'print', label: 'Print', icon: Printer, onClick: handlePrint, description: 'Browser print dialog' },
    { id: 'pdf', label: 'Download PDF', icon: FileDown, onClick: handleDownloadPdf, description: 'A4 PDF file' },
    { id: 'image', label: 'Download Image', icon: Image, onClick: handleDownloadImage, description: 'PNG image' },
    { id: 'share-pdf', label: 'Share PDF', icon: Share2, onClick: handleSharePdf, description: 'Share as PDF' },
    { id: 'share-image', label: 'Share Image', icon: Image, onClick: handleShareImage, description: 'Share as image' },
    { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, onClick: handleWhatsApp, description: customerPhone ? `Send to ${customerName}` : 'Open WhatsApp' },
    { id: 'email', label: 'Email', icon: Mail, onClick: handleEmail, description: 'Open email draft' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Export & Share</h3>
                <p className="text-xs text-stone-500 mt-1">{documentLabel} #{documentNumber}</p>
              </div>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Status message */}
            {exportMessage && (
              <div className={`mb-4 rounded-2xl p-3 text-sm flex items-center gap-2 ${
                exportState === 'generating' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                exportState === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                exportState === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                'bg-stone-50 text-stone-600 border border-stone-200'
              }`}>
                {exportState === 'generating' ? <Loader2 size={16} className="animate-spin" /> :
                 exportState === 'success' ? <CheckCircle size={16} /> :
                 exportState === 'failed' ? <AlertCircle size={16} /> : null}
                <span className="flex-1">{exportMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action) => {
                const Icon = action.icon;
                const isActionLoading = isLoading && activeAction === action.id;
                return (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    disabled={isLoading && !isActionLoading}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition-all ${
                      isActionLoading
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.98]'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isActionLoading ? (
                      <Loader2 size={22} className="animate-spin text-blue-500" />
                    ) : (
                      <Icon size={22} className={action.id === 'whatsapp' ? 'text-[#25D366]' : ''} />
                    )}
                    <span>{action.label}</span>
                    <span className="text-[10px] font-normal text-stone-400">{action.description}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[10px] text-stone-400">
              {documentType === 'delivery-note' ? 'DN' : documentLabel} exports use A4 format. Print uses browser print.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
