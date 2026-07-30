import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Edit, FileDown, Image, MoreVertical, Printer, Share2 } from 'lucide-react';
import ExportPanel from '../components/export/ExportPanel';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { duplicateInvoice, saveDraft } from '../services/invoiceService';
import CanonicalInvoiceDocument from '../components/invoices/TraditionalTaxInvoice';
import QuotationEstimateTemplate from '../templates/QuotationEstimateTemplate';
import { getEstimateDocumentName, getEstimateDocumentTitle, getEstimateNumberLabel } from '../lib/estimateUtils';
import { useToast } from '../context/ToastContext';
import { documentPdfCacheKey, getCachedDocumentPdf } from '../services/documentPdfCache';
import CanonicalDocumentViewport from '../components/documents/CanonicalDocumentViewport';

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useData();
  const { t, language } = useLanguage();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { showToast } = useToast();
  const documentRef = useRef<HTMLDivElement>(null);
  const invoice = state.invoices.find((entry) => entry.id === id);
  const customer = state.customers.find((entry) => entry.id === invoice?.customerId);
  const isEstimate = invoice?.type === 'estimate';

  if (!invoice) return <div className="mx-auto max-w-xl rounded-3xl border bg-white p-8 text-center"><div className="text-lg font-bold text-stone-800">{language === 'ta' ? 'விலைப்பட்டியல் கிடைக்கவில்லை' : 'Invoice not found'}</div><button type="button" onClick={() => navigate('/invoices')} className="mt-6 min-h-[48px] rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white">{language === 'ta' ? 'விலைப்பட்டியல்களுக்குச் செல்' : 'Go to invoices'}</button></div>;

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
          () => service.createPdfBlobFromElement(root, 210),
        );
        service.downloadBlob(blob, `${safeFileName}.pdf`);
        showToast(t('pdfDownloaded'), 'success');
      } else {
        await service.exportInvoiceAsImage(root, safeFileName, 210);
        showToast(t('imageDownloaded'), 'success');
      }
    } catch {
      showToast(language === 'ta' ? 'ஏற்றுமதியை உருவாக்க முடியவில்லை' : 'Export could not be generated', 'error');
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(isEstimate ? '/estimates' : '/invoices')} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 font-semibold text-stone-700"><ArrowLeft size={22} />{t('back')} · {isEstimate ? t('quotations') : t('invoices')}</button>
          <div><h1 className="text-xl font-black text-stone-800 sm:text-2xl">{isEstimate ? documentName : t('invoiceNumber')} #{invoice.invoiceNumber}</h1><p className="mt-1 text-sm text-stone-500">{language === 'ta' ? 'ஆவண முன்னோட்டம்' : `${isEstimate ? documentTitle : 'Tax Invoice'} preview`}</p></div>
        </div>
        <div className="relative flex w-full flex-wrap gap-2 sm:w-auto">
          <button type="button" onClick={() => setIsExportOpen(true)} className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white sm:flex-none"><Share2 size={18} />{t('shareDocument')}</button>
          <button type="button" onClick={() => navigate(`/${isEstimate ? 'estimates' : 'invoices'}/${invoice.id}/edit`)} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-semibold text-emerald-700"><Edit size={18} />{t('edit')}</button>
          <button type="button" onClick={() => setIsMoreOpen((current) => !current)} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700" aria-label="More document actions" aria-expanded={isMoreOpen}><MoreVertical size={21} /></button>
          {isMoreOpen && (
            <div className="absolute right-0 top-14 z-30 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
              <button type="button" onClick={() => runExportAction('pdf')} className="preview-menu-action"><FileDown size={18} />{t('downloadPdf')}</button>
              <button type="button" onClick={() => runExportAction('image')} className="preview-menu-action"><Image size={18} />{t('downloadImage')}</button>
              <button type="button" onClick={() => { setIsMoreOpen(false); window.print(); }} className="preview-menu-action"><Printer size={18} />{t('print')}</button>
              <button type="button" onClick={() => { setIsMoreOpen(false); handleDuplicate(); }} className="preview-menu-action"><Copy size={18} />{t('duplicate')}</button>
            </div>
          )}
        </div>
      </div>

      <CanonicalDocumentViewport documentRef={documentRef}>
        {isEstimate ? <QuotationEstimateTemplate invoice={invoice} profile={state.profile} customer={customer} products={state.products} documentTitle={documentTitle} numberLabel={numberLabel} visibility={state.settings.template.visibility} /> : <CanonicalInvoiceDocument invoice={invoice} profile={state.profile} customer={customer} showQr />}
      </CanonicalDocumentViewport>

      <ExportPanel isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} documentId={invoice.id} documentType={isEstimate ? 'quotation' : 'invoice'} documentNumber={invoice.invoiceNumber} documentLabel={isEstimate ? documentName : 'Invoice'} updatedAt={invoice.updatedAt || invoice.createdAt} customerId={customer?.id || invoice.customerId} customerName={customer?.name || 'Customer'} customerPhone={customer?.phone} customerWhatsapp={customer?.whatsapp} customerEmail={customer?.email || ''} defaultCcEmail={state.settings.emailCcBusiness ? state.profile.email : ''} emailEnabled={state.settings.integrations.serverEmail} businessName={state.profile.name} exportRootRef={documentRef} onPrint={() => window.print()} widthMm={210} />
    </div>
  );
}
