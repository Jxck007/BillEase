import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Edit, Mail, Share2 } from 'lucide-react';
import ExportPanel from '../components/export/ExportPanel';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { duplicateInvoice, saveDraft } from '../services/invoiceService';
import CanonicalInvoiceDocument from '../components/invoices/TraditionalTaxInvoice';
import QuotationEstimateTemplate from '../templates/QuotationEstimateTemplate';
import { getEstimateDocumentName, getEstimateDocumentTitle, getEstimateNumberLabel } from '../lib/estimateUtils';
import EmailDocumentModal from '../components/export/EmailDocumentModal';
import { useIntegrationAvailability } from '../hooks/useIntegrationAvailability';

const A4_INVOICE_WIDTH = 190 * (96 / 25.4);

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useData();
  const { t, language } = useLanguage();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const { availability } = useIntegrationAvailability();
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
    const scale = Math.min(1, Math.max(0.3, viewport.clientWidth / A4_INVOICE_WIDTH));
    setPreview({ scale, height: Math.ceil(document.scrollHeight * scale) });
  }, []);

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(isEstimate ? '/estimates' : '/invoices')} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 font-semibold text-stone-700"><ArrowLeft size={22} />Back to {isEstimate ? 'Quotations' : 'Invoices'}</button>
          <div><h1 className="text-xl font-black text-stone-800 sm:text-2xl">{isEstimate ? documentName : t('invoiceNumber')} #{invoice.invoiceNumber}</h1><p className="mt-1 text-sm text-stone-500">{isEstimate ? `${documentTitle} preview` : 'Tax Invoice preview'}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsExportOpen(true)} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 font-semibold text-white"><Share2 size={18} />Share Document</button>
          {availability.email && state.settings.integrations.serverEmail && <button type="button" onClick={() => setIsEmailOpen(true)} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 font-semibold text-emerald-800"><Mail size={18} />Send Email</button>}
          <button type="button" onClick={handleDuplicate} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 font-semibold text-stone-700"><Copy size={18} />{t('duplicate')}</button>
          <button type="button" onClick={() => navigate(`/${isEstimate ? 'estimates' : 'invoices'}/${invoice.id}/edit`)} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-semibold text-emerald-700"><Edit size={18} />{t('edit')}</button>
        </div>
      </div>

      <div ref={viewportRef} className="canonical-preview-viewport print:overflow-visible" style={{ height: preview.height || undefined }}>
        <div className="canonical-preview-transform" style={{ width: A4_INVOICE_WIDTH, transform: `scale(${preview.scale})` }}>
          <div ref={documentRef} className="canonical-preview-document bg-white" data-export-root="true">
            {isEstimate ? <QuotationEstimateTemplate invoice={invoice} profile={state.profile} customer={customer} products={state.products} documentTitle={documentTitle} numberLabel={numberLabel} visibility={state.settings.template.visibility} /> : <CanonicalInvoiceDocument invoice={invoice} profile={state.profile} customer={customer} showQr />}
          </div>
        </div>
      </div>

      <ExportPanel isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} documentType={isEstimate ? 'quotation' : 'invoice'} documentNumber={invoice.invoiceNumber} documentLabel={isEstimate ? documentName : 'Invoice'} customerName={customer?.name || 'Customer'} customerPhone={customer?.phone} customerWhatsapp={customer?.whatsapp} customerEmail={customer?.email || ''} businessName={state.profile.name} exportRootRef={documentRef} onPrint={() => window.print()} widthMm={190} />
      <EmailDocumentModal open={isEmailOpen} onClose={() => setIsEmailOpen(false)} documentId={invoice.id} documentLabel={isEstimate ? documentName : 'Invoice'} documentNumber={invoice.invoiceNumber} businessName={state.profile.name} businessEmail={state.profile.email} ccBusiness={state.settings.emailCcBusiness} customerName={customer?.name || 'Customer'} customerEmail={customer?.email || ''} exportRoot={documentRef.current} />
    </div>
  );
}
