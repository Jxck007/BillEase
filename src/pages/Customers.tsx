import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Edit2, Eye, FilePlus2, MoreHorizontal, Plus, Search, Trash2, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Customer } from '../lib/types';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PinLookupField from '../components/forms/PinLookupField';
import { useIntegrationAvailability } from '../hooks/useIntegrationAvailability';
import { formatCurrency } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useHelp } from '../context/HelpContext';

const emptyForm = { name: '', phone: '', email: '', address: '', billingPin: '', shippingAddress: '', shippingPin: '', useDifferentShippingAddress: false, gstNumber: '', stateCode: '', whatsapp: '', notes: '' };

export default function Customers() {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useData();
  const { language, t } = useLanguage();
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const { availability } = useIntegrationAvailability();
  const { showToast } = useToast();
  const { openHelp } = useHelp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const customerSummaries = useMemo(() => {
    const summaries = new Map<string, { outstanding: number; totalBilled: number; amountPaid: number; paymentCount: number; lastInvoice: string; documentCount: number }>();
    state.customers.forEach((customer) => summaries.set(customer.id, { outstanding: 0, totalBilled: 0, amountPaid: 0, paymentCount: 0, lastInvoice: '', documentCount: 0 }));
    state.invoices.forEach((document) => {
      const summary = summaries.get(document.customerId);
      if (!summary) return;
      summary.documentCount += 1;
      if (document.type === 'invoice') {
        summary.totalBilled += document.total;
        summary.outstanding += Math.max(0, document.total - document.amountPaid);
        summary.amountPaid += document.amountPaid;
        summary.paymentCount += document.payments.filter((payment) => payment.kind === 'payment').length;
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
      useDifferentShippingAddress: customer.useDifferentShippingAddress ?? Boolean(customer.shippingAddress && customer.shippingAddress !== customer.address),
      stateCode: customer.stateCode || '', whatsapp: customer.whatsapp || '', notes: customer.notes || '',
    } : emptyForm);
    setShowMoreDetails(Boolean(customer));
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      showToast(text('Customer name is required.', 'வாடிக்கையாளர் பெயர் தேவை.'), 'error');
      return;
    }
    const result = editingCustomer ? await updateCustomer(editingCustomer.id, formData) : await addCustomer(formData);
    if (!result.ok) {
      showToast(result.errors?.[0]?.message || text('Something went wrong while saving the customer.', 'வாடிக்கையாளரைச் சேமிக்க முடியவில்லை.'), 'error');
      return;
    }
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
          <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> {t('backToDashboard')}</Link>
          <h1 className="text-2xl font-bold">{t('customers')}</h1>
          <p className="mt-1 text-stone-500">{text('Contact, billing and document history from loaded records.', 'தொடர்பு, பில்லிங் மற்றும் ஆவண வரலாறு.')}</p>
        </div>
        <button type="button" onClick={() => openForm()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-semibold text-white"><Plus size={20} /> {t('addCustomer')}</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={text('Search name, phone or GSTIN', 'பெயர், தொலைபேசி அல்லது GSTIN தேடு')} className="min-h-12 w-full rounded-xl border pl-10 pr-4 focus:ring-2 focus:ring-emerald-500" /></div></div>
        {filteredCustomers.length ? (
          <>
          <div className="grid gap-3 p-3 lg:hidden">
            {filteredCustomers.map((customer) => {
              const summary = customerSummaries.get(customer.id);
              const expanded = expandedCustomerId === customer.id;
              return <article key={customer.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="break-words font-bold text-stone-900">{customer.name}</h2><p className="mt-1 text-sm text-stone-600">{customer.phone || customer.gstNumber || customer.gstin || text('Name-only customer', 'பெயர் மட்டும் உள்ள வாடிக்கையாளர்')}</p></div>
                  <div className="shrink-0 text-right"><p className="text-xs font-semibold text-stone-500">{text('Outstanding', 'நிலுவை')}</p><p className={`font-black ${(summary?.outstanding || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(summary?.outstanding || 0)}</p></div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 text-sm">
                  <div><dt className="text-xs font-semibold text-stone-500">{text('Last invoice', 'கடைசி விலைப்பட்டியல்')}</dt><dd className="mt-1 font-semibold">{summary?.lastInvoice ? new Date(summary.lastInvoice).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN') : text('Never', 'இதுவரை இல்லை')}</dd></div>
                  <div><dt className="text-xs font-semibold text-stone-500">{text('Documents', 'ஆவணங்கள்')}</dt><dd className="mt-1 font-semibold">{summary?.documentCount || 0}</dd></div>
                </dl>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setSelectedCustomer(customer)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-2 text-sm font-semibold text-white"><Eye size={17} />{text('View', 'பார்')}</button>
                  <button type="button" onClick={() => openForm(customer)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-stone-200 px-2 text-sm font-semibold"><Edit2 size={17} />{t('edit')}</button>
                  <button type="button" onClick={() => setExpandedCustomerId(expanded ? '' : customer.id)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-stone-200 px-2 text-sm font-semibold" aria-expanded={expanded} aria-label={text(`More actions for ${customer.name}`, `${customer.name}க்கான கூடுதல் செயல்கள்`)}><MoreHorizontal size={18} />{t('more')}</button>
                </div>
                {expanded && <div className="mt-2 rounded-xl border border-rose-100 bg-rose-50 p-2"><button type="button" onClick={() => setPendingDelete(customer)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg font-semibold text-rose-700"><Trash2 size={17} />{t('delete')}</button></div>}
              </article>;
            })}
          </div>
          <div className="hidden overflow-x-auto lg:block">
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
          </>
        ) : <div className="px-4 py-16 text-center"><Users size={42} className="mx-auto text-emerald-600" /><h2 className="mt-4 text-xl font-bold">{text('No customers found', 'வாடிக்கையாளர்கள் இல்லை')}</h2><p className="mt-2 text-stone-500">{text('Add a customer to create documents faster.', 'ஆவணங்களை விரைவாக உருவாக்க வாடிக்கையாளரைச் சேர்க்கவும்.')}</p></div>}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCustomer ? text('Edit customer', 'வாடிக்கையாளரைத் திருத்து') : t('addCustomer')} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={`${text('Customer or business name', 'வாடிக்கையாளர் அல்லது நிறுவனப் பெயர்')} *`}><input required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          <button type="button" onClick={() => openHelp('address')} className="min-h-11 text-sm font-semibold text-emerald-700 underline underline-offset-2">{text('Address help', 'முகவரி உதவி')}</button>
          <button type="button" onClick={() => setShowMoreDetails((current) => !current)} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 font-semibold text-stone-800" aria-expanded={showMoreDetails}>{text('More customer details (optional)', 'கூடுதல் வாடிக்கையாளர் விவரங்கள் (விருப்பம்)')}<ChevronDown size={20} className={showMoreDetails ? 'rotate-180' : ''} /></button>
          {showMoreDetails && <div className="space-y-4 rounded-2xl border border-stone-200 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label={text('Phone (Optional)', 'போன் (விருப்பம்)')}><input type="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label={text('Email (Optional)', 'மின்னஞ்சல் (விருப்பம்)')}><input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label={text('WhatsApp (Optional)', 'WhatsApp (விருப்பம்)')}><input type="tel" value={formData.whatsapp} onChange={(event) => setFormData({ ...formData, whatsapp: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label={text('GST number (Optional)', 'GST எண் (விருப்பம்)')}><input value={formData.gstNumber} onChange={(event) => setFormData({ ...formData, gstNumber: event.target.value.toUpperCase() })} className="min-h-12 w-full rounded-xl border p-3 uppercase" /></Field></div>
          <Field label={text('Address (Optional)', 'முகவரி (விருப்பம்)')}><textarea value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} rows={2} className="w-full rounded-xl border p-3" /></Field>
          <PinLookupField value={formData.billingPin} enabled={availability.postal && state.settings.integrations.pinLookup} onChange={(billingPin) => setFormData({ ...formData, billingPin })} onApply={(result) => setFormData({ ...formData, address: `${result.locality}, ${result.district}, ${result.state}` })} />
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-800"><input type="checkbox" checked={formData.useDifferentShippingAddress} onChange={(event) => setFormData({ ...formData, useDifferentShippingAddress: event.target.checked })} className="h-5 w-5" />{text('Use a different shipping address', 'வேறு அனுப்பும் முகவரியைப் பயன்படுத்து')}</label>
          {formData.useDifferentShippingAddress && <div className="space-y-4 rounded-xl border border-stone-200 p-4"><Field label={text('Shipping address', 'அனுப்பும் முகவரி')}><textarea value={formData.shippingAddress} onChange={(event) => setFormData({ ...formData, shippingAddress: event.target.value })} rows={2} className="w-full rounded-xl border p-3" /></Field><PinLookupField value={formData.shippingPin} enabled={availability.postal && state.settings.integrations.pinLookup} onChange={(shippingPin) => setFormData({ ...formData, shippingPin })} onApply={(result) => setFormData({ ...formData, shippingAddress: `${result.locality}, ${result.district}, ${result.state}` })} /></div>}
          <Field label={text('State code', 'மாநிலக் குறியீடு')}><input value={formData.stateCode} onChange={(event) => setFormData({ ...formData, stateCode: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          </div>}
          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsModalOpen(false)} className="min-h-12 rounded-xl border px-5 font-semibold">{t('cancel')}</button><button type="submit" className="min-h-12 rounded-xl bg-emerald-700 px-5 font-semibold text-white">{t('saveCustomer')}</button></div>
        </form>
      </Modal>
      <Modal isOpen={Boolean(selectedCustomer)} onClose={() => setSelectedCustomer(null)} title={text('Customer details', 'வாடிக்கையாளர் விவரங்கள்')} maxWidth="max-w-3xl" mobileSheet>
        {selectedCustomer && <div className="space-y-5 font-sans">
          <div><h2 className="break-words text-2xl font-bold text-stone-900">{selectedCustomer.name}</h2><p className="mt-2 break-words text-sm text-stone-600">{selectedCustomer.phone || text('No phone', 'தொலைபேசி இல்லை')} · {selectedCustomer.email || text('No email', 'மின்னஞ்சல் இல்லை')}</p></div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock label={text('GST number', 'GST எண்')} value={selectedCustomer.gstNumber || selectedCustomer.gstin || text('Not provided', 'வழங்கப்படவில்லை')} />
            <InfoBlock label={text('Primary address', 'முதன்மை முகவரி')} value={selectedCustomer.address || text('Not provided', 'வழங்கப்படவில்லை')} />
            {selectedCustomer.useDifferentShippingAddress && selectedCustomer.shippingAddress ? <InfoBlock label={text('Shipping address', 'அனுப்பும் முகவரி')} value={selectedCustomer.shippingAddress} /> : null}
            <InfoBlock label={text('Outstanding balance', 'நிலுவைத் தொகை')} value={formatCurrency(selectedSummary?.outstanding || 0)} />
            <InfoBlock label={text('Documents', 'ஆவணங்கள்')} value={String(selectedSummary?.documentCount || 0)} />
            <InfoBlock label={text('Latest invoice', 'சமீபத்திய விலைப்பட்டியல்')} value={selectedSummary?.lastInvoice ? new Date(selectedSummary.lastInvoice).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN') : text('None', 'இல்லை')} />
            <InfoBlock label={text('Payments recorded', 'பதிவு செய்யப்பட்ட கட்டணங்கள்')} value={`${selectedSummary?.paymentCount || 0} · ${formatCurrency(selectedSummary?.amountPaid || 0)}`} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => { const customer = selectedCustomer; setSelectedCustomer(null); window.setTimeout(() => openForm(customer), 0); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 font-semibold"><Edit2 size={18} />{text('Edit Customer', 'வாடிக்கையாளரைத் திருத்து')}</button><Link to={`/invoices?customer=${encodeURIComponent(selectedCustomer.id)}`} className="flex min-h-12 items-center justify-center rounded-xl border border-stone-200 font-semibold">{text('View Documents', 'ஆவணங்களைப் பார்')}</Link><CreateLink to={`/invoices/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label={t('newInvoice')} /><CreateLink to={`/estimates/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label={t('newQuotation')} /><CreateLink to={`/delivery-notes/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label={t('newDeliveryNote')} /></div>
          {recentForSelected.length ? <div className="border-t pt-4"><h3 className="font-bold">{text('Recent documents', 'சமீபத்திய ஆவணங்கள்')}</h3><div className="mt-2 divide-y">{recentForSelected.map((document) => <Link key={`${document.to}-${document.id}`} to={document.to} className="flex min-h-12 min-w-0 items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate font-semibold">{document.label}</span><span className="shrink-0 text-stone-500">{new Date(document.date).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN')}</span></Link>)}</div></div> : null}
          <div className="sticky bottom-0 border-t bg-white pt-3 pb-[env(safe-area-inset-bottom)]"><button type="button" onClick={() => setSelectedCustomer(null)} className="min-h-12 w-full rounded-xl border border-stone-300 font-semibold">{text('Close', 'மூடு')}</button></div>
        </div>}
      </Modal>
      <ConfirmDialog open={Boolean(pendingDelete)} title={text('Delete customer?', 'வாடிக்கையாளரை நீக்கவா?')} message={language === 'ta' ? `${pendingDelete?.name || 'இந்த வாடிக்கையாளரை'} நீக்கவா? ஏற்கனவே உள்ள ஆவணங்கள் மாறாது.` : `Delete ${pendingDelete?.name || 'this customer'}? Existing documents and a recovery copy remain unchanged.`} onCancel={() => setPendingDelete(null)} onConfirm={async () => { if (pendingDelete) { const result = await deleteCustomer(pendingDelete.id); showToast(result.ok ? text('Customer deleted', 'வாடிக்கையாளர் நீக்கப்பட்டார்') : text('The customer could not be deleted.', 'வாடிக்கையாளரை நீக்க முடியவில்லை.'), result.ok ? 'success' : 'error'); } setPendingDelete(null); }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-stone-700">{label}<span className="mt-1 block">{children}</span></label>; }
function InfoBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs font-bold uppercase text-stone-500">{label}</p><p className="mt-1 whitespace-pre-line text-sm text-stone-800">{value}</p></div>; }
function CreateLink({ to, label }: { to: string; label: string }) { return <Link to={to} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-semibold text-white"><FilePlus2 size={18} /> {label}</Link>; }
