import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';

export default function DeliveryNotes() {
  const navigate = useNavigate();
  const { state, deleteDeliveryNote } = useData();
  const { language, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();

  const deliveryNotes = state.deliveryNotes || [];
  const filtered = deliveryNotes.filter(note =>
    note.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    state.customers.find(c => c.id === note.customerId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> Back to Dashboard</Link>
          <h1 className="text-2xl font-black text-stone-800">{language === 'en' ? 'Delivery Notes' : 'டெலிவரி நோட்ஸ்'}</h1>
          <p className="mt-1 text-sm text-stone-500">{language === 'en' ? 'Manage your delivery documents' : 'உங்கள் டெலிவரி ஆவணங்களை நிர்வகிக்கவும்'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/delivery-notes/new')}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm"
        >
          <Plus size={18} /> {language === 'en' ? 'New Delivery Note' : 'புதிய டெலிவரி நோட்'}
        </button>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder={language === 'en' ? 'Search by note number or customer...' : 'நோட் எண் அல்லது வாடிக்கையாளர் மூலம் தேடுங்கள்...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-12 text-center">
          <p className="text-stone-600">{language === 'en' ? 'No delivery notes found' : 'டெலிவரி நோட்ஸ் கிடைக்கவில்லை'}</p>
          <button
            type="button"
            onClick={() => navigate('/delivery-notes/new')}
            className="mt-4 rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white"
          >
            {language === 'en' ? 'Create One' : 'ஒன்று உருவாக்குங்கள்'}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full min-w-[600px] md:min-w-[750px] text-left text-sm">
            <thead className="bg-stone-50">
              <tr className="border-b border-stone-200">
                <th className="px-4 py-3 font-bold text-stone-700">{language === 'en' ? 'DN Number' : 'DN எண்'}</th>
                <th className="px-4 py-3 font-bold text-stone-700">{language === 'en' ? 'Customer' : 'வாடிக்கையாளர்'}</th>
                <th className="px-4 py-3 font-bold text-stone-700">{language === 'en' ? 'Date' : 'தேதி'}</th>
                <th className="px-4 py-3 font-bold text-stone-700">{language === 'en' ? 'Purpose' : 'நோக்கம்'}</th>
                <th className="px-4 py-3 font-bold text-stone-700">{language === 'en' ? 'Vehicle No' : 'வண்டி எண்'}</th>
                <th className="px-4 py-3 font-bold text-stone-700">{language === 'en' ? 'Status' : 'நிலை'}</th>
                <th className="px-4 py-3 text-right font-bold text-stone-700">{language === 'en' ? 'Actions' : 'செயல்கள்'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((note) => {
                const customer = state.customers.find(c => c.id === note.customerId);
                return (
                  <tr key={note.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-semibold text-stone-800">{note.deliveryNoteNumber}</td>
                    <td className="px-4 py-3 text-stone-700">{customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-stone-600">{format(new Date(note.date), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-stone-700">{note.transportPurpose || '-'}</td>
                    <td className="px-4 py-3 text-stone-700">{note.vehicleNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${note.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {note.status === 'delivered' ? (language === 'en' ? 'Delivered' : 'டெலிவர் செய்யப்பட்டது') : (language === 'en' ? 'Draft' : 'வரைவு')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/delivery-notes/${note.id}`)}
                          className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
                          title={language === 'en' ? 'View' : 'பார்க்க'}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/delivery-notes/${note.id}/edit`)}
                          className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
                          title={language === 'en' ? 'Edit' : 'திருத்து'}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(note.id)}
                          className="rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50"
                          title={language === 'en' ? 'Delete' : 'நீக்கு'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog open={Boolean(pendingDeleteId)} title="Delete delivery note?" message="This moves the delivery note out of active records and preserves a recovery copy." onCancel={() => setPendingDeleteId(null)} onConfirm={async () => { if (pendingDeleteId) { const result = await deleteDeliveryNote(pendingDeleteId); showToast(result.ok ? 'Delivery Note deleted' : 'The delivery note could not be deleted.', result.ok ? 'success' : 'error'); } setPendingDeleteId(null); }} />
    </div>
  );
}
