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
  const { language } = useLanguage();
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
    showToast(editingCustomer ? 'Customer updated' : 'Customer saved', 'success');
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
          <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> Back to Dashboard</Link>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-stone-500">Contact, billing and document history from loaded records.</p>
        </div>
        <button type="button" onClick={() => openForm()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-semibold text-white"><Plus size={20} /> Add Customer</button>
      </div>

      {selectedCustomer && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6" aria-label={`${selectedCustomer.name} details`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Customer details</p><h2 className="mt-1 text-xl font-bold">{selectedCustomer.name}</h2><p className="mt-2 text-sm text-stone-600">{selectedCustomer.phone || 'No phone'} · {selectedCustomer.email || 'No email'}</p></div>
            <button type="button" onClick={() => setSelectedCustomer(null)} className="min-h-12 rounded-xl border px-4 font-semibold">Close details</button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoBlock label="Billing address" value={selectedCustomer.address || 'Not provided'} />
            <InfoBlock label="Shipping address" value={selectedCustomer.shippingAddress || 'Same as billing / not provided'} />
            <InfoBlock label="GST information" value={selectedCustomer.gstNumber || selectedCustomer.gstin || 'Not provided'} />
            <InfoBlock label="Outstanding balance" value={formatCurrency(selectedSummary?.outstanding || 0)} />
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <CreateLink to={`/invoices/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label="New Invoice" />
            <CreateLink to={`/estimates/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label="New Quotation" />
            <CreateLink to={`/delivery-notes/new?customer=${encodeURIComponent(selectedCustomer.id)}`} label="New Delivery Note" />
          </div>
          <div className="mt-6 border-t pt-5">
            <h3 className="font-bold">Recent documents</h3>
            {recentForSelected.length ? <div className="mt-2 divide-y">{recentForSelected.map((document) => <Link key={`${document.to}-${document.id}`} to={document.to} className="flex min-h-12 items-center justify-between py-2 text-sm"><span className="font-semibold">{document.label}</span><span className="text-stone-500">{new Date(document.date).toLocaleDateString()}</span></Link>)}</div> : <p className="mt-2 text-sm text-stone-500">No documents for this customer.</p>}
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name, phone or GSTIN" className="min-h-12 w-full rounded-xl border pl-10 pr-4 focus:ring-2 focus:ring-emerald-500" /></div></div>
        {filteredCustomers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b bg-stone-50 text-xs uppercase tracking-wide text-stone-600"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">GSTIN</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Outstanding</th><th className="px-5 py-3">Last invoice</th><th className="px-5 py-3">Total billed</th><th className="px-5 py-3">Documents</th><th className="px-5 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCustomers.map((customer) => {
                  const summary = customerSummaries.get(customer.id);
                  return <tr key={customer.id} className="hover:bg-stone-50">
                    <td className="px-5 py-4"><button type="button" onClick={() => setSelectedCustomer(customer)} className="min-h-12 text-left font-bold text-emerald-700 hover:underline">{customer.name}</button></td>
                    <td className="px-5 py-4">{customer.gstNumber || customer.gstin || '-'}</td><td className="px-5 py-4">{customer.phone || '-'}</td>
                    <td className="px-5 py-4 font-semibold">{formatCurrency(summary?.outstanding || 0)}</td><td className="px-5 py-4">{summary?.lastInvoice ? new Date(summary.lastInvoice).toLocaleDateString() : 'Never'}</td>
                    <td className="px-5 py-4 font-semibold">{formatCurrency(summary?.totalBilled || 0)}</td><td className="px-5 py-4">{summary?.documentCount || 0}</td>
                    <td className="px-5 py-3"><div className="flex gap-2"><button type="button" onClick={() => openForm(customer)} className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-50 px-3 font-semibold text-emerald-700"><Edit2 size={17} /> Edit</button><button type="button" onClick={() => setPendingDelete(customer)} className="flex min-h-12 items-center gap-2 rounded-xl bg-rose-50 px-3 font-semibold text-rose-700"><Trash2 size={17} /> Delete</button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="px-4 py-16 text-center"><Users size={42} className="mx-auto text-emerald-600" /><h2 className="mt-4 text-xl font-bold">No customers found</h2><p className="mt-2 text-stone-500">Add a customer to create documents faster.</p></div>}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCustomer ? 'Edit customer' : 'Add customer'} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Customer or business name *"><input required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Phone"><input type="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label="Email"><input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label="WhatsApp"><input type="tel" value={formData.whatsapp} onChange={(event) => setFormData({ ...formData, whatsapp: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field><Field label="GSTIN"><input value={formData.gstNumber} onChange={(event) => setFormData({ ...formData, gstNumber: event.target.value.toUpperCase() })} className="min-h-12 w-full rounded-xl border p-3 uppercase" /></Field></div>
          <Field label="Billing address"><textarea value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} rows={2} className="w-full rounded-xl border p-3" /></Field>
          <PinLookupField value={formData.billingPin} enabled={availability.postal && state.settings.integrations.pinLookup} onChange={(billingPin) => setFormData({ ...formData, billingPin })} onApply={(result) => setFormData({ ...formData, address: `${result.locality}, ${result.district}, ${result.state}` })} />
          <Field label="Shipping address"><textarea value={formData.shippingAddress} onChange={(event) => setFormData({ ...formData, shippingAddress: event.target.value })} rows={2} className="w-full rounded-xl border p-3" /></Field>
          <PinLookupField value={formData.shippingPin} enabled={availability.postal && state.settings.integrations.pinLookup} onChange={(shippingPin) => setFormData({ ...formData, shippingPin })} onApply={(result) => setFormData({ ...formData, shippingAddress: `${result.locality}, ${result.district}, ${result.state}` })} />
          <Field label="State code"><input value={formData.stateCode} onChange={(event) => setFormData({ ...formData, stateCode: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsModalOpen(false)} className="min-h-12 rounded-xl border px-5 font-semibold">Cancel</button><button type="submit" className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold text-white">Save customer</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(pendingDelete)} title="Delete customer?" message={`Delete ${pendingDelete?.name || 'this customer'}? Existing documents will remain unchanged.`} onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) { deleteCustomer(pendingDelete.id); showToast('Customer deleted', 'success'); } setPendingDelete(null); }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-stone-700">{label}<span className="mt-1 block">{children}</span></label>; }
function InfoBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs font-bold uppercase text-stone-500">{label}</p><p className="mt-1 whitespace-pre-line text-sm text-stone-800">{value}</p></div>; }
function CreateLink({ to, label }: { to: string; label: string }) { return <Link to={to} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white"><FilePlus2 size={18} /> {label}</Link>; }
