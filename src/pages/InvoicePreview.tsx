import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Copy, Edit, FileDown, Image, MoreVertical, Printer, ReceiptIndianRupee, RotateCcw, Share2, Wrench } from 'lucide-react';
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
import RecordPaymentModal from '../components/payments/RecordPaymentModal';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import PaymentReceiptModal from '../components/payments/PaymentReceiptModal';
import type { Payment } from '../lib/types';

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, reversePayment, correctPayment, cancelInvoice } = useData();
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState('');
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [paymentChange, setPaymentChange] = useState<{ kind: 'reverse' | 'correct'; paymentId: string; reason: string; amount: string; review: boolean } | null>(null);
  const { showToast } = useToast();
  const documentRef = useRef<HTMLDivElement>(null);
  const invoice = state.invoices.find((entry) => entry.id === id);
  const customer = state.customers.find((entry) => entry.id === invoice?.customerId) || (invoice?.customerSnapshot ? {
    ...invoice.customerSnapshot,
    createdAt: invoice.createdAt,
    gstin: invoice.customerSnapshot.gstNumber,
  } : undefined);
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
  const handleReverse = async (paymentId: string) => {
    setPaymentChange({ kind: 'reverse', paymentId, reason: '', amount: '', review: false });
  };
  const handleCorrect = async (paymentId: string) => {
    const payment = invoice.payments.find((entry) => entry.id === paymentId);
    if (!payment) return;
    setPaymentChange({ kind: 'correct', paymentId, reason: '', amount: payment.amount.toFixed(2), review: false });
  };
  const submitPaymentChange = async () => {
    if (!paymentChange?.reason.trim()) return;
    const payment = invoice.payments.find((entry) => entry.id === paymentChange.paymentId);
    if (!payment) return;
    if (!paymentChange.review) {
      if (paymentChange.kind === 'correct' && (!Number.isFinite(Number(paymentChange.amount)) || Number(paymentChange.amount) <= 0)) return;
      setPaymentChange({ ...paymentChange, review: true });
      return;
    }
    setPaymentBusy(payment.id);
    const result = paymentChange.kind === 'reverse'
      ? await reversePayment(invoice.id, payment.id, paymentChange.reason)
      : await correctPayment(invoice.id, payment.id, { amount: Number(paymentChange.amount), paidAt: payment.paidAt, method: payment.method, reference: payment.reference, notes: payment.notes }, paymentChange.reason);
    showToast(result.ok ? (language === 'ta' ? (paymentChange.kind === 'reverse' ? 'கட்டணம் மாற்றப்பட்டது' : 'கட்டணம் திருத்தப்பட்டது') : (paymentChange.kind === 'reverse' ? 'Payment reversed' : 'Payment corrected')) : (result.errors?.[0]?.message || 'Payment could not be updated'), result.ok ? 'success' : 'error');
    setPaymentBusy('');
    if (result.ok) setPaymentChange(null);
  };
  const handleCancelInvoice = async () => {
    const reason = window.prompt(language === 'ta' ? 'ரத்து செய்வதற்கான காரணம் அவசியம்' : 'Reason for cancellation (required)');
    if (!reason?.trim() || !window.confirm(language === 'ta' ? 'இந்த விலைப்பட்டியலை ரத்து செய்யவா?' : 'Cancel this invoice?')) return;
    const result = await cancelInvoice(invoice.id, reason);
    showToast(result.ok ? (language === 'ta' ? 'விலைப்பட்டியல் ரத்து செய்யப்பட்டது' : 'Invoice cancelled') : (result.errors?.[0]?.message || 'Invoice could not be cancelled'), result.ok ? 'success' : 'error');
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate(isEstimate ? '/estimates' : '/invoices')} aria-label={`${t('back')} · ${isEstimate ? t('quotations') : t('invoices')}`} className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-700 sm:px-4"><ArrowLeft size={21} /><span className="hidden sm:inline">{t('back')} · {isEstimate ? t('quotations') : t('invoices')}</span></button>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-black text-stone-800 sm:text-2xl">{isEstimate ? documentName : t('invoiceNumber')} #{invoice.invoiceNumber}</h1>{!isEstimate ? <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">{t(invoice.paymentStatus)}</span> : null}</div><p className="mt-1 text-sm text-stone-500">{language === 'ta' ? 'ஆவண முன்னோட்டம்' : `${isEstimate ? documentTitle : 'Tax Invoice'} preview`}</p></div>
        </div>
        <div className="relative grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button type="button" onClick={() => setIsExportOpen(true)} className={`primary-action-button ${isEstimate ? 'col-span-2 sm:col-span-1' : ''}`}><Share2 size={18} />{t('shareDocument')}</button>
          {!isEstimate && isAdmin && !['paid', 'cancelled'].includes(invoice.paymentStatus) ? <button type="button" onClick={() => setIsPaymentOpen(true)} className="primary-action-button bg-blue-600 hover:bg-blue-700"><ReceiptIndianRupee size={18} />{t('recordPayment')}</button> : null}
          <button type="button" onClick={() => navigate(`/${isEstimate ? 'estimates' : 'invoices'}/${invoice.id}/edit`)} className="secondary-action-button"><Edit size={18} />{t('edit')}</button>
          <button type="button" onClick={() => setIsMoreOpen((current) => !current)} className="secondary-action-button" aria-label="More document actions" aria-expanded={isMoreOpen}><MoreVertical size={20} /><span>{language === 'ta' ? 'மேலும்' : 'More'}</span></button>
          {isMoreOpen && (
            <div className="absolute right-0 top-14 z-30 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
              <button type="button" onClick={() => runExportAction('pdf')} className="preview-menu-action"><FileDown size={18} />{t('downloadPdf')}</button>
              <button type="button" onClick={() => runExportAction('image')} className="preview-menu-action"><Image size={18} />{t('downloadImage')}</button>
              <button type="button" onClick={() => { setIsMoreOpen(false); window.print(); }} className="preview-menu-action"><Printer size={18} />{t('print')}</button>
              <button type="button" onClick={() => { setIsMoreOpen(false); handleDuplicate(); }} className="preview-menu-action"><Copy size={18} />{t('duplicate')}</button>
              {!isEstimate && isAdmin && invoice.paymentStatus !== 'cancelled' ? <button type="button" onClick={() => { setIsMoreOpen(false); handleCancelInvoice(); }} className="preview-menu-action text-rose-700"><Ban size={18} />{language === 'ta' ? 'விலைப்பட்டியலை ரத்து செய்' : 'Cancel invoice'}</button> : null}
            </div>
          )}
        </div>
      </div>

      <CanonicalDocumentViewport documentRef={documentRef}>
        {isEstimate ? <QuotationEstimateTemplate invoice={invoice} profile={state.profile} customer={customer} products={state.products} documentTitle={documentTitle} numberLabel={numberLabel} visibility={state.settings.template.visibility} /> : <CanonicalInvoiceDocument invoice={invoice} profile={state.profile} customer={customer} showQr showPaymentSummary={state.settings.showPaymentSummaryOnPdf !== false} />}
      </CanonicalDocumentViewport>

      {!isEstimate && isAdmin ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 print:hidden">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-lg font-black text-stone-900">{language === 'ta' ? 'கட்டண வரலாறு' : 'Payment history'}</h2><p className="text-sm text-stone-500">{t(invoice.paymentStatus)} · {formatCurrency(invoice.amountPaid)} {language === 'ta' ? 'செலுத்தப்பட்டது' : 'paid'} · {formatCurrency(invoice.balanceDue)} {language === 'ta' ? 'நிலுவை' : 'due'}</p></div>
            {invoice.payments.length > 0 && !['paid', 'cancelled'].includes(invoice.paymentStatus) ? <button type="button" onClick={() => setIsPaymentOpen(true)} className="min-h-11 px-1 text-sm font-bold text-blue-700 underline-offset-4 hover:underline">{language === 'ta' ? 'மற்றொரு கட்டணத்தைச் சேர்' : 'Add another payment'}</button> : null}
          </div>
          {invoice.payments.length ? <>
            <div className="mt-4 grid gap-3 md:hidden">{invoice.payments.map((payment) => {
              const reversed = payment.kind === 'payment' && invoice.payments.some((entry) => entry.kind === 'reversal' && entry.originalPaymentId === payment.id);
              const status = payment.kind === 'reversal' ? (language === 'ta' ? 'மாற்றப்பட்டது' : 'Reversal') : reversed ? (language === 'ta' ? 'திருத்தப்பட்டது / மாற்றப்பட்டது' : 'Corrected / reversed') : (language === 'ta' ? 'செயலில்' : 'Active');
              return <article key={payment.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className={`text-xl font-black ${payment.kind === 'reversal' ? 'text-rose-700' : 'text-emerald-700'}`}>{payment.kind === 'reversal' ? '−' : '+'}{formatCurrency(payment.amount)}</p><p className="mt-1 text-sm text-stone-600">{new Date(payment.paidAt).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN')} · {paymentMethodLabel(payment.method, language)}</p></div><span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">{status}</span></div>
                {payment.reference && <p className="mt-3 break-all text-sm"><span className="text-stone-500">{language === 'ta' ? 'குறிப்பு' : 'Reference'}:</span> {payment.reference}</p>}
                {payment.reason && <p className="mt-2 text-sm text-stone-600">{payment.reason}</p>}
                <p className="mt-3 text-sm font-semibold text-stone-700">{language === 'ta' ? 'தற்போதைய நிலுவை' : 'Current invoice balance'}: {formatCurrency(invoice.balanceDue)}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">{payment.kind === 'payment' && !reversed ? <><button disabled={paymentBusy === payment.id} onClick={() => handleCorrect(payment.id)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-sm font-semibold"><Wrench size={15} />{language === 'ta' ? 'திருத்து' : 'Correct'}</button><button disabled={paymentBusy === payment.id} onClick={() => handleReverse(payment.id)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-rose-200 px-2 text-sm font-semibold text-rose-700"><RotateCcw size={15} />{language === 'ta' ? 'மாற்று' : 'Reverse'}</button><button onClick={() => setReceiptPayment(payment)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-sm font-semibold"><ReceiptIndianRupee size={15} />{language === 'ta' ? 'ரசீது' : 'Receipt'}</button></> : null}</div>
              </article>;
            })}</div>
            <div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2">{language === 'ta' ? 'தேதி' : 'Date'}</th><th>{language === 'ta' ? 'முறை' : 'Method'}</th><th>{language === 'ta' ? 'குறிப்பு' : 'Reference'}</th><th className="text-right">{language === 'ta' ? 'தொகை' : 'Amount'}</th><th className="text-right">{language === 'ta' ? 'செயல்கள்' : 'Actions'}</th></tr></thead><tbody>{invoice.payments.map((payment) => <tr key={payment.id} className="border-b last:border-0"><td className="py-3">{new Date(payment.paidAt).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN')}</td><td>{paymentMethodLabel(payment.method, language)}</td><td>{payment.reference || '—'}{payment.reason ? <div className="text-xs text-stone-500">{payment.reason}</div> : null}</td><td className={`text-right font-bold ${payment.kind === 'reversal' ? 'text-rose-700' : 'text-emerald-700'}`}>{payment.kind === 'reversal' ? '−' : '+'}{formatCurrency(payment.amount)}</td><td><div className="flex justify-end gap-2">{payment.kind === 'payment' && !invoice.payments.some((entry) => entry.kind === 'reversal' && entry.originalPaymentId === payment.id) ? <><button disabled={paymentBusy === payment.id} onClick={() => handleCorrect(payment.id)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3"><Wrench size={14} />{language === 'ta' ? 'திருத்து' : 'Correct'}</button><button disabled={paymentBusy === payment.id} onClick={() => handleReverse(payment.id)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-rose-200 px-3 text-rose-700"><RotateCcw size={14} />{language === 'ta' ? 'மாற்று' : 'Reverse'}</button><button onClick={() => setReceiptPayment(payment)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3"><ReceiptIndianRupee size={14} />{language === 'ta' ? 'ரசீது' : 'Receipt'}</button></> : null}</div></td></tr>)}</tbody></table></div>
          </> : <p className="mt-4 text-sm text-stone-500">{language === 'ta' ? 'இன்னும் கட்டணங்கள் பதிவு செய்யப்படவில்லை.' : 'No payments recorded yet.'}</p>}
        </section>
      ) : null}

      <ExportPanel isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} documentId={invoice.id} documentType={isEstimate ? 'quotation' : 'invoice'} documentNumber={invoice.invoiceNumber} documentLabel={isEstimate ? documentName : 'Invoice'} updatedAt={invoice.updatedAt || invoice.createdAt} customerId={customer?.id || invoice.customerId} customerName={customer?.name || 'Customer'} customerPhone={customer?.phone} customerWhatsapp={customer?.whatsapp} customerEmail={customer?.email || ''} defaultCcEmail={state.settings.emailCcBusiness ? state.profile.email : ''} emailEnabled={state.settings.integrations.serverEmail} businessName={state.profile.name} exportRootRef={documentRef} onPrint={() => window.print()} widthMm={210} />
      <RecordPaymentModal invoice={invoice} isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} onSaved={() => showToast(language === 'ta' ? 'கட்டணம் உள்ளூரில் சேமிக்கப்பட்டது' : 'Payment saved locally and queued for sync', 'success')} />
      <PaymentReceiptModal payment={receiptPayment} invoice={invoice} onClose={() => setReceiptPayment(null)} />
      <Modal isOpen={Boolean(paymentChange)} onClose={() => setPaymentChange(null)} title={paymentChange?.kind === 'correct' ? (language === 'ta' ? 'கட்டணத்தைத் திருத்து' : 'Correct payment') : (language === 'ta' ? 'கட்டணத்தை மாற்று' : 'Reverse payment')} role={paymentChange?.review ? 'alertdialog' : 'dialog'} closeOnBackdrop={!paymentChange?.review} closeOnEscape={!paymentChange?.review} description={language === 'ta' ? 'அசல் கட்டணம் வரலாற்றில் இருக்கும். வசூலிக்கப்பட்ட மற்றும் நிலுவைத் தொகைகள் புதுப்பிக்கப்படும்.' : 'The original payment remains in history. Collected and outstanding amounts will be updated.'}>
        {paymentChange && <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{language === 'ta' ? 'இந்த மாற்றம் கட்டண வரலாற்றை நீக்காது.' : 'This change does not delete payment history.'}</div>
          {paymentChange.kind === 'correct' && <label className="block text-sm font-semibold">{language === 'ta' ? 'சரியான தொகை' : 'Correct amount'}<input type="text" inputMode="decimal" value={paymentChange.amount} disabled={paymentChange.review} onChange={(event) => setPaymentChange({ ...paymentChange, amount: event.target.value, review: false })} className="mt-1 min-h-12 w-full rounded-xl border p-3" required /></label>}
          <label className="block text-sm font-semibold">{language === 'ta' ? 'காரணம் (தேவை)' : 'Reason (required)'}<textarea value={paymentChange.reason} disabled={paymentChange.review} onChange={(event) => setPaymentChange({ ...paymentChange, reason: event.target.value, review: false })} rows={3} className="mt-1 w-full rounded-xl border p-3" required /></label>
          {paymentChange.review && <div className="rounded-xl bg-stone-50 p-4 text-sm"><p className="font-bold">{language === 'ta' ? 'உறுதிப்படுத்தும் முன் சரிபார்க்கவும்' : 'Review before confirming'}</p><p className="mt-2">{language === 'ta' ? 'காரணம்' : 'Reason'}: {paymentChange.reason}</p>{paymentChange.kind === 'correct' && <p>{language === 'ta' ? 'புதிய தொகை' : 'New amount'}: {formatCurrency(Number(paymentChange.amount))}</p>}</div>}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => paymentChange.review ? setPaymentChange({ ...paymentChange, review: false }) : setPaymentChange(null)} className="min-h-12 rounded-xl border px-4 font-semibold">{paymentChange.review ? (language === 'ta' ? 'திருத்து' : 'Back') : t('cancel')}</button><button type="button" onClick={submitPaymentChange} disabled={!paymentChange.reason.trim() || paymentBusy === paymentChange.paymentId || (paymentChange.kind === 'correct' && Number(paymentChange.amount) <= 0)} className="min-h-12 rounded-xl bg-rose-700 px-4 font-semibold text-white disabled:opacity-50">{paymentChange.review ? (language === 'ta' ? 'உறுதிசெய்' : 'Confirm change') : (language === 'ta' ? 'சரிபார்க்கவும்' : 'Review change')}</button></div>
        </div>}
      </Modal>
    </div>
  );
}

function paymentMethodLabel(method: Payment['method'], language: 'en' | 'ta') {
  const labels = language === 'ta'
    ? { cash: 'ரொக்கம்', UPI: 'UPI', bank_transfer: 'வங்கிப் பரிமாற்றம்', cheque: 'காசோலை', card: 'அட்டை', other: 'மற்றவை' }
    : { cash: 'Cash', UPI: 'UPI', bank_transfer: 'Bank transfer', cheque: 'Cheque', card: 'Card', other: 'Other' };
  return labels[method];
}
