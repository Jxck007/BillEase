import React from 'react';
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Search, Edit2, Trash2, Users } from 'lucide-react';
import { Customer } from '../lib/types';
import Modal from '../components/ui/Modal';

export default function Customers() {
  const { state, addCustomer, updateCustomer, deleteCustomer } = useData();
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '', stateCode: '', whatsapp: '', notes: '' });

  const filteredCustomers = state.customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({ 
        name: customer.name, phone: customer.phone, email: customer.email, 
        address: customer.address, gstNumber: customer.gstNumber || '', stateCode: customer.stateCode || '', whatsapp: customer.whatsapp || '', notes: customer.notes || '' 
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', address: '', gstNumber: '', stateCode: '', whatsapp: '', notes: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData);
    } else {
      addCustomer(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('customers')}</h1>
          <p className="text-stone-500 mt-1">
            {language === 'en' ? 'Manage your clients and their details.' : 'உங்கள் வாடிக்கையாளர் விவரங்களை நிர்வகிக்கவும்.'}
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          {t('addCustomer')}
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

        {filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Name / பெயர்</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('phone')}</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">GSTIN</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">State</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">WhatsApp</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-emerald-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-stone-800">{customer.name}</td>
                    <td className="px-6 py-4 font-medium">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 font-medium">{customer.gstNumber || '-'}</td>
                    <td className="px-6 py-4 font-medium">{customer.stateCode || '-'}</td>
                    <td className="px-6 py-4 font-medium">{customer.whatsapp || '-'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleOpenModal(customer)} className="text-emerald-600 hover:text-emerald-800 p-2 bg-emerald-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => {
                        if(confirm(language === 'en' ? 'Are you sure?' : 'நிச்சயமாக அழிக்க வேண்டுமா?')) {
                          deleteCustomer(customer.id);
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
              <Users size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{t('noCustomers')}</h3>
            <p className="text-stone-500 mb-8 max-w-sm mx-auto">{language === 'en' ? 'Add your first customer to start creating bills for them.' : 'உங்கள் வாடிக்கையாளர்களை சேர்த்து, அவர்களுக்கு பில் போடலாம்.'}</p>
            <button 
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 mx-auto flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={20} />
              {t('addCustomer')}
            </button>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCustomer ? t('edit') : t('addCustomer')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('customerName')} *</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            <p className="text-xs text-stone-500 mt-1">{language === 'en' ? "Full name or business name" : "முழு பெயர் அல்லது வியாபாரத்தின் பெயர்"}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t('phone')}</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t('email')}</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{language === 'en' ? 'State Code' : 'State Code'}</label>
              <input type="text" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">WhatsApp</label>
              <input type="tel" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('address')}</label>
            <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} rows={2} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('gstin')}</label>
            <input type="text" value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 uppercase" />
          </div>
          
          <div className="pt-4 border-t flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">{t('cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">{t('saveCustomer')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
