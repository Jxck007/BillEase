import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Edit, Share2 } from 'lucide-react';
import ExportPanel from '../components/export/ExportPanel';
import { format } from 'date-fns';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, roundMoney } from '../lib/utils';
import { duplicateInvoice, saveDraft } from '../services/invoiceService';
import { TEMPLATE_PRESETS } from '../templates/invoiceTemplates';
import TraditionalTaxInvoice from '../components/invoices/TraditionalTaxInvoice';
import QuotationEstimateTemplate from '../templates/QuotationEstimateTemplate';
import { withDefaultCustomerFieldVisibility } from '../lib/invoiceCustomerFields';
import { getEstimateDocumentName, getEstimateDocumentTitle, getEstimateNumberLabel } from '../lib/estimateUtils';

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-stone-800">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-stone-500">{subtitle}</p>}
    </div>
  );
}

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useData();
  const { t, language } = useLanguage();
  const [isThermal, setIsThermal] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const estimateExportRootRef = useRef<HTMLDivElement>(null);
  const invoiceExportRootRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const invoice = state.invoices.find((entry) => entry.id === id);
  const customer = state.customers.find((entry) => entry.id === invoice?.customerId);

  // Fit document preview to screen width
  const updateScale = useCallback(() => {
    if (!scalerRef.current) return;
    const container = scalerRef.current.parentElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const docWidth = scalerRef.current.scrollWidth || 794;
    if (containerWidth < docWidth) {
      setPreviewScale(Math.max(0.3, containerWidth / docWidth));
    } else {
      setPreviewScale(1);
    }
  }, []);

  useEffect(() => {
    updateScale();
    const observer = new ResizeObserver(updateScale);
    const el = scalerRef.current?.parentElement;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [updateScale]);

  if (!invoice) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm">
        <div className="text-lg font-bold text-stone-800">{language === 'en' ? 'Invoice not found' : 'Invoice not found'}</div>
        <p className="mt-2 text-sm text-stone-500">{language === 'en' ? 'The record may have been deleted or the link is outdated.' : 'The record may have been deleted or the link is outdated.'}</p>
        <button type="button" onClick={() => navigate('/invoices')} className="mt-6 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white">{language === 'en' ? 'Go to invoices' : 'Go to invoices'}</button>
      </div>
    );
  }

  const isEstimate = invoice.type === 'estimate';
  const template = TEMPLATE_PRESETS[invoice.templateId || state.settings.defaultTemplate];
  const visibility = template.visibility;
  const customerVisibility = withDefaultCustomerFieldVisibility(invoice.customerFieldVisibility);
  const balance = useMemo(() => roundMoney(Math.max(0, invoice.total - invoice.amountPaid)), [invoice.total, invoice.amountPaid]);
  const hasDiscount = (invoice.discountTotal || 0) > 0;
  const hasRoundOff = Math.abs(invoice.roundOff || 0) > 0;
  const documentName = getEstimateDocumentName(state.settings, language);
  const documentTitle = getEstimateDocumentTitle(state.settings);
  const numberLabel = getEstimateNumberLabel(state.settings);
  const shareDocumentLabel = isEstimate ? documentName : 'Invoice';

  const estimateTemplateProps = {
    invoice,
    profile: state.profile,
    customer,
    products: state.products,
    documentTitle,
    numberLabel,
    visibility,
  };

  const exportRootRef = isEstimate ? estimateExportRootRef : invoiceExportRootRef;

  const handleDuplicate = () => {
    const nextNumber = state.invoices.filter((entry) => entry.type === invoice.type).length + 1;
    const draft = duplicateInvoice(invoice, state.settings.invoicePrefix, nextNumber);
    saveDraft({ ...draft, type: invoice.type, templateId: invoice.templateId, placeOfSupply: invoice.placeOfSupply });
    navigate(invoice.type === 'estimate' ? '/estimates/new' : '/invoices/new');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back" title="Back" onClick={() => navigate(invoice.type === 'estimate' ? '/estimates' : '/invoices')} className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 shadow-sm">
            <ArrowLeft size={22} className="text-stone-600" />
            <span className="text-sm font-semibold text-stone-700">{isEstimate ? 'Back to Quotations' : 'Back to Invoices'}</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-stone-800 sm:text-2xl">{isEstimate ? documentName : t('invoiceNumber')} #{invoice.invoiceNumber}</h1>
            <p className="text-xs text-stone-500">{isEstimate ? `${documentTitle} layout preview` : 'Template-aware document preview'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsExportOpen(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm">
            <Share2 size={18} /> Export / Share
          </button>
          <button type="button" onClick={handleDuplicate} className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 font-semibold text-stone-700 shadow-sm">
            <Copy size={18} /> {t('duplicate')}
          </button>
          <button type="button" onClick={() => navigate(`/${invoice.type === 'estimate' ? 'estimates' : 'invoices'}/${invoice.id}/edit`)} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-semibold text-emerald-700 shadow-sm">
            <Edit size={18} /> {t('edit')}
          </button>
        </div>
      </div>

      {!isEstimate && (
        <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-sm print:hidden">
          <label className="flex items-center gap-2 font-medium text-stone-700">
            <input type="checkbox" checked={isThermal} onChange={(event) => setIsThermal(event.target.checked)} />
            Thermal layout
          </label>
          <div className="text-stone-500">Balance due: <span className="font-bold text-stone-800">{formatCurrency(balance)}</span></div>
        </div>
      )}

      <div className="overflow-x-auto print:overflow-visible">
        {isEstimate ? (
          <>
            <div className="preview-scaler" ref={scalerRef}>
              <div ref={printRef} className="estimate-preview-root screen-only mx-auto bg-white p-0 shadow-none print:shadow-none print:border-0" style={{ transform: previewScale < 1 ? `scale(${previewScale})` : 'none', transformOrigin: 'top center' }}>
                <QuotationEstimateTemplate {...estimateTemplateProps} />
              </div>
            </div>
            <div className="hidden print:block">
              <QuotationEstimateTemplate {...estimateTemplateProps} />
            </div>
            <div className="export-capture-source fixed -left-[10000px] top-0 w-[190mm] bg-white p-0" aria-hidden="true">
              <div ref={estimateExportRootRef}>
                <QuotationEstimateTemplate {...estimateTemplateProps} />
              </div>
            </div>
          </>
        ) : (
        <>
        <div ref={printRef} className={`screen-only mx-auto bg-white shadow-sm print:shadow-none print:border-0 ${isThermal ? 'w-[80mm] p-4 text-[12px] leading-tight font-mono text-black print:hidden' : 'w-full rounded-3xl border p-6 md:p-10 print:hidden'}`}>
          {isThermal ? (
            <div className="space-y-3">
              <div className="text-center">
                {visibility.logo && state.profile.logo ? <img src={state.profile.logo} alt="logo" className="mx-auto mb-2 h-12 w-12 rounded-full object-cover" /> : null}
                <div className="text-lg font-bold">{state.profile.name}</div>
              </div>
              <div className="border-t border-dashed border-stone-800" />
              <div className="text-center font-bold">{invoice.type === 'estimate' ? 'ESTIMATE' : 'TAX INVOICE'}</div>
              <div className="text-center font-bold">#{invoice.invoiceNumber}</div>
              <div className="text-center">{format(new Date(invoice.date), 'dd/MM/yyyy')}</div>
              <div>
                <div className="font-bold">To: {customer?.name || '-'}</div>
                {customerVisibility.phone && customer?.phone && <div>Ph: {customer.phone}</div>}
                {customerVisibility.gstNumber && customer?.gstNumber && <div>GSTIN: {customer.gstNumber}</div>}
              </div>
              <div className="border-t border-dashed border-stone-800" />
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-dashed border-stone-800">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-2">{item.name}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right font-bold">{formatCurrency(item.quantity * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-dashed border-stone-800 pt-2 text-right">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-6 border-b border-stone-200 pb-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    {visibility.logo && state.profile.logo ? <img src={state.profile.logo} alt="logo" className="h-14 w-14 rounded-2xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-black">B</div>}
                    <div>
                      <h2 className="text-3xl font-black text-stone-800">{state.profile.name}</h2>
                      {state.profile.tagline && <p className="text-sm text-stone-500">{state.profile.tagline}</p>}
                    </div>
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <h3 className="text-4xl font-black uppercase tracking-wider text-stone-300">{invoice.type === 'estimate' ? 'ESTIMATE' : 'TAX INVOICE'}</h3>
                  <p className="mt-2 text-lg font-bold text-stone-800">#{invoice.invoiceNumber}</p>
                  <p className="text-sm text-stone-500">{format(new Date(invoice.date), 'dd MMM yyyy')}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-stone-200 mt-6">
                <table className="w-full text-left">
                  <thead className="bg-stone-50">
                    <tr className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      <th className="px-4 py-3">{t('itemName')}</th>
                      <th className="px-4 py-3 text-center">{t('quantity')}</th>
                      <th className="px-4 py-3 text-right">{t('price')}</th>
                      <th className="px-4 py-3 text-right">{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4">
                          <div className="font-bold text-stone-800">{item.name}</div>
                          {item.description && <div className="mt-1 text-sm text-stone-500">{item.description}</div>}
                        </td>
                        <td className="px-4 py-4 text-center">{item.quantity}</td>
                        <td className="px-4 py-4 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-4 text-right font-bold text-stone-800">{formatCurrency(item.quantity * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-6 py-6 md:grid-cols-2">
                <div>
                  <SectionTitle title="Billed To" subtitle="Customer details" />
                  <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                    <div className="font-bold text-stone-800">{customer?.name || '-'}</div>
                    {customerVisibility.address && customer?.address && <div className="mt-1 whitespace-pre-wrap">{customer.address}</div>}
                    {customerVisibility.phone && customer?.phone && <div className="mt-1">{customer.phone}</div>}
                    {customerVisibility.email && customer?.email && <div className="mt-1">{customer.email}</div>}
                    {customerVisibility.gstNumber && customer?.gstNumber && <div className="mt-1 font-medium">GSTIN: {customer.gstNumber}</div>}
                  </div>
                </div>
                <div className="space-y-3 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex justify-between"><span>{t('subtotal')}</span><span>{formatCurrency(invoice.subtotal)}</span></div>
                  <div className="flex justify-between"><span>{t('cgst')}</span><span>{formatCurrency(invoice.cgstTotal || invoice.taxTotal / 2)}</span></div>
                  <div className="flex justify-between"><span>{t('sgst')}</span><span>{formatCurrency(invoice.sgstTotal || invoice.taxTotal / 2)}</span></div>
                  <div className="flex justify-between"><span>{t('igst')}</span><span>{formatCurrency(invoice.igstTotal || 0)}</span></div>
                  {hasDiscount && <div className="flex justify-between text-amber-700"><span>{t('discount')}</span><span>-{formatCurrency(invoice.discountTotal)}</span></div>}
                  {hasRoundOff && <div className="flex justify-between"><span>Round Off</span><span>{formatCurrency(invoice.roundOff || 0)}</span></div>}
                  <div className="flex justify-between border-t border-stone-200 pt-3 text-lg font-black text-stone-900"><span>{t('grandTotal')}</span><span>{formatCurrency(invoice.total)}</span></div>
                  <div className="flex justify-between rounded-2xl bg-rose-50 px-3 py-2 font-bold text-rose-700"><span>{t('balanceDue')}</span><span>{formatCurrency(balance)}</span></div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden print:block">
          <TraditionalTaxInvoice invoice={invoice} profile={state.profile} customer={customer} showQr={visibility.qrCode} />
        </div>

        <div className="export-capture-source fixed -left-[10000px] top-0 w-[190mm] bg-white p-0" aria-hidden="true">
          <div ref={invoiceExportRootRef}>
            <TraditionalTaxInvoice invoice={invoice} profile={state.profile} customer={customer} showQr={visibility.qrCode} />
          </div>
        </div>
        </>
        )}
      </div>

      {/* Export Panel */}
      <ExportPanel
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        documentType={isEstimate ? 'quotation' : 'invoice'}
        documentNumber={invoice.invoiceNumber}
        documentLabel={isEstimate ? documentName : 'Invoice'}
        customerName={customer?.name || 'Customer'}
        customerPhone={customer?.phone}
        customerWhatsapp={customer?.whatsapp || customer?.phone}
        customerEmail={customer?.email || ''}
        businessName={state.profile.name}
        exportRootRef={exportRootRef}
        onPrint={() => window.print()}
        widthMm={190}
      />
    </div>
  );
}
