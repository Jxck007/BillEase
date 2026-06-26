import { useState, useRef, useEffect, useCallback } from 'react';
import { Printer, FileDown, Image, Smartphone, Mail, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

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
  customerWhatsapp?: string;
  customerEmail?: string;
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
  customerWhatsapp,
  customerEmail,
  businessName,
  getExportElement,
  onPrint,
  widthMm = 190,
}: ExportPanelProps) {
  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }, []);

  const normalizeIndianWhatsAppNumber = useCallback((phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('91') && digits.length >= 12) return digits;
    const tenDigit = digits.slice(-10);
    return tenDigit ? `91${tenDigit}` : '';
  }, []);

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
      showMessage('failed', 'PDF failed. Document not found.', 'pdf');
      return;
    }
    showMessage('generating', 'Loading export tools...', 'pdf');
    // Yield briefly so the UI updates before the heavy dynamic import
    await new Promise(r => setTimeout(r, 50));
    try {
      const { createPdfBlobFromElement: generatePdf } = await import('../../services/exportService');
      showMessage('generating', 'Generating PDF...', 'pdf');
      await new Promise(r => setTimeout(r, 30));
      const blob = await generatePdf(target, widthMm);
      if (blob && blob.size > 0) {
        downloadBlob(blob, `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}.pdf`);
        showMessage('success', 'PDF downloaded', 'pdf');
      } else {
        throw new Error('Empty PDF');
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      showMessage('failed', 'PDF failed. Try Image export.', 'pdf');
    }
  };

  const handleDownloadImage = async () => {
    const target = getExportElement();
    if (!target) {
      showMessage('failed', 'Image export failed. Document not found.', 'image');
      return;
    }
    showMessage('generating', 'Loading export tools...', 'image');
    // Yield briefly so the UI updates before the heavy dynamic import
    await new Promise(r => setTimeout(r, 50));
    try {
      const { exportInvoiceAsImage } = await import('../../services/exportService');
      showMessage('generating', 'Generating image...', 'image');
      await new Promise(r => setTimeout(r, 30));
      await exportInvoiceAsImage(target, `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}`);
      showMessage('success', 'Image downloaded', 'image');
    } catch (err) {
      console.error('Image export failed:', err);
      showMessage('failed', 'Image failed. Try Print.', 'image');
    }
  };

  const handleWhatsApp = () => {
    const waPhone = customerWhatsapp || customerPhone;
    const message = `Please find the ${documentLabel} ${documentNumber} from ${businessName} for ${customerName}.`;
    const text = encodeURIComponent(message);

    if (waPhone) {
      const waNumber = normalizeIndianWhatsAppNumber(waPhone);
      window.open(`https://wa.me/${waNumber}?text=${text}`, '_blank', 'noopener,noreferrer');
      showMessage('success', 'WhatsApp opened. Attach the downloaded PDF or image manually if needed.', 'whatsapp');
    } else {
      showMessage('failed', 'WhatsApp number missing.', 'whatsapp');
    }
  };

  const handleEmail = async () => {
    const recipient = customerEmail || '';
    const subject = encodeURIComponent(`${documentLabel} ${documentNumber} from ${businessName}`);
    const body = encodeURIComponent([
      `Dear ${customerName || 'Customer'},`,
      '',
      `Please find the ${documentLabel.toLowerCase()} details from ${businessName}.`,
      `Document No: ${documentNumber}`,
      '',
      'Thank you.',
    ].join('\n'));

    if (!customerEmail) {
      showMessage('failed', 'No email saved for this customer.', 'email');
      return;
    }
    const target = getExportElement();
    if (!target) {
      showMessage('failed', 'PDF failed. Document not found.', 'email');
      return;
    }
    showMessage('generating', 'Downloading PDF for email...', 'email');
    try {
      const { createPdfBlobFromElement: generatePdf } = await import('../../services/exportService');
      const blob = await generatePdf(target, widthMm);
      if (!blob.size) throw new Error('Empty PDF');
      downloadBlob(blob, `${documentLabel.replace(/\s+/g, '_')}_${documentNumber}.pdf`);
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
      showMessage('success', `Email draft opened for ${customerEmail}. Attach the downloaded PDF manually.`, 'email');
    } catch (err) {
      console.error('Email PDF preparation failed:', err);
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
      showMessage('failed', 'PDF could not be generated. Email draft opened. Attach file manually if needed.', 'email');
    }
  };

  const isLoading = exportState === 'generating';

  const actions = [
    { id: 'print', label: 'Print', icon: Printer, onClick: handlePrint, description: 'Browser print dialog' },
    { id: 'pdf', label: 'Download PDF', icon: FileDown, onClick: handleDownloadPdf, description: 'A4 PDF file' },
    { id: 'image', label: 'Download Image', icon: Image, onClick: handleDownloadImage, description: 'PNG image' },
    // Share PDF and Share Image hidden — unreliable on mobile/Poco
    // Can be restored once native file sharing is verified stable
    { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, onClick: handleWhatsApp, description: (customerWhatsapp || customerPhone) ? `Send to ${customerName}` : 'Open WhatsApp' },
    { id: 'email', label: 'Email', icon: Mail, onClick: handleEmail, description: customerEmail ? `Send to ${customerEmail}` : 'Open email draft' },
  ];

  return (
    <>
      {isOpen && (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Export & Share</h3>
                <p className="text-xs text-stone-500 mt-1">{documentLabel} #{documentNumber}</p>
              </div>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Status message */}
            {exportMessage && (
              <div className={`mb-4 rounded-2xl p-3 text-sm flex items-center gap-2 ${
                exportState === 'generating' ? 'export-generating-bg text-blue-700 border border-blue-200' :
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
                    className={`flex flex-col items-center gap-2 rounded-2xl border min-h-[60px] p-3 sm:p-4 text-sm font-semibold transition-all ${
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
              {documentType === 'delivery-note' ? 'DN' : documentLabel} exports use A4 format. Print uses your browser print dialog.
            </p>
          </div>
        </>
      )}
    </>
  );
}
