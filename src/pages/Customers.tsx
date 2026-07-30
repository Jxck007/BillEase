import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Edit2, FilePlus2, Plus, Search, Trash2, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Customer } from '../lib/types';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PinLookupField from '../components/forms/PinLookupField';
import { useIntegrationAvailability } from '../hooks/useIntegrationAvailability';
import { formatCurrency } from '../lib/utils';
import { useToast } from '../context/ToastContext';

const emptyForm = { name: '', phone: '', email: '', address: '', billingPin: '', shippingAddress: '', shippingPin: '', gstNumber: '', stateCode: '', whatsapp: '', notes: '' };

export default function Customers() {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useData();
  const { language, t } = useLanguage();
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const { availability } = useIntegrationAvailability();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const customerSummaries = useMemo(() => {
    const summaries = new Map<string, { outstanding: number; totalBilled: number; lastInvoice: string; documentCount: number }>();
    state.customers.forEach((customer) => summaries.set(customer.id, { outstanding: 0, totalBilled: 0, lastInvoice: '', documentCount: 0 }));
    state.invoices.forEach((document) => {
      const summary = summaries.get(document.customerId);
      if (!summary) return;
      summary.documentCount += 1;
      if (document.type === 'invoice') {
        summary.totalBilled += document.total;
        summary.outstanding += Math.max(0, document.total - document.amountPaid);
        if (!summary.lastInvoice || new Date(document.date) > new Date(summary.lastInvoice)) summary.lastInvoice = document.date;
      }
    });
    state.deliveryNotes.forEach((document) => {
      const summary = summaries.get(document.customerId);
      if (summary) summary.documentCount += 1;
    });
    return summaries;
  }, [state.customers, state.deliveryNotes, state.invoices]);

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return state.customers.filter((customer) => !query || [customer.name, customer.phone, customer.gstNumber, customer.gstin].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [searchTerm, state.customers]);

  const openForm = (customer?: Customer) => {
    setEditingCustomer(customer || null);
    setFormData(customer ? {
      name: customer.name, phone: customer.phone, email: customer.email, address: customer.address,
      billingPin: customer.billingPin || '', shippingAddress: customer.shippingAddress || '',
      shippingPin: customer.shippingPin || '', gstNumber: customer.gstNumber || customer.gstin || '',
      stateCode: customer.stateCode || '', whatsapp: customer.whatsapp || '', notes: customer.notes || '',
    } : emptyForm);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      openForm();
      setSearchParams({}, { replace: true });
      return;
    }
    const customer = state.customers.find((item) => item.id === searchParams.get('customer'));
    if (customer) setSelectedCustomer(customer);
    // Query parameters are used as one-time entry actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, state.customers]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingCustomer) updateCustomer(editingCustomer.id, formData);
    else addCustomer(formData);
    setIsModalOpen(false);
    showToast(editingCustomer ? text('Customer updated', 'வாடிக்கையாளர் புதுப்பிக்கப்பட்டார்') : text('Customer saved', 'வாடிக்கையாளர் சேமிக்கப்பட்டார்'), 'success');
  };

  const selectedSummary = selectedCustomer ? customerSummaries.get(selectedCustomer.id) : null;
  const recentForSelected = selectedCustomer ? [
    ...state.invoices.filter((document) => document.customerId === selectedCustomer.id).map((document) => ({
      id: document.id, label: document.type === 'estimate' ? `Quotation ${document.invoiceNumber}` : `Invoice ${document.invoiceNumber}`,
      date: document.date, to: `/${document.type === 'estimate' ? 'estimates' : 'invoices'}/${document.id}`,
    })),
    ...state.deliveryNotes.filter((document) => document.customerId === selectedCustomer.id).map((document) => ({
      id: document.id, label: `Delivery Note ${document.deliveryNoteNumber}`, date: document.date, to: `/delivery-notes/${document.id}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> {text('Back to Dashboard', 'முகப்புக்குத் திரும்பு')}</Link>
          <h1 className="text-2xl font-bold">{t('customers')}</h1>
          <p className="mt-1 text-stone-500">{text('Contact, billing and document history from loaded records.', 'தொடர்பு, பில்லிங் மற்றும் ஆவண வரலாறு.')}</p>
        </div>
        <button type="button" onClick={() => openForm()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-semibold text-white"><Plus size={20} /> {t('addCustomer')}</button>
      </div>

      {selectedCustomer && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6" aria-label={`${selectedCustomer.name} details`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{text('Customer details', 'வாடிக்கையாளர் விவரங்கள்')}</p><h2 className="mt-1 text-xl font-bold">{selectedCustomer.name}</h2><p className="mt-2 text-sm text-stone-600">{selectedCustomer.phone || text('No phone', 'தொலைபேசி இல்லை')} · {selectedCustomer.email || text('No email', 'மின்னஞ்சல் இல்லை')}</p></div>
            <button type="button" onClick={() => setSelectedCustomer(null)} className="min-h-12 rounded-xl border px-4 font-semibold">{text('Close details', 'விவரங்களை மூடு')}</button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoBlock label={text('Billing address', 'பில்லிங் முகவரி')} value={selectedCustomer.address || text('Not provided', 'வழங்கப்படவில்லை')} />
            <InfoBlock label={text('Shipping address', 'அனுப்பும் முகவரி')} value={selectedCustomer.shippingAddress || text('Same as billing / not provided', 'பில்லிங் முகவரி போன்றதே / வழங்கப்படவில்லை')} />
            <InfoBlock label={text('GST information', 'GST விவரம்')} value={selectedCustomer.gstNumber || selectedCustomer.gstin || text('Not provided', 'வழங்கப்படவில்லை')} />
            <InfoBlock label={text('Outstanding balance', 'நிலுவைத் தொகை')} value={formatCurrency(selectedSummary?.outstanding || 0)} />
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <CreateLink to={`/invoices/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label={t('newInvoice')} />
            <CreateLink to={`/estimates/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label={t('newQuotation')} />
            <CreateLink to={`/delivery-notes/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label={t('newDeliveryNote')} />
          </div>
          <div className="mt-6 border-t pt-5">
            <h3 className="font-bold">{text('Recent documents', 'சமீபத்திய ஆவணங்கள்')}</h3>
            {recentForSelected.length ? <div className="mt-2 divide-y">{recentForSelected.map((document) => <Link key={`${document.to}-${document.id}`} to={document.to} className="flex min-h-12 items-center justify-between py-2 text-sm"><span className="font-semibold">{document.label}</span><span className="text-stone-500">{new Date(document.date).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN')}</span></Link>)}</div> : <p className="mt-2 text-sm text-stone-500">{text('No documents for this customer.', 'இந்த வாடிக்கையாளருக்கு ஆவணங்கள் இல்லை.')}</p>}
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={text('Search name, phone or GSTIN', 'பெயர், தொலைபேசி அல்லது GSTIN தேடு')} className="min-h-12 w-full rounded-xl border pl-10 pr-4 focus:ring-2 focus:ring-emerald-500" /></div></div>
        {filteredCustomers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b bg-stone-50 text-xs uppercase tracking-wide text-stone-600"><tr><th className="px-5 py-3">{text('Name', 'பெயர்')}</th><th className="px-5 py-3">GSTIN</th><th className="px-5 py-3">{t('phone')}</th><th className="px-5 py-3">{text('Outstanding', 'நிலுவை')}</th><th className="px-5 py-3">{text('Last invoice', 'கடைசி விலைப்பட்டியல்')}</th><th className="px-5 py-3">{text('Total billed', 'மொத்த பில் தொகை')}</th><th className="px-5 py-3">{text('Documents', 'ஆவணங்கள்')}</th><th className="px-5 py-3">{text('Actions', 'செயல்கள்')}</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCustomers.map((customer) => {
                  const summary = customerSummaries.get(customer.id);
                  return <tr key={customer.id} className="hover:bg-stone-50">
                    <td className="px-5 py-4"><button type="button" onClick={() => setSelectedCustomer(customer)} className="min-h-12 text-left font-bold text-emerald-700 hover:underline">{customer.name}</button></td>
                    <td className="px-5 py-4">{customer.gstNumber || customer.gstin || '-'}</td><td className="px-5 py-4">{customer.phone || '-'}</td>
                    <td className="px-5 py-4 font-semibold">{formatCurrency(summary?.outstanding || 0)}</td><td className="px-5 py-4">{summary?.lastInvoice ? new Date(summary.lastInvoice).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN') : text('Never', 'இதுவரை இல்லை')}</td>
                    <td className="px-5 py-4 font-semibold">{formatCurrency(summary?.totalBilled || 0)}</td><td className="px-5 py-4">{summary?.documentCount || 0}</td>
                    <td className="px-5 py-3"><div className="flex gap-2"><button type="button" onClick={() => openForm(customer)} className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-50 px-3 font-semibold text-emerald-700"><Edit2 size={17} /> {t('edit')}</button><button type="button" onClick={() => setPendingDelete(customer)} className="flex min-h-12 items-center gap-2 rounded-xl bg-rose-50 px-3 font-semibold text-rose-700"><Trash2 size={17} /> {t('delete')}</button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="px-4 py-16 text-center"><Users size={42} className="mx-auto text-emerald-600" /><h2 className="mt-4 text-xl font-bold">{text('No customers found', 'வாடிக்கையாளர்கள் இல்லை')}</h2><p className="mt-2 text-stone-500">{text('Add a customer to create documents faster.', 'ஆவணங்களை விரைவாக உருவாக்க வாடிக்கையாளரைச் சேர்க்கவும்.')}</p></div>}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCustomer ? text('Edit customer', 'வாடிக்கையாளரைத் திருத்து') : t('addCustomer')} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={`${text('Customer or business name', 'வாடிக்கையாளர் அல்லது நிறுவனப் பெயர்')} *`}><input required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label={t('phone')}><input type="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label={t('email')}><input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label="WhatsApp"><input type="tel" value={formData.whatsapp} onChange={(event) => setFormData({ ...formData, whatsapp: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label="GSTIN"><input value={formData.gstNumber} onChange={(event) => setFormData({ ...formData, gstNumber: event.target.value.toUpperCase() })} className="min-h-12 w-full rounded-xl border p-3 uppercase" /></Field></div>
          <Field label={text('Billing address', 'பில்லிங் முகவரி')}><textarea value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} rows={2} className="w-full rounded-xl border p-3" /></Field>
          <PinLookupField value={formData.billingPin} enabled={availability.postal && state.settings.integrations.pinLookup} onChange={(billingPin) => setFormData({ ...formData, billingPin })} onApply={(result) => setFormData({ ...formData, address: `${result.locality}, ${result.district}, ${result.state}` })} />
          <Field label={text('Shipping address', 'அனுப்பும் முகவரி')}><textarea value={formData.shippingAddress} onChange={(event) => setFormData({ ...formData, shippingAddress: event.target.value })} rows={2} className="w-full rounded-xl border p-3" /></Field>
          <PinLookupField value={formData.shippingPin} enabled={availability.postal && state.settings.integrations.pinLookup} onChange={(shippingPin) => setFormData({ ...formData, shippingPin })} onApply={(result) => setFormData({ ...formData, shippingAddress: `${result.locality}, ${result.district}, ${result.state}` })} />
          <Field label={text('State code', 'மாநிலக் குறியீடு')}><input value={formData.stateCode} onChange={(event) => setFormData({ ...formData, stateCode: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsModalOpen(false)} className="min-h-12 rounded-xl border px-5 font-semibold">{t('cancel')}</button><button type="submit" className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold text-white">{t('saveCustomer')}</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(pendingDelete)} title={text('Delete customer?', 'வாடிக்கையாளரை நீக்கவா?')} message={language === 'ta' ? `${pendingDelete?.name || 'இந்த வாடிக்கையாளரை'} நீக்கவா? ஏற்கனவே உள்ள ஆவணங்கள் மாறாது.` : `Delete ${pendingDelete?.name || 'this customer'}? Existing documents will remain unchanged.`} onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) { deleteCustomer(pendingDelete.id); showToast(text('Customer deleted', 'வாடிக்கையாளர் நீக்கப்பட்டார்'), 'success'); } setPendingDelete(null); }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-stone-700">{label}<span className="mt-1 block">{children}</span></label>; }
function InfoBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs font-bold uppercase text-stone-500">{label}</p><p className="mt-1 whitespace-pre-line text-sm text-stone-800">{value}</p></div>; }
function CreateLink({ to, label }: { to: string; label: string }) { return <Link to={to} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white"><FilePlus2 size={18} /> {label}</Link>; }
