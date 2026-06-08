import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Printer, Download, Share2, Smartphone } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import {
  exportDeliveryNoteAsImage,
  getShareResultMessage,
  shareDeliveryNote,
  shareDeliveryNoteOnWhatsApp,
  shareElementAsImage,
  shareElementAsPdf,
} from '../services/exportService';
import IndustrialDeliveryNoteTemplate from '../templates/IndustrialDeliveryNoteTemplate';

export default function DeliveryNotePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useData();
  const { language } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const exportTemplateRef = useRef<HTMLDivElement>(null);

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

  const getExportTarget = () => exportTemplateRef.current || printRef.current;
  const fileName = `DN_${note.deliveryNoteNumber}`;

  const shareDeliveryNotePdf = async (message: string) => {
    const target = getExportTarget();
    if (!target) return { shared: false, reason: 'generation_failed' as const };
    return shareElementAsPdf(
      target,
      fileName,
      `Delivery Note ${note.deliveryNoteNumber}`,
      message,
    );
  };

  const shareDeliveryNoteImage = async (message: string) => {
    const target = getExportTarget();
    if (!target) return { shared: false, reason: 'generation_failed' as const };
    return shareElementAsImage(
      target,
      fileName,
      `Delivery Note ${note.deliveryNoteNumber}`,
      message,
    );
  };

  const handleExportImage = async () => {
    const target = getExportTarget();
    if (!target) {
      alert(language === 'en' ? 'Unable to generate file' : 'கோப்பை உருவாக்க முடியவில்லை');
      return;
    }

    try {
      await exportDeliveryNoteAsImage(target, fileName);
      alert(language === 'en' ? 'PNG generated successfully' : 'PNG வெற்றிகரமாக உருவாக்கப்பட்டது');
    } catch (err) {
      console.error('Delivery note PNG export failed:', err);
      alert(language === 'en' ? 'Unable to generate PNG file' : 'PNG கோப்பை உருவாக்க முடியவில்லை');
    }
  };

  const handleWhatsAppShare = async () => {
    if (!customer?.phone) {
      alert(language === 'en' ? 'Customer phone number is required' : 'வாடிக்கையாளர் போன் எண் தேவை');
      return;
    }

    try {
      const pdfResult = await shareDeliveryNotePdf(
        `${state.profile.name} - Delivery Note #${note.deliveryNoteNumber}\nPlease find attached delivery note PDF.`,
      );
      if (pdfResult.shared) return;

      if (pdfResult.downloaded) {
        shareDeliveryNoteOnWhatsApp(note, customer.name, customer.phone, state.profile.name);
        return;
      }
    } catch (err) {
      console.warn('PDF share failed, falling back to WhatsApp text link', err);
    }

    shareDeliveryNoteOnWhatsApp(note, customer.name, customer.phone, state.profile.name);
  };

  const handleNativeShare = async () => {
    try {
      const pdfResult = await shareDeliveryNotePdf(
        `${state.profile.name} - Delivery Note #${note.deliveryNoteNumber}\nPlease find attached delivery note PDF.`,
      );
      if (pdfResult.shared) return;

      const imageResult = await shareDeliveryNoteImage(
        `${state.profile.name} - Delivery Note #${note.deliveryNoteNumber}\nTransport Purpose: ${note.transportPurpose || '-'}\nVehicle No: ${note.vehicleNumber || '-'}`,
      );
      if (imageResult.shared) return;

      const textResult = shareDeliveryNote(note, state.profile.name);
      if (!textResult.shared) {
        const message = getShareResultMessage(pdfResult, language) || getShareResultMessage(textResult, language);
        if (message) {
          alert(message);
        }
      }
    } catch (err) {
      console.error('Delivery note share failed:', err);
      alert(language === 'en' ? 'Unable to generate file' : 'கோப்பை உருவாக்க முடியவில்லை');
    }
  };

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
            onClick={handleWhatsAppShare}
            title="WhatsApp"
            aria-label="WhatsApp"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-2.5 font-semibold text-white shadow-sm"
          >
            <Smartphone size={18} /> WhatsApp
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            title={language === 'en' ? 'Share delivery note' : 'டெலிவரி நோட்டை பகிர்'}
            aria-label={language === 'en' ? 'Share delivery note' : 'டெலிவரி நோட்டை பகிர்'}
            className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 font-semibold text-stone-700 shadow-sm"
          >
            <Share2 size={18} /> {language === 'en' ? 'Share' : 'பகிர்'}
          </button>
          <button
            type="button"
            onClick={handleExportImage}
            title={language === 'en' ? 'Export PNG' : 'PNG ஏற்றுமதி'}
            aria-label={language === 'en' ? 'Export PNG' : 'PNG ஏற்றுமதி'}
            className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 font-semibold text-stone-700 shadow-sm"
          >
            <Download size={18} /> PNG
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
          <button
            type="button"
            onClick={() => window.print()}
            title={language === 'en' ? 'PDF / Print' : 'PDF / Print'}
            aria-label={language === 'en' ? 'PDF / Print' : 'PDF / Print'}
            className="inline-flex items-center gap-2 rounded-2xl bg-stone-800 px-4 py-2.5 font-semibold text-white shadow-sm"
          >
            <Printer size={18} /> PDF / Print
          </button>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <div ref={printRef} className="dn-export-root mx-auto w-full bg-white p-0 shadow-none print:shadow-none print:border-0">
          <IndustrialDeliveryNoteTemplate note={note} profile={state.profile} customer={customer || undefined} />
        </div>

        <div className="fixed -left-[10000px] top-0 w-[210mm] bg-white p-0" aria-hidden="true">
          <div ref={exportTemplateRef}>
            <IndustrialDeliveryNoteTemplate note={note} profile={state.profile} customer={customer || undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
