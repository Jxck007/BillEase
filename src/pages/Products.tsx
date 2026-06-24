import React from 'react';
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Search, Edit2, Trash2, PiggyBank } from 'lucide-react';
import { Product } from '../lib/types';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../lib/utils';

export default function Products() {
  const { state, addProduct, updateProduct, deleteProduct } = useData();
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({ name: '', description: '', price: 0, unit: 'pcs', taxRate: 0, hsnSac: '', stock: 0, isService: false });

  const filteredProducts = state.products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ 
        name: product.name, description: product.description || '', 
        price: product.price, unit: product.unit, taxRate: product.taxRate, hsnSac: product.hsnSac || '', stock: product.stock || 0, isService: Boolean(product.isService) 
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', description: '', price: 0, unit: 'pcs', taxRate: 0, hsnSac: '', stock: 0, isService: false });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct(editingProduct.id, formData);
    } else {
      addProduct(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('products')}</h1>
          <p className="text-stone-500 mt-1">
            {language === 'en' ? 'Manage the items or services you sell.' : 'நீங்கள் விற்கும் பொருட்கள் அல்லது சேவைகளை நிர்வகிக்கவும்.'}
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          {language === 'en' ? 'Add Item' : 'புதிய பொருள் சேர்'}
        </button>
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

        {filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] md:min-w-[600px] text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Item / பொருள்</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">HSN/SAC</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('price')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('unit')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('taxRate')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Stock</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-emerald-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-stone-800">{product.name}</p>
                      {product.description && <p className="text-xs text-stone-500 font-medium">{product.description}</p>}
                      <p className="text-[11px] text-stone-400">{product.isService ? 'Service' : 'Product'}</p>
                    </td>
                    <td className="px-6 py-4 font-medium">{product.hsnSac || '-'}</td>
                    <td className="px-6 py-4 font-bold text-stone-800">{formatCurrency(product.price)}</td>
                    <td className="px-6 py-4 font-medium">{product.unit}</td>
                    <td className="px-6 py-4 font-medium">{product.taxRate}%</td>
                    <td className="px-6 py-4 font-medium">{product.stock ?? 0}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleOpenModal(product)} className="text-emerald-600 hover:text-emerald-800 p-2 bg-emerald-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => {
                        if(confirm(language === 'en' ? 'Are you sure?' : 'நிச்சயமாக அழிக்க வேண்டுமா?')) {
                          deleteProduct(product.id);
                        }
                      }} className="text-rose-500 hover:text-rose-700 p-2 bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="bg-stone-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 border border-emerald-100">
              <PiggyBank size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{t('noProducts')}</h3>
            <p className="text-stone-500 mb-8 max-w-sm mx-auto">{language === 'en' ? 'Add items you sell to make invoicing faster.' : 'வேகமாக பில் போட நீங்கள் விற்கும் பொருட்கள் மற்றும் விலையை சேர்க்கவும்.'}</p>
            <button 
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 mx-auto flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={20} />
              {language === 'en' ? 'Add Item' : 'புதிய பொருள் சேர்'}
            </button>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? t('edit') : (language === 'en' ? 'Add Item' : 'புதிய பொருள் சேர்')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('itemName')} *</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{language === 'en' ? 'Description (Optional)' : 'விவரம் (Description)'}</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t('price')} *</label>
              <input required type="text" inputMode="decimal" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t('unit')} *</label>
              <input required type="text" placeholder="pcs, kg, box..." value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
              <p className="text-xs text-stone-500 mt-1">e.g. kg, pcs, box</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('taxRate')}</label>
            <input type="text" inputMode="decimal" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            <p className="text-xs text-stone-500 mt-1">{language === 'en' ? 'If applicable' : 'வரி சதவிகிதம் (உதாரணம்: 18)'}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">HSN/SAC</label>
              <input type="text" value={formData.hsnSac} onChange={e => setFormData({...formData, hsnSac: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Stock</label>
              <input type="text" inputMode="numeric" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value) || 0})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input type="checkbox" checked={formData.isService} onChange={e => setFormData({...formData, isService: e.target.checked})} className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" />
            {language === 'en' ? 'This is a service item' : 'இது சேவை item'}
          </label>
          
          <div className="pt-4 border-t flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">{t('cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">{t('save')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
