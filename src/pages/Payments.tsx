import React from 'react';
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Search, DollarSign, Receipt, Download } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { PaymentMethod } from '../lib/types';
import { format } from 'date-fns';
import Modal from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import PaymentReceiptModal from '../components/payments/PaymentReceiptModal';
import PaymentReceiptTemplate from '../templates/PaymentReceiptTemplate';
import { MAX_BULK_PDFS, prepareBulkDownload } from '../services/bulkDownloadService';
import type { Payment } from '../lib/types';

export default function Payments() {
  const { state, addPayment } = useData();
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [formData, setFormData] = useState<{ invoiceId: string; amount: number; date: string; method: PaymentMethod; notes: string }>({ invoiceId: '', amount: 0, date: new Date().toISOString().split('T')[0], method: 'cash', notes: '' });

  const filteredPayments = state.payments.filter(p => {
    const invoice = state.invoices.find(i => i.id === p.invoiceId);
    const customer = invoice ? state.customers.find(c => c.id === invoice.customerId) : null;
    return (invoice?.invoiceNumber.includes(searchTerm)) || 
           (customer?.name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const unpaidInvoices = state.invoices.filter(i => !['paid', 'cancelled'].includes(i.paymentStatus) && i.type !== 'estimate');
  const selected = state.payments.filter((payment) => payment.kind === 'payment' && selectedIds.has(payment.id));
  const downloadSelected = async () => {
    if (!selected.length) return;
    setBulkRunning(true);
    try {
      const { createPdfBlobFromElement } = await import('../services/exportService');
      const result = await prepareBulkDownload(selected.map((payment) => ({
        id: payment.id, fileName: `Payment-Receipt-R-${payment.id}.pdf`,
        generate: () => createPdfBlobFromElement(document.querySelector<HTMLElement>(`[data-bulk-receipt="${CSS.escape(payment.id)}"]`)!),
      })), `Payment-Receipts-${new Date().toISOString().slice(0, 10)}.zip`, (progress) => setBulkProgress(progress.stage === 'preparing' ? `Preparing ${progress.current} of ${progress.total}` : progress.stage === 'zipping' ? 'Creating ZIP' : 'Download ready'));
      showToast(result.failed.length ? `${result.prepared} prepared; ${result.failed.length} need attention.` : 'Download ready', result.failed.length ? 'error' : 'success');
    } catch (error) { showToast((error as Error).message, 'error'); } finally { setBulkRunning(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invoiceId || formData.amount <= 0) {
      showToast('Select an invoice and enter a valid amount.', 'error');
      return;
    }
    addPayment(formData);
    setIsModalOpen(false);
    setFormData({ invoiceId: '', amount: 0, date: new Date().toISOString().split('T')[0], method: 'cash', notes: '' });
    showToast('Payment saved', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('payments')}</h1>
          <p className="text-stone-500 mt-1">
            {language === 'en' ? 'Track money received.' : 'வரவு வந்த பணத்தை பதிவு செய்யவும்.'}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          {t('recordPayment')}
        </button>
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

        {filteredPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] md:min-w-[600px] text-left text-sm">
               <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                   <th className="px-3 py-3"><input type="checkbox" aria-label="Select all receipts" onChange={(event) => setSelectedIds(event.target.checked ? new Set(filteredPayments.filter((payment) => payment.kind === 'payment').map((payment) => payment.id)) : new Set())} /></th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('date')}</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('invoiceNumber')}</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('customerName')}</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Method</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Amount</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredPayments.map(payment => {
                  const invoice = state.invoices.find(i => i.id === payment.invoiceId);
                  const customer = invoice ? state.customers.find(c => c.id === invoice.customerId) : null;
                  return (
                    <tr key={payment.id} className="hover:bg-emerald-50/50 transition-colors">
                      <td className="px-3 py-4">{payment.kind === 'payment' ? <input type="checkbox" checked={selectedIds.has(payment.id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); next.has(payment.id) ? next.delete(payment.id) : next.add(payment.id); return next; })} /> : null}</td>
                      <td className="px-6 py-4 font-medium">{format(new Date(payment.paidAt), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">#{invoice?.invoiceNumber || '-'}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">{customer?.name || '-'}</td>
                      <td className="px-6 py-4 font-medium">{payment.method}</td>
                      <td className={`px-6 py-4 font-bold text-right ${payment.kind === 'reversal' ? 'text-rose-600' : 'text-emerald-600'}`}>{payment.kind === 'reversal' ? '-' : '+'}{formatCurrency(payment.amount)}</td>
                      <td className="px-6 py-4 text-right">{payment.kind === 'payment' ? <button onClick={() => setReceiptPayment(payment)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2"><Receipt size={16} />Receipt</button> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="bg-stone-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 border border-emerald-100">
              <DollarSign size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{language === 'en' ? 'No payments yet' : 'பணம் ஏதும் வரவில்லை'}</h3>
            <p className="text-stone-500 mb-8 max-w-sm mx-auto">{language === 'en' ? 'Record payments when customers pay their invoices.' : 'வாடிக்கையாளர் பணம் கொடுக்கும் போது இங்கு பதிவு செய்யவும்.'}</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 mx-auto flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={20} />
              {t('recordPayment')}
            </button>
          </div>
        )}
      </div>
      <PaymentReceiptModal payment={receiptPayment} invoice={state.invoices.find((invoice) => invoice.id === receiptPayment?.invoiceId) || null} onClose={() => setReceiptPayment(null)} />
      <div aria-hidden="true" className="fixed left-[-20000px] top-0 w-[210mm]">{selected.map((payment) => {
        const invoice = state.invoices.find((entry) => entry.id === payment.invoiceId);
        if (!invoice) return null;
        const customer = state.customers.find((entry) => entry.id === invoice.customerId) || invoice.customerSnapshot;
        return <div key={payment.id} className="canonical-a4-document bg-white text-black" data-export-root="true" data-bulk-receipt={payment.id}><PaymentReceiptTemplate payment={payment} invoice={invoice} profile={state.profile} customer={customer as any} /></div>;
      })}</div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('recordPayment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('invoiceNumber')} *</label>
            <select required value={formData.invoiceId} onChange={e => {
              const inv = state.invoices.find(i => i.id === e.target.value);
              setFormData({ 
                ...formData, 
                invoiceId: e.target.value, 
                amount: inv ? inv.balanceDue : 0
              });
            }} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500">
              <option value="">-- {language === 'en' ? 'Select Invoice to Pay' : 'பில் தேர்வு செய்'} --</option>
              {unpaidInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>#{inv.invoiceNumber} (Due: {formatCurrency(inv.balanceDue)})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Amount *</label>
              <input required type="text" inputMode="decimal" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t('date')} *</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Payment Method</label>
            <select value={formData.method} onChange={e => setFormData({...formData, method: e.target.value as PaymentMethod})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500">
              <option value="cash">Cash (ரொக்கம்)</option>
              <option value="UPI">UPI / GPay / PhonePe</option>
              <option value="bank_transfer">Bank Transfer (வங்கி)</option>
              <option value="cheque">Cheque (காசோலை)</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="pt-4 border-t flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">{t('cancel')}</button>
            <button type="submit" disabled={!formData.invoiceId} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50">{t('save')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
