import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Package, Plus, Search, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Product } from '../lib/types';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatCurrency } from '../lib/utils';
import { useToast } from '../context/ToastContext';

export default function Products() {
  const { state, addProduct, updateProduct, deleteProduct } = useData();
  const { t, language } = useLanguage();
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: 0, unit: 'pcs', taxRate: 0, hsnSac: '', stock: 0, isService: false });

  const usage = useMemo(() => {
    const map = new Map<string, { count: number; lastUsed: string }>();
    const record = (productId: string | undefined, name: string | undefined, date: string) => {
      const product = productId ? state.products.find((item) => item.id === productId) : state.products.find((item) => item.name.toLowerCase() === (name || '').toLowerCase());
      if (!product) return;
      const current = map.get(product.id) || { count: 0, lastUsed: '' };
      map.set(product.id, {
        count: current.count + 1,
        lastUsed: !current.lastUsed || new Date(date) > new Date(current.lastUsed) ? date : current.lastUsed,
      });
    };
    state.invoices.forEach((document) => document.items.forEach((item) => record(item.productId, item.name, document.date || document.createdAt)));
    state.deliveryNotes.forEach((document) => document.items.forEach((item) => record(item.productId, item.name || item.description, document.date || document.createdAt)));
    return map;
  }, [state.deliveryNotes, state.invoices, state.products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return state.products.filter((product) => !query || [product.name, product.hsnSac].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [searchTerm, state.products]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name, description: product.description || '', price: product.price,
        unit: product.unit, taxRate: product.taxRate, hsnSac: product.hsnSac || '',
        stock: product.stock || 0, isService: Boolean(product.isService),
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', description: '', price: 0, unit: 'pcs', taxRate: 0, hsnSac: '', stock: 0, isService: false });
    }
    setIsModalOpen(true);
  };

  useEffect(() => {
    const product = state.products.find((item) => item.id === searchParams.get('product'));
    if (product) {
      handleOpenModal(product);
      setSearchParams({}, { replace: true });
    }
    // The query string is an entry action, not form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams, state.products]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingProduct) updateProduct(editingProduct.id, formData);
    else addProduct(formData);
    setIsModalOpen(false);
    showToast(editingProduct ? text('Product updated', 'பொருள் புதுப்பிக்கப்பட்டது') : text('Product saved', 'பொருள் சேமிக்கப்பட்டது'), 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('products')} description={text('Products and services available for documents.', 'ஆவணங்களுக்கான பொருட்கள் மற்றும் சேவைகளை நிர்வகிக்கவும்.')} addLabel={text('Add product', 'பொருள் சேர்')} backLabel={text('Back to Dashboard', 'முகப்புக்குத் திரும்பு')} onAdd={() => handleOpenModal()} />
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input type="search" placeholder={text('Search name or HSN/SAC', 'பெயர் அல்லது HSN/SAC தேடு')} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="min-h-12 w-full rounded-xl border pl-10 pr-4 focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        {filteredProducts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
                <tr>
                  <th className="px-5 py-3">{text('Product / service', 'பொருள் / சேவை')}</th><th className="px-5 py-3">HSN/SAC</th><th className="px-5 py-3">GST</th>
                  <th className="px-5 py-3">{t('price')}</th><th className="px-5 py-3">{text('Unit', 'அலகு')}</th><th className="px-5 py-3">{text('Last used', 'கடைசியாக பயன்படுத்தியது')}</th><th className="px-5 py-3">{text('Usage', 'பயன்பாடு')}</th><th className="px-5 py-3">{text('Actions', 'செயல்கள்')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map((product) => {
                  const productUsage = usage.get(product.id);
                  return (
                    <tr key={product.id} className="hover:bg-stone-50">
                      <td className="px-5 py-4"><p className="font-bold text-stone-900">{product.name}</p><p className="text-xs text-stone-500">{product.isService ? text('Service', 'சேவை') : text('Product', 'பொருள்')}</p></td>
                      <td className="px-5 py-4">{product.hsnSac || '-'}</td><td className="px-5 py-4">{product.taxRate}%</td>
                      <td className="px-5 py-4 font-semibold">{formatCurrency(product.price)}</td><td className="px-5 py-4">{product.unit}</td>
                      <td className="px-5 py-4">{productUsage?.lastUsed ? new Date(productUsage.lastUsed).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-IN') : text('Never', 'இதுவரை இல்லை')}</td>
                      <td className="px-5 py-4">{productUsage?.count || 0}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleOpenModal(product)} className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-50 px-3 font-semibold text-emerald-700"><Edit2 size={17} /> {t('edit')}</button>
                          <button type="button" onClick={() => setPendingDelete(product)} className="flex min-h-12 items-center gap-2 rounded-xl bg-rose-50 px-3 font-semibold text-rose-700"><Trash2 size={17} /> {t('delete')}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState onAdd={() => handleOpenModal()} title={text('No products yet', 'பொருட்கள் இன்னும் இல்லை')} action={text('Add first product', 'முதல் பொருளைச் சேர்')} />}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? text('Edit product', 'பொருளைத் திருத்து') : text('Add product or service', 'பொருள் அல்லது சேவையைச் சேர்')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={`${text('Name', 'பெயர்')} *`}><input required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          <Field label={text('Description', 'விவரம்')}><textarea value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} rows={2} className="w-full rounded-xl border p-3" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={`${t('price')} *`}><input required inputMode="decimal" value={formData.price} onChange={(event) => setFormData({ ...formData, price: Number(event.target.value) || 0 })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
            <Field label={`${text('Unit', 'அலகு')} *`}><input required value={formData.unit} onChange={(event) => setFormData({ ...formData, unit: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
            <Field label={text('GST rate', 'GST விகிதம்')}><input inputMode="decimal" value={formData.taxRate} onChange={(event) => setFormData({ ...formData, taxRate: Number(event.target.value) || 0 })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
            <Field label="HSN/SAC"><input value={formData.hsnSac} onChange={(event) => setFormData({ ...formData, hsnSac: event.target.value })} className="min-h-12 w-full rounded-xl border p-3" /></Field>
          </div>
          <label className="flex min-h-12 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={formData.isService} onChange={(event) => setFormData({ ...formData, isService: event.target.checked })} className="h-5 w-5" /> {text('This is a service', 'இது ஒரு சேவை')}</label>
          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="min-h-12 rounded-xl border px-5 font-semibold">{t('cancel')}</button>
            <button type="submit" className="min-h-12 rounded-xl bg-emerald-700 px-5 font-semibold text-white">{text('Save product', 'பொருளைச் சேமி')}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(pendingDelete)} title={text('Delete product?', 'பொருளை நீக்கவா?')} message={language === 'ta' ? `${pendingDelete?.name || 'இந்த பொருளை'} நீக்கவா? ஏற்கனவே உள்ள ஆவணங்கள் மாறாது.` : `Delete ${pendingDelete?.name || 'this product'}? Existing documents will not be changed.`} onCancel={() => setPendingDelete(null)} onConfirm={async () => { if (pendingDelete) { const result = await deleteProduct(pendingDelete.id); showToast(result.ok ? text('Product deleted', 'பொருள் நீக்கப்பட்டது') : text('The product could not be deleted.', 'பொருளை நீக்க முடியவில்லை.'), result.ok ? 'success' : 'error'); } setPendingDelete(null); }} />
    </div>
  );
}

function PageHeader({ title, description, addLabel, backLabel, onAdd }: { title: string; description: string; addLabel: string; backLabel: string; onAdd: () => void }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> {backLabel}</Link><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 text-stone-500">{description}</p></div><button type="button" onClick={onAdd} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-semibold text-white"><Plus size={20} /> {addLabel}</button></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-stone-700">{label}<span className="mt-1 block">{children}</span></label>; }
function EmptyState({ onAdd, title, action }: { onAdd: () => void; title: string; action: string }) { return <div className="px-4 py-16 text-center"><Package size={40} className="mx-auto text-emerald-600" /><h2 className="mt-4 text-xl font-bold">{title}</h2><button type="button" onClick={onAdd} className="mt-6 min-h-12 rounded-xl bg-emerald-700 px-6 font-semibold text-white">{action}</button></div>; }
