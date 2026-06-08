import React from 'react';
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Search, Receipt } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import Modal from '../components/ui/Modal';
import { Expense } from '../lib/types';

export default function Expenses() {
  const { state, addExpense, deleteExpense } = useData();
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ category: 'Office Supplies', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });

  const filteredExpenses = state.expenses.filter(e => 
    e.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.notes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) return alert('Invalid amount');
    addExpense(formData);
    setIsModalOpen(false);
    setFormData({ category: 'Office Supplies', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t('expenses')}</h1>
          <p className="text-stone-500 mt-1">
            {language === 'en' ? 'Track your business spending.' : 'உங்கள் வியாபார செலவுகளை பதியவும்.'}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          {language === 'en' ? 'Add Expense' : 'செலவு பதிய'}
        </button>
      </div>

      {/* Expenses list and form... similar to payments */}
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

        {filteredExpenses.length > 0 ? (
           <div className="overflow-x-auto">
             <table className="w-full min-w-[600px] text-left text-sm">
               <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                 <tr>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('date')}</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">Category</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs">{t('notes')}</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Amount</th>
                   <th className="px-6 py-3 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-stone-100 text-stone-700">
                 {filteredExpenses.map(expense => (
                     <tr key={expense.id} className="hover:bg-emerald-50/50 transition-colors">
                       <td className="px-6 py-4 font-medium">{format(new Date(expense.date), 'MMM d, yyyy')}</td>
                       <td className="px-6 py-4 font-bold text-stone-800">{expense.category}</td>
                       <td className="px-6 py-4">{expense.notes || '-'}</td>
                       <td className="px-6 py-4 font-bold text-rose-600 text-right">-{formatCurrency(expense.amount)}</td>
                       <td className="px-6 py-4 text-right">
                          <button onClick={() => { if(confirm('Are you sure?')) deleteExpense(expense.id) }} className="text-stone-500 hover:text-rose-600 font-medium">Delete</button>
                       </td>
                     </tr>
                 ))}
               </tbody>
             </table>
           </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="bg-stone-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 border border-emerald-100">
              <Receipt size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{language === 'en' ? 'No expenses yet' : 'செலவுகள் ஏதும் இல்லை'}</h3>
            <p className="text-stone-500 mb-8 max-w-sm mx-auto">{language === 'en' ? 'Record your business expenses to automatically calculate profit.' : 'உங்களுடைய வியாபார செலவுகளை பதிவு செய்து லாபத்தை துல்லியமாக கணக்கிடுங்கள்.'}</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 mx-auto flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={20} />
              {language === 'en' ? 'Add Expense' : 'செலவு பதிய'}
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={language === 'en' ? 'Add Expense' : 'செலவு பதிய'}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500">
              <option value="Office Supplies">Office Supplies (அலுவலக செலவு)</option>
              <option value="Travel">Travel (பயணம்)</option>
              <option value="Meals">Meals (உணவு)</option>
              <option value="Rent">Rent (வாடகை)</option>
              <option value="Salary">Salary (சம்பளம்)</option>
              <option value="Other">Other (இதர செலவுகள்)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('notes')}</label>
            <input type="text" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-2 border rounded-xl focus:ring-2 focus:ring-emerald-500" />
          </div>
          
          <div className="pt-4 border-t flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">{t('cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">{t('save')}</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
