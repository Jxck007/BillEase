import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Edit, FileDown, Image, Maximize2, MoreVertical, Printer, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import ExportPanel from '../components/export/ExportPanel';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { duplicateInvoice, saveDraft } from '../services/invoiceService';
import CanonicalInvoiceDocument from '../components/invoices/TraditionalTaxInvoice';
import QuotationEstimateTemplate from '../templates/QuotationEstimateTemplate';
import { getEstimateDocumentName, getEstimateDocumentTitle, getEstimateNumberLabel } from '../lib/estimateUtils';
import { useToast } from '../context/ToastContext';
import { documentPdfCacheKey, getCachedDocumentPdf } from '../services/documentPdfCache';

const A4_INVOICE_WIDTH = 190 * (96 / 25.4);

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useData();
  const { t, language } = useLanguage();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { showToast } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState({ scale: 1, height: 0 });
  const invoice = state.invoices.find((entry) => entry.id === id);
  const customer = state.customers.find((entry) => entry.id === invoice?.customerId);
  const isEstimate = invoice?.type === 'estimate';

  const updatePreview = useCallback(() => {
    const viewport = viewportRef.current;
    const document = documentRef.current;
    if (!viewport || !document) return;
    const fitScale = Math.min(1, Math.max(0.3, viewport.clientWidth / A4_INVOICE_WIDTH));
    const scale = Math.min(1.5, fitScale * zoom);
    setPreview({ scale, height: Math.ceil(document.scrollHeight * scale) });
  }, [zoom]);

  useEffect(() => {
    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (documentRef.current) observer.observe(documentRef.current);
    return () => observer.disconnect();
  }, [updatePreview, invoice]);

  if (!invoice) return <div className="mx-auto max-w-xl rounded-3xl border bg-white p-8 text-center"><div className="text-lg font-bold text-stone-800">Invoice not found</div><button type="button" onClick={() => navigate('/invoices')} className="mt-6 min-h-[48px] rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white">Go to invoices</button></div>;

  const documentName = getEstimateDocumentName(state.settings, language);
  const documentTitle = getEstimateDocumentTitle(state.settings);
  const numberLabel = getEstimateNumberLabel(state.settings);
  const handleDuplicate = () => {
    const nextNumber = state.invoices.filter((entry) => entry.type === invoice.type).length + 1;
    saveDraft({ ...duplicateInvoice(invoice, state.settings.invoicePrefix, nextNumber), type: invoice.type, templateId: 'canonical', placeOfSupply: invoice.placeOfSupply });
    navigate(isEstimate ? '/estimates/new' : '/invoices/new');
  };
  const safeFileName = `${isEstimate ? documentName : 'Invoice'}_${invoice.invoiceNumber}`.replace(/[^a-z0-9_-]+/gi, '_');
  const runExportAction = async (action: 'pdf' | 'image') => {
    const root = documentRef.current;
    if (!root) return;
    setIsMoreOpen(false);
    try {
      const service = await import('../services/exportService');
      if (action === 'pdf') {
        const blob = await getCachedDocumentPdf(
          documentPdfCacheKey(isEstimate ? 'quotation' : 'invoice', invoice.id, invoice.updatedAt || invoice.createdAt),
          () => service.createPdfBlobFromElement(root, 190),
        );
        service.downloadBlob(blob, `${safeFileName}.pdf`);
        showToast('PDF downloaded', 'success');
      } else {
        await service.exportInvoiceAsImage(root, safeFileName, 190);
        showToast('Image downloaded', 'success');
      }
    } catch {
      showToast('Export could not be generated', 'error');
    }
  };
  const openFullScreen = async () => {
    try {
      await viewportRef.current?.requestFullscreen();
    } catch {
      showToast('Full screen is unavailable in this browser', 'info');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(isEstimate ? '/estimates' : '/invoices')} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 font-semibold text-stone-700"><ArrowLeft size={22} />Back to {isEstimate ? 'Quotations' : 'Invoices'}</button>
          <div><h1 className="text-xl font-black text-stone-800 sm:text-2xl">{isEstimate ? documentName : t('invoiceNumber')} #{invoice.invoiceNumber}</h1><p className="mt-1 text-sm text-stone-500">{isEstimate ? `${documentTitle} preview` : 'Tax Invoice preview'}</p></div>
        </div>
        <div className="relative flex w-full flex-wrap gap-2 sm:w-auto">
          <button type="button" onClick={() => setIsExportOpen(true)} className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white sm:flex-none"><Share2 size={18} />Share Document</button>
          <button type="button" onClick={() => navigate(`/${isEstimate ? 'estimates' : 'invoices'}/${invoice.id}/edit`)} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-semibold text-emerald-700"><Edit size={18} />{t('edit')}</button>
          <button type="button" onClick={() => setIsMoreOpen((current) => !current)} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700" aria-label="More document actions" aria-expanded={isMoreOpen}><MoreVertical size={21} /></button>
          {isMoreOpen && (
            <div className="absolute right-0 top-14 z-30 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
              <button type="button" onClick={() => runExportAction('pdf')} className="preview-menu-action"><FileDown size={18} />Download PDF</button>
              <button type="button" onClick={() => runExportAction('image')} className="preview-menu-action"><Image size={18} />Download Image</button>
              <button type="button" onClick={() => { setIsMoreOpen(false); window.print(); }} className="preview-menu-action"><Printer size={18} />Print</button>
              <button type="button" onClick={() => { setIsMoreOpen(false); handleDuplicate(); }} className="preview-menu-action"><Copy size={18} />Duplicate</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={() => setZoom(1)} className="preview-control">Fit Width</button>
        <button type="button" onClick={openFullScreen} className="preview-control"><Maximize2 size={17} />Full Screen</button>
        <div className="ml-auto flex items-center rounded-xl border border-stone-200 bg-white">
          <button type="button" onClick={() => setZoom((current) => Math.max(0.75, current - 0.1))} className="flex min-h-12 min-w-12 items-center justify-center" aria-label="Zoom out"><ZoomOut size={18} /></button>
          <span className="min-w-14 text-center text-sm font-semibold text-stone-700">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((current) => Math.min(1.5, current + 0.1))} className="flex min-h-12 min-w-12 items-center justify-center" aria-label="Zoom in"><ZoomIn size={18} /></button>
        </div>
      </div>

      <div ref={viewportRef} className="canonical-preview-viewport rounded-xl bg-stone-100 print:overflow-visible print:bg-white" style={{ height: preview.height || undefined }}>
        <div className="canonical-preview-transform" style={{ width: A4_INVOICE_WIDTH, transform: `scale(${preview.scale})` }}>
          <div ref={documentRef} className="canonical-preview-document bg-white" data-export-root="true">
            {isEstimate ? <QuotationEstimateTemplate invoice={invoice} profile={state.profile} customer={customer} products={state.products} documentTitle={documentTitle} numberLabel={numberLabel} visibility={state.settings.template.visibility} /> : <CanonicalInvoiceDocument invoice={invoice} profile={state.profile} customer={customer} showQr />}
          </div>
        </div>
      </div>

      <ExportPanel isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} documentId={invoice.id} documentType={isEstimate ? 'quotation' : 'invoice'} documentNumber={invoice.invoiceNumber} documentLabel={isEstimate ? documentName : 'Invoice'} updatedAt={invoice.updatedAt || invoice.createdAt} customerId={customer?.id || invoice.customerId} customerName={customer?.name || 'Customer'} customerPhone={customer?.phone} customerWhatsapp={customer?.whatsapp} customerEmail={customer?.email || ''} defaultCcEmail={state.settings.emailCcBusiness ? state.profile.email : ''} emailEnabled={state.settings.integrations.serverEmail} businessName={state.profile.name} exportRootRef={documentRef} onPrint={() => window.print()} widthMm={190} />
    </div>
  );
}
