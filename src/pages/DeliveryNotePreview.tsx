import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Share2 } from 'lucide-react';
import ExportPanel from '../components/export/ExportPanel';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import IndustrialDeliveryNoteTemplate from '../templates/IndustrialDeliveryNoteTemplate';

export default function DeliveryNotePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useData();
  const { language } = useLanguage();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const exportTemplateRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  // Fit document preview to screen width
  const updateScale = useCallback(() => {
    if (!scalerRef.current) return;
    const container = scalerRef.current.parentElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const docWidth = scalerRef.current.scrollWidth || 900;
    if (containerWidth < docWidth && containerWidth > 0) {
      setPreviewScale(Math.max(0.3, containerWidth / docWidth));
    } else {
      setPreviewScale(1);
    }
  }, []);

  useEffect(() => {
    updateScale();
    const observer = new ResizeObserver(updateScale);
    const el = scalerRef.current?.parentElement;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [updateScale, note]);

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

  const getExportElement = useCallback(() => exportTemplateRef.current || printRef.current, []);

  return (
    <div className="delivery-note-preview mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/delivery-notes')}
            title={language === 'en' ? 'Back to delivery notes' : 'டெலிவரி நோட்ஸ்க்கு திரும்பு'}
            aria-label={language === 'en' ? 'Back to delivery notes' : 'டெலிவரி நோட்ஸ்க்கு திரும்பு'}
            className="rounded-full border border-stone-200 bg-white p-2 shadow-sm"
          >
            <ArrowLeft size={22} className="text-stone-600" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-stone-800">{language === 'en' ? 'Delivery Note' : 'டெலிவரி நோட்'} #{note.deliveryNoteNumber}</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm"
          >
            <Share2 size={18} /> Export / Share
          </button>
          <button
            type="button"
            onClick={() => navigate(`/delivery-notes/${note.id}/edit`)}
            title={language === 'en' ? 'Edit delivery note' : 'டெலிவரி நோட்டைத் திருத்து'}
            aria-label={language === 'en' ? 'Edit delivery note' : 'டெலிவரி நோட்டைத் திருத்து'}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-semibold text-emerald-700 shadow-sm"
          >
            <Edit size={18} /> {language === 'en' ? 'Edit' : 'திருத்து'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <div className="preview-scaler" ref={scalerRef}>
          <div ref={printRef} className="dn-export-root mx-auto w-full bg-white p-0 shadow-none print:shadow-none print:border-0" style={{ transform: previewScale < 1 ? `scale(${previewScale})` : 'none', transformOrigin: 'top center' }}>
            <IndustrialDeliveryNoteTemplate note={note} profile={state.profile} customer={customer || undefined} />
          </div>
        </div>

        <div className="fixed -left-[10000px] top-0 w-[210mm] bg-white p-0" aria-hidden="true">
          <div ref={exportTemplateRef}>
            <IndustrialDeliveryNoteTemplate note={note} profile={state.profile} customer={customer || undefined} />
          </div>
        </div>
      </div>

      {/* Export Panel */}
      <ExportPanel
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        documentType="delivery-note"
        documentNumber={note.deliveryNoteNumber}
        documentLabel="Delivery Note"
        customerName={customer?.name || 'Customer'}
        customerPhone={customer?.phone}
        customerWhatsapp={customer?.whatsapp || customer?.phone}
        customerEmail={customer?.email || ''}
        businessName={state.profile.name}
        getExportElement={getExportElement}
        onPrint={() => window.print()}
        widthMm={210}
      />
    </div>
  );
}
