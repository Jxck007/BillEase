import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, FileText, Trash2, Edit, Download } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { getEstimateDocumentName, getEstimateDocumentTitle, getEstimateNumberLabel, getEstimatesNavLabel } from '../lib/estimateUtils';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import QuotationEstimateTemplate from '../templates/QuotationEstimateTemplate';
import { MAX_BULK_PDFS, prepareBulkDownload } from '../services/bulkDownloadService';

export default function Estimates() {
  const { state, deleteInvoice } = useData();
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const estimates = state.invoices.filter(i => i.type === 'estimate');
  const documentName = getEstimateDocumentName(state.settings, language);
  const numberLabel = getEstimateNumberLabel(state.settings);
  const navLabel = getEstimatesNavLabel(state.settings, language);

  const filteredEstimates = estimates.filter(i => {
    const customer = state.customers.find(c => c.id === i.customerId) || i.customerSnapshot;
    return i.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (customer && customer.name.toLowerCase().includes(searchTerm.toLowerCase()));
  });
  const selected = estimates.filter((invoice) => selectedIds.has(invoice.id));
  const downloadSelected = async () => {
    if (!selected.length) return;
    setBulkRunning(true);
    try {
      const { createPdfBlobFromElement } = await import('../services/exportService');
      const result = await prepareBulkDownload(selected.map((invoice) => ({
        id: invoice.id, fileName: `Quotation-${invoice.invoiceNumber}.pdf`,
        generate: () => createPdfBlobFromElement(document.querySelector<HTMLElement>(`[data-bulk-quotation="${CSS.escape(invoice.id)}"]`)!),
      })), `Quotations-${new Date().toISOString().slice(0, 10)}.zip`, (progress) => setBulkProgress(progress.stage === 'preparing' ? `Preparing ${progress.current} of ${progress.total}` : progress.stage === 'zipping' ? 'Creating ZIP' : 'Download ready'));
      showToast(result.failed.length ? `${result.prepared} prepared; ${result.failed.length} need attention.` : 'Download ready', result.failed.length ? 'error' : 'success');
    } catch (error) { showToast((error as Error).message, 'error'); } finally { setBulkRunning(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> Back to Dashboard</Link>
          <h1 className="text-2xl font-bold text-stone-800">{navLabel}</h1>
          <p className="text-stone-500 mt-1">
            {language === 'en' ? `Manage your ${documentName.toLowerCase()}s before billing.` : 'பில் போடுவதற்கு முன் கொடுக்கும் தோராய மதிப்பீடுகள்.'}
          </p>
        </div>
        <Link to="/estimates/new" className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
          <Plus size={20} />
          {language === 'en' ? `Create ${documentName}` : `புதிய ${documentName}`}
        </Link>
      </div>

      {selectedIds.size ? <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3"><strong>{selectedIds.size} selected</strong><button disabled={bulkRunning} onClick={downloadSelected} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white"><Download size={18} />Download Selected</button><span role="status">{bulkProgress}</span><span className="text-sm">Maximum {MAX_BULK_PDFS} PDFs.</span></div> : null}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              type="text" 
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {filteredEstimates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px] md:min-w-[700px] text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="px-3 py-3"><input type="checkbox" aria-label="Select all quotations" onChange={(event) => setSelectedIds(event.target.checked ? new Set(filteredEstimates.map((invoice) => invoice.id)) : new Set())} /></th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{numberLabel} #</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Customer {language === 'ta' && ' / வாடிக்கையாளர்'}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('date')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">{t('total')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredEstimates.map(invoice => {
                  const customer = state.customers.find(c => c.id === invoice.customerId) || invoice.customerSnapshot;
                  return (
                    <tr key={invoice.id} className="hover:bg-emerald-50/50 cursor-pointer transition-colors" onClick={() => navigate(`/estimates/${invoice.id}`)}>
                      <td className="px-3 py-4" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.has(invoice.id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); next.has(invoice.id) ? next.delete(invoice.id) : next.add(invoice.id); return next; })} aria-label={language === 'ta' ? `${invoice.invoiceNumber} விலைமதிப்பீட்டைத் தேர்ந்தெடு` : `Select quotation ${invoice.invoiceNumber}`} /></td>
                      <td className="px-6 py-4 font-bold text-stone-800">#{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">{customer?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 font-medium">{format(new Date(invoice.date), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 text-right font-bold text-stone-800">{formatCurrency(invoice.total)}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/estimates/${invoice.id}/edit`); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:text-emerald-800" aria-label={language === 'ta' ? `${invoice.invoiceNumber} விலைமதிப்பீட்டைத் திருத்து` : `Edit quotation ${invoice.invoiceNumber}`} title={language === 'ta' ? 'திருத்து' : 'Edit'}><Edit size={16} /></button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(invoice.id);
                        }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:text-rose-700" aria-label={language === 'ta' ? `${invoice.invoiceNumber} விலைமதிப்பீட்டை நீக்கு` : `Delete quotation ${invoice.invoiceNumber}`} title={language === 'ta' ? 'நீக்கு' : 'Delete'}><Trash2 size={16} /></button>
                       </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="bg-stone-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 border border-emerald-100">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{language === 'en' ? `No ${documentName.toLowerCase()}s yet` : 'மதிப்பீடுகள் ஏதும் இல்லை'}</h3>
            <p className="text-stone-500 mb-8 max-w-sm mx-auto">{language === 'en' ? `Create ${documentName.toLowerCase()}s to send pricing quotes to customers.` : 'வாடிக்கையாளர்களுக்கு விலை மதிப்பீடுகளை கொடுத்து பில் போடலாம்.'}</p>
            <Link to="/estimates/new" className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 mx-auto flex items-center justify-center gap-2 max-w-[240px] shadow-sm">
              <Plus size={20} />
              {language === 'en' ? `Create ${documentName}` : `புதிய ${documentName}`}
            </Link>
          </div>
        )}
      </div>
      <div aria-hidden="true" className="fixed left-[-20000px] top-0 w-[210mm]">{selected.map((invoice) => {
        const customer = state.customers.find((entry) => entry.id === invoice.customerId) || invoice.customerSnapshot;
        return <div key={invoice.id} className="canonical-a4-document bg-white text-black" data-export-root="true" data-bulk-quotation={invoice.id}><QuotationEstimateTemplate invoice={invoice} profile={state.profile} customer={customer as any} products={state.products} documentTitle={getEstimateDocumentTitle(state.settings)} numberLabel={numberLabel} visibility={state.settings.template.visibility} /></div>;
      })}</div>
      <ConfirmDialog open={Boolean(pendingDeleteId)} title={`Delete ${documentName.toLowerCase()}?`} message="This moves the document out of active records and preserves a recovery copy." onCancel={() => setPendingDeleteId(null)} onConfirm={async () => { if (pendingDeleteId) { const result = await deleteInvoice(pendingDeleteId); showToast(result.ok ? `${documentName} deleted` : `The ${documentName.toLowerCase()} could not be deleted.`, result.ok ? 'success' : 'error'); } setPendingDeleteId(null); }} />
    </div>
  );
}
