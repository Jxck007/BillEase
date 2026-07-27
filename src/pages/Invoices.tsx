import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, FileText, Trash2, Edit } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';

export default function Invoices() {
  const { state, deleteInvoice } = useData();
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const invoices = state.invoices.filter(i => i.type !== 'estimate');

  const filteredInvoices = invoices.filter(i => {
    const customer = state.customers.find(c => c.id === i.customerId);
    return i.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (customer && customer.name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> Back to Dashboard</Link>
          <h1 className="text-2xl font-bold text-stone-800">{t('invoices')}</h1>
          <p className="text-stone-500 mt-1">
            {language === 'en' ? 'Manage your structured bills.' : 'உங்கள் பில்களை (Bills) நிர்வகிக்கவும்.'}
          </p>
        </div>
        <Link to="/invoices/new" className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
          <Plus size={20} />
          {t('createInvoice')}
        </Link>
      </div>

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

        {filteredInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px] md:min-w-[700px] text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
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
                  const customer = state.customers.find(c => c.id === invoice.customerId);
                  return (
                    <tr key={invoice.id} className="hover:bg-emerald-50/50 cursor-pointer transition-colors" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                      <td className="px-6 py-4 font-bold text-stone-800">#{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">{customer?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 font-medium">{format(new Date(invoice.date), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 text-right font-bold text-stone-800">{formatCurrency(invoice.total)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                          invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          invoice.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {t(invoice.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${invoice.id}/edit`); }} className="text-emerald-600 hover:text-emerald-800 p-2 bg-emerald-50 rounded-lg"><Edit size={16} /></button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(invoice.id);
                        }} className="text-rose-500 hover:text-rose-700 p-2 bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
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
            <h3 className="text-xl font-bold text-stone-800 mb-2">{language === 'en' ? 'No invoices yet' : 'பில்கள் ஏதும் இல்லை'}</h3>
            <p className="text-stone-500 mb-8 max-w-sm mx-auto">{language === 'en' ? 'Create your first invoice to keep track of your income.' : 'முதல் பில்லை போட்டு உங்கள் வரவை கணக்கில் வைக்கவும்.'}</p>
            <Link to="/invoices/new" className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 mx-auto flex items-center justify-center gap-2 max-w-[240px] shadow-sm">
              <Plus size={20} />
              {t('createInvoice')}
            </Link>
          </div>
        )}
      </div>
      <ConfirmDialog open={Boolean(pendingDeleteId)} title="Delete invoice?" message="This removes the invoice from your records. This action cannot be undone." onCancel={() => setPendingDeleteId(null)} onConfirm={() => { if (pendingDeleteId) { deleteInvoice(pendingDeleteId); showToast('Invoice deleted', 'success'); } setPendingDeleteId(null); }} />
    </div>
  );
}
