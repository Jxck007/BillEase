import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Plus, FileText, Trash2, Edit, Eye, Download, X } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import CanonicalInvoiceDocument from '../components/invoices/TraditionalTaxInvoice';
import { MAX_BULK_PDFS, prepareBulkDownload } from '../services/bulkDownloadService';

type DateRange = 'any' | 'today' | 'week' | 'month' | 'last_month' | 'financial_year' | 'custom';
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function resolveDateRange(dateRange: DateRange, customFrom: string, customTo: string) {
  if (dateRange === 'any') return { from: '', to: '' };
  if (dateRange === 'custom') return { from: customFrom, to: customTo };
  const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const to = new Date(from);
  if (dateRange === 'week') from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  if (dateRange === 'month') from.setDate(1);
  if (dateRange === 'last_month') { from.setMonth(from.getMonth() - 1, 1); to.setDate(0); }
  if (dateRange === 'financial_year') from.setFullYear(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function Invoices() {
  const { state, deleteInvoice } = useData();
  const { t, language } = useLanguage();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>('any');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [copyMode, setCopyMode] = useState<'current' | 'all'>('current');
  const [bulkProgress, setBulkProgress] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const invoices = state.invoices.filter(i => i.type !== 'estimate');
  const resolvedDates = resolveDateRange(dateRange, fromDate, toDate);

  const filteredInvoices = invoices.filter((invoice) =>
    (statusFilter === 'all' || invoice.paymentStatus === statusFilter)
    && (customerFilter === 'all' || invoice.customerId === customerFilter)
    && (!resolvedDates.from || invoice.date >= resolvedDates.from)
    && (!resolvedDates.to || invoice.date <= resolvedDates.to));
  const activeFilterCount = Number(statusFilter !== 'all') + Number(customerFilter !== 'all') + Number(dateRange !== 'any');
  const clearFilters = () => { setStatusFilter('all'); setCustomerFilter('all'); setDateRange('any'); setFromDate(''); setToDate(''); };
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const dateLabels: Record<DateRange, string> = { any: text('Any time', 'எந்த காலமும்'), today: text('Today', 'இன்று'), week: text('This week', 'இந்த வாரம்'), month: text('This month', 'இந்த மாதம்'), last_month: text('Last month', 'கடந்த மாதம்'), financial_year: text('This financial year', 'இந்த நிதியாண்டு'), custom: text('Custom range', 'தனிப்பயன் தேதி வரம்பு') };
  const selectedInvoices = invoices.filter((invoice) => selectedIds.has(invoice.id));
  const copiesForInvoice = (invoice: typeof invoices[number]) => copyMode === 'all'
    ? ['Original', 'Duplicate', 'Triplicate']
    : [invoice.copyType?.includes('DUPLICATE') ? 'Duplicate' : invoice.copyType?.includes('TRIPLICATE') ? 'Triplicate' : 'Original'];
  const toggleSelection = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const downloadSelected = async () => {
    const total = selectedInvoices.reduce((sum, invoice) => sum + copiesForInvoice(invoice).length, 0);
    if (!total) { showToast('Select at least one invoice.', 'error'); return; }
    if (total > MAX_BULK_PDFS) { showToast(`A batch can contain up to ${MAX_BULK_PDFS} PDFs.`, 'error'); return; }
    const controller = new AbortController();
    setAbortController(controller);
    setBulkRunning(true);
    try {
      const { createPdfBlobFromElement } = await import('../services/exportService');
      const requests = selectedInvoices.flatMap((invoice) => copiesForInvoice(invoice).map((copy) => ({
        id: `${invoice.id}:${copy}`,
        fileName: `Invoice-${invoice.invoiceNumber}-${copy}.pdf`,
        generate: () => {
          const root = document.querySelector<HTMLElement>(`[data-bulk-invoice="${CSS.escape(invoice.id)}"][data-bulk-copy="${copy}"]`);
          if (!root) throw new Error('Invoice render was not available.');
          return createPdfBlobFromElement(root);
        },
      })));
      const result = await prepareBulkDownload(requests, `Invoices-${new Date().toISOString().slice(0, 10)}.zip`, (progress) => {
        setBulkProgress(progress.stage === 'preparing' ? `Preparing ${progress.current} of ${progress.total}` : progress.stage === 'zipping' ? 'Creating ZIP' : 'Download ready');
      }, controller.signal);
      if (result.failed.length) showToast(`${result.prepared} of ${requests.length} documents were prepared. ${result.failed.length} document${result.failed.length === 1 ? '' : 's'} need attention.`, 'error');
      else showToast('Download ready', 'success');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') showToast((error as Error).message, 'error');
    } finally {
      setBulkRunning(false);
      setAbortController(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700" aria-label={text('Back to dashboard', 'முகப்புக்குப் பின்செல்')}><ArrowLeft size={18} /> {text('Dashboard', 'முகப்பு')}</Link>
          <h1 className="text-2xl font-bold text-stone-800">{t('invoices')}</h1>
          <p className="text-stone-500 mt-1">
            {language === 'en' ? 'Manage your structured bills.' : 'உங்கள் விலைப்பட்டியல்களை நிர்வகிக்கவும்.'}
          </p>
        </div>
        <Link to="/invoices/new" className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 flex items-center justify-center gap-2">
          <Plus size={20} />
          {t('createInvoice')}
        </Link>
      </div>

      <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="report-filter-field"><span>{text('Status', 'நிலை')}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={text('Filter invoices by status', 'விலைப்பட்டியல்களை நிலையின்படி வடிகட்டு')}><option value="all">{text('All statuses', 'அனைத்து நிலைகளும்')}</option><option value="paid">{t('paid')}</option><option value="unpaid">{t('unpaid')}</option><option value="partially_paid">{t('partially_paid')}</option><option value="overdue">{t('overdue')}</option><option value="cancelled">{t('cancelled')}</option></select></label>
        <label className="report-filter-field"><span>{text('Customer', 'வாடிக்கையாளர்')}</span><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} aria-label={text('Filter invoices by customer', 'வாடிக்கையாளரின்படி விலைப்பட்டியல்களை வடிகட்டு')}><option value="all">{text('All customers', 'அனைத்து வாடிக்கையாளர்களும்')}</option>{state.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="report-filter-field"><span>{text('Date range', 'தேதி வரம்பு')}</span><select value={dateRange} onChange={(event) => { setDateRange(event.target.value as DateRange); setFromDate(''); setToDate(''); }} aria-label={text('Filter invoices by date range', 'தேதி வரம்பின்படி விலைப்பட்டியல்களை வடிகட்டு')}>{Object.entries(dateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {dateRange === 'custom' && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">{([[fromDate, setFromDate, text('From date', 'தொடக்க தேதி'), text('Select start date', 'தொடக்க தேதியைத் தேர்ந்தெடுக்கவும்')], [toDate, setToDate, text('To date', 'முடிவு தேதி'), text('Select end date', 'முடிவு தேதியைத் தேர்ந்தெடுக்கவும்')]] as const).map(([value, setter, label, placeholder]) => <label key={label} className="report-filter-field"><span>{label}</span><div className="report-date-input"><CalendarDays size={18} aria-hidden="true" /><input type="date" value={value} onChange={(event) => setter(event.target.value)} aria-label={label} />{value && <button type="button" onClick={() => setter('')} aria-label={`${text('Clear', 'அழி')} ${label}`}><X size={16} /></button>}</div>{!value && <small>{placeholder}</small>}</label>)}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-live="polite"><span className="mr-auto text-sm font-semibold text-stone-700">{filteredInvoices.length} {text('invoices', 'விலைப்பட்டியல்கள்')}</span>{statusFilter !== 'all' && <button type="button" onClick={() => setStatusFilter('all')} className="report-filter-chip" aria-label={text(`Remove ${t(statusFilter)} status filter`, `${t(statusFilter)} நிலை வடிகட்டியை அகற்று`)}>{t(statusFilter)}<X size={14} aria-hidden="true" /></button>}{customerFilter !== 'all' && <button type="button" onClick={() => setCustomerFilter('all')} className="report-filter-chip" aria-label={text('Remove customer filter', 'வாடிக்கையாளர் வடிகட்டியை அகற்று')}>{state.customers.find((customer) => customer.id === customerFilter)?.name}<X size={14} aria-hidden="true" /></button>}{dateRange !== 'any' && <button type="button" onClick={() => { setDateRange('any'); setFromDate(''); setToDate(''); }} className="report-filter-chip" aria-label={text('Remove date range filter', 'தேதி வரம்பு வடிகட்டியை அகற்று')}>{dateLabels[dateRange]}<X size={14} aria-hidden="true" /></button>}{activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="min-h-11 px-2 text-sm font-bold text-emerald-700">{text('Clear all', 'அனைத்தையும் அழி')}</button>}</div>

      {selectedIds.size ? <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3">
        <strong>{selectedIds.size} selected</strong>
        <select value={copyMode} onChange={(event) => setCopyMode(event.target.value as 'current' | 'all')} className="rounded-xl border p-2"><option value="current">Download current copy</option><option value="all">Download all copies</option></select>
        <button type="button" disabled={bulkRunning} onClick={downloadSelected} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50"><Download size={18} />Download Selected</button>
        {bulkRunning ? <><span role="status" className="font-semibold text-blue-900">{bulkProgress}</span><button type="button" onClick={() => abortController?.abort()} className="inline-flex items-center gap-1 text-rose-700"><X size={17} />Cancel</button></> : null}
        <span className="text-sm text-blue-800">Maximum {MAX_BULK_PDFS} PDFs per batch.</span>
      </div> : null}

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {filteredInvoices.length > 0 ? (
          <>
            <div className="divide-y divide-stone-100 sm:hidden">
              {filteredInvoices.map((invoice) => {
                const customer = state.customers.find((entry) => entry.id === invoice.customerId) || invoice.customerSnapshot;
                return (
                  <article key={invoice.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <input type="checkbox" checked={selectedIds.has(invoice.id)} onChange={() => toggleSelection(invoice.id)} aria-label={`Select invoice ${invoice.invoiceNumber}`} className="mt-1 h-5 w-5" />
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900">#{invoice.invoiceNumber}</p>
                        <p className="mt-1 truncate text-sm font-medium text-stone-700">{customer?.name || 'Unknown customer'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        invoice.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        invoice.paymentStatus === 'partially_paid' ? 'bg-amber-100 text-amber-700' :
                        invoice.paymentStatus === 'cancelled' ? 'bg-stone-200 text-stone-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>{t(invoice.paymentStatus)}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs text-stone-500">{t('date')}</dt><dd className="mt-1 font-medium text-stone-800">{format(new Date(invoice.date), 'dd MMM yyyy')}</dd></div>
                      <div className="text-right"><dt className="text-xs text-stone-500">{t('total')}</dt><dd className="mt-1 font-bold text-stone-900">{formatCurrency(invoice.total)}</dd></div>
                    </dl>
                    <button type="button" onClick={() => navigate(`/invoices/${invoice.id}`)} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800">
                      <Eye size={18} />Open invoice
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="px-3 py-3"><input type="checkbox" aria-label="Select all visible invoices" checked={filteredInvoices.length > 0 && filteredInvoices.every((invoice) => selectedIds.has(invoice.id))} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); filteredInvoices.forEach((invoice) => event.target.checked ? next.add(invoice.id) : next.delete(invoice.id)); return next; })} /></th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('invoiceNumber')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Customer {language === 'ta' && ' / வாடிக்கையாளர்'}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('date')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">{t('total')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-center">{t('status')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredInvoices.map(invoice => {
                  const customer = state.customers.find(c => c.id === invoice.customerId) || invoice.customerSnapshot;
                  return (
                    <tr key={invoice.id} className="hover:bg-emerald-50/50 cursor-pointer transition-colors" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                      <td className="px-3 py-4" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.has(invoice.id)} onChange={() => toggleSelection(invoice.id)} aria-label={`Select invoice ${invoice.invoiceNumber}`} /></td>
                      <td className="px-6 py-4 font-bold text-stone-800">#{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">{customer?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 font-medium">{format(new Date(invoice.date), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 text-right font-bold text-stone-800">{formatCurrency(invoice.total)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                          invoice.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          invoice.paymentStatus === 'partially_paid' ? 'bg-amber-100 text-amber-700' :
                          invoice.paymentStatus === 'cancelled' ? 'bg-stone-200 text-stone-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {t(invoice.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${invoice.id}/edit`); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:text-emerald-800" aria-label={language === 'ta' ? `${invoice.invoiceNumber} விலைப்பட்டியலைத் திருத்து` : `Edit invoice ${invoice.invoiceNumber}`} title={language === 'ta' ? 'திருத்து' : 'Edit'}><Edit size={16} /></button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(invoice.id);
                        }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:text-rose-700" aria-label={language === 'ta' ? `${invoice.invoiceNumber} விலைப்பட்டியலை நீக்கு` : `Delete invoice ${invoice.invoiceNumber}`} title={language === 'ta' ? 'நீக்கு' : 'Delete'}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="bg-stone-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 border border-emerald-100">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{language === 'en' ? 'No invoices yet' : 'பில்கள் ஏதும் இல்லை'}</h3>
            <p className="text-stone-500 mb-8 max-w-sm mx-auto">{language === 'en' ? 'Create your first invoice to keep track of your income.' : 'முதல் பில்லை போட்டு உங்கள் வரவை கணக்கில் வைக்கவும்.'}</p>
            <Link to="/invoices/new" className="px-6 py-3 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800 mx-auto flex items-center justify-center gap-2 max-w-[240px] shadow-sm">
              <Plus size={20} />
              {t('createInvoice')}
            </Link>
          </div>
        )}
      </div>
      <div aria-hidden="true" className="fixed left-[-20000px] top-0 w-[210mm]">
        {selectedInvoices.flatMap((invoice) => copiesForInvoice(invoice).map((copy) => {
          const customer = state.customers.find((entry) => entry.id === invoice.customerId) || invoice.customerSnapshot;
          const showPaymentStatus = invoice.paymentStatusPdfVisibility === 'show'
            || (invoice.paymentStatusPdfVisibility !== 'hide' && state.settings.showPaymentStatusOnInvoicePdf === true);
          return <div key={`${invoice.id}:${copy}`} className="canonical-a4-document bg-white text-black" data-export-root="true" data-bulk-invoice={invoice.id} data-bulk-copy={copy}><CanonicalInvoiceDocument invoice={invoice} profile={state.profile} customer={customer as any} showQr showPaymentSummary={state.settings.showPaymentSummaryOnPdf !== false} showPaymentStatus={showPaymentStatus} copyLabel={`${copy.toUpperCase()} COPY`} /></div>;
        }))}
      </div>
      <ConfirmDialog open={Boolean(pendingDeleteId)} title="Delete invoice?" message="This moves the invoice out of active records and preserves a recovery copy." onCancel={() => setPendingDeleteId(null)} onConfirm={async () => { if (pendingDeleteId) { const result = await deleteInvoice(pendingDeleteId); showToast(result.ok ? 'Invoice deleted' : 'The invoice could not be deleted. A recovery copy was not available.', result.ok ? 'success' : 'error'); } setPendingDeleteId(null); }} />
    </div>
  );
}
