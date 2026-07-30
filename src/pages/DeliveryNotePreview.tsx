import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Share2 } from 'lucide-react';
import ExportPanel from '../components/export/ExportPanel';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import IndustrialDeliveryNoteTemplate from '../templates/IndustrialDeliveryNoteTemplate';
import CanonicalDocumentViewport from '../components/documents/CanonicalDocumentViewport';

export default function DeliveryNotePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useData();
  const { language } = useLanguage();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRootRef = useRef<HTMLDivElement>(null);
  const note = state.deliveryNotes.find(n => n.id === id);
  const customer = state.customers.find(c => c.id === note?.customerId);

  if (!note) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm">
        <div className="text-lg font-bold text-stone-800">{language === 'en' ? 'Delivery Note not found' : 'டெலிவரி நோட் கிடைக்கவில்லை'}</div>
        <button
          type="button"
          onClick={() => navigate('/delivery-notes')}
          className="mt-6 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white"
        >
          {language === 'en' ? 'Back' : 'பின்செல்'}
        </button>
      </div>
    );
  }

  return (
    <div className="delivery-note-preview mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/delivery-notes')}
            title={language === 'en' ? 'Back to delivery notes' : 'டெலிவரி நோட்ஸ்க்கு திரும்பு'}
            aria-label={language === 'en' ? 'Back to delivery notes' : 'டெலிவரி நோட்ஸ்க்கு திரும்பு'}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 shadow-sm"
          >
            <ArrowLeft size={22} className="text-stone-600" />
            <span className="text-sm font-semibold text-stone-700">{language === 'en' ? 'Back to Delivery Notes' : 'டெலிவரி நோட்ஸ்'}</span>
          </button>
          <div>
            <h1 className="text-2xl font-black text-stone-800">{language === 'en' ? 'Delivery Note' : 'டெலிவரி நோட்'} #{note.deliveryNoteNumber}</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white"
          >
            <Share2 size={18} /> Share Document
          </button>
          <button
            type="button"
            onClick={() => navigate(`/delivery-notes/${note.id}/edit`)}
            title={language === 'en' ? 'Edit delivery note' : 'டெலிவரி நோட்டைத் திருத்து'}
            aria-label={language === 'en' ? 'Edit delivery note' : 'டெலிவரி நோட்டைத் திருத்து'}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-semibold text-emerald-700"
          >
            <Edit size={18} /> {language === 'en' ? 'Edit' : 'திருத்து'}
          </button>
        </div>
      </div>

      <CanonicalDocumentViewport documentRef={exportRootRef}>
        <IndustrialDeliveryNoteTemplate note={note} profile={state.profile} customer={customer || undefined} />
      </CanonicalDocumentViewport>

      {/* Export Panel */}
      <ExportPanel
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        documentId={note.id}
        documentType="delivery-note"
        documentNumber={note.deliveryNoteNumber}
        documentLabel="Delivery Note"
        updatedAt={note.updatedAt || note.createdAt}
        customerId={customer?.id || note.customerId}
        customerName={customer?.name || 'Customer'}
        customerPhone={customer?.phone}
        customerWhatsapp={customer?.whatsapp || customer?.phone}
        customerEmail={customer?.email || ''}
        defaultCcEmail={state.settings.emailCcBusiness ? state.profile.email : ''}
        emailEnabled={state.settings.integrations.serverEmail}
        businessName={state.profile.name}
        exportRootRef={exportRootRef}
        onPrint={() => window.print()}
        widthMm={210}
      />
    </div>
  );
}
