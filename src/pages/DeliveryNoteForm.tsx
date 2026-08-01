import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, generateId } from '../lib/utils';
import { DeliveryNote, DeliveryNoteItem } from '../lib/types';
import {
  DELIVERY_NOTE_COPY_TYPES,
  DELIVERY_NOTE_TRANSPORT_PURPOSES,
  getCustomerGstin,
  normalizeDeliveryNote,
  normalizeDeliveryNoteCopyType,
  normalizeDeliveryNoteItem,
} from '../lib/deliveryNoteUtils';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAutosaveDraft } from '../hooks/useAutosaveDraft';
import { deleteLocalDraft, loadLocalDraft } from '../services/localDataStore';

function createDraftNumber(existingCount: number) {
  const currentYear = new Date().getFullYear();
  return `DN/${currentYear}-${currentYear + 1}/${String(existingCount + 1).padStart(3, '0')}`;
}

export default function DeliveryNoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, addDeliveryNote, updateDeliveryNote } = useData();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  const existingNote = state.deliveryNotes.find((note) => note.id === id);

  const [formData, setFormData] = useState<Partial<DeliveryNote>>(() =>
    existingNote
      ? normalizeDeliveryNote(existingNote as Partial<DeliveryNote> & Record<string, unknown>)
      : {
          deliveryNoteNumber: createDraftNumber(state.deliveryNotes.length),
          id: generateId(),
          dnNumber: createDraftNumber(state.deliveryNotes.length),
          date: new Date().toISOString().split('T')[0],
          copyType: 'Original for Consignee',
          customerId: searchParams.get('customer') || '',
          consigneeId: searchParams.get('customer') || '',
          transportPurpose: '',
          fromPlace: '',
          toPlace: '',
          vehicleNumber: '',
          approximateValue: 0,
          items: [],
          status: 'draft',
          subtotal: 0,
          cgstTotal: 0,
          sgstTotal: 0,
          igstTotal: 0,
          taxTotal: 0,
          total: 0,
          amountInWords: '',
          notes: '',
          remarks: '',
          draft: true,
        }
  );
  const draftKey = `delivery-note:${id || 'new'}`;
  const { flushDraft, draftSaveStatus, hasUnsavedDraft } = useAutosaveDraft(formData, state.settings.enableAutosave && state.settings.enableDrafts, draftKey, 'delivery-note');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!existingNote) return;
    setFormData(normalizeDeliveryNote(existingNote as Partial<DeliveryNote> & Record<string, unknown>));
  }, [existingNote]);

  useEffect(() => {
    if (existingNote || id) return;
    let active = true;
    loadLocalDraft<Partial<DeliveryNote>>(draftKey).then((saved) => {
      if (active && saved?.value) setFormData((current) => ({ ...current, ...saved.value, id: saved.value.id || current.id }));
    }).catch(() => showToast(language === 'en' ? 'Local draft recovery is unavailable. Keep this tab open while editing.' : 'உள்ளூர் வரைவு மீட்பு கிடைக்கவில்லை.', 'error'));
    return () => { active = false; };
  }, [draftKey, existingNote, id, language, showToast]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasUnsavedDraft) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedDraft]);

  const selectedCustomer = useMemo(
    () => state.customers.find((customer) => customer.id === formData.customerId),
    [formData.customerId, state.customers],
  );

  const handleAddItem = () => {
    const newItem: DeliveryNoteItem = {
      id: generateId(),
      description: '',
      quantity: 1,
      unit: 'Nos',
      hsnSac: '',
      taxRate: 0,
      remarks: '',
    };

    setFormData((previous) => ({
      ...previous,
      items: [...(previous.items || []), newItem],
    }));
  };

  const handleUpdateItem = (index: number, field: keyof DeliveryNoteItem, value: string | number) => {
    const items = [...(formData.items || [])].map((item) => normalizeDeliveryNoteItem(item as Partial<DeliveryNoteItem>));
    const current = items[index];
    if (!current) return;

    const updatedItem: DeliveryNoteItem = {
      ...current,
      [field]: value,
    } as DeliveryNoteItem;

    items[index] = updatedItem;
    setFormData((previous) => ({
      ...previous,
      items,
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((previous) => ({
      ...previous,
      items: (previous.items || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!formData.customerId) {
      showToast(language === 'en' ? 'Please select a customer' : 'வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்', 'error');
      return;
    }

    const items = (formData.items || []).map((item) => normalizeDeliveryNoteItem(item as Partial<DeliveryNoteItem>));
    const validItems = items.filter((item) => item.description.trim());

    if (validItems.length === 0) {
      showToast(language === 'en' ? 'Add at least one goods row' : 'குறைந்தபட்சம் ஒரு பொருள் வரியைச் சேர்க்கவும்', 'error');
      return;
    }

    const deliveryNoteNumber = String(formData.deliveryNoteNumber || formData.dnNumber || '').trim();
    const note = normalizeDeliveryNote({
      ...formData,
      id: formData.id || generateId(),
      dnNumber: deliveryNoteNumber,
      deliveryNoteNumber,
      copyType: normalizeDeliveryNoteCopyType(String(formData.copyType || 'Original for Consignee')),
      customerId: formData.customerId || '',
      consigneeId: formData.consigneeId || formData.customerId || '',
      transportPurpose: String(formData.transportPurpose || ''),
      fromPlace: String(formData.fromPlace || ''),
      toPlace: String(formData.toPlace || ''),
      vehicleNumber: String(formData.vehicleNumber || ''),
      approximateValue: Number(formData.approximateValue || 0),
      items: validItems,
      status: 'draft',
      draft: true,
      subtotal: 0,
      taxTotal: 0,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 0,
      total: 0,
      amountInWords: '',
      notes: String(formData.notes || ''),
      remarks: String(formData.remarks || ''),
      createdAt: existingNote?.createdAt || new Date().toISOString(),
    } as Partial<DeliveryNote> & Record<string, unknown>);

    setIsSaving(true);
    if (!(await flushDraft())) {
      showToast(language === 'en' ? 'Something went wrong while saving. Your work is still open as a draft.' : 'சேமிக்க முடியவில்லை. உங்கள் வரைவு திறந்தே உள்ளது.', 'error');
      setIsSaving(false);
      return;
    }
    const result = id ? await updateDeliveryNote(id, note) : await addDeliveryNote(note);
    if (!result.ok) {
      showToast(result.errors?.[0]?.message || (language === 'en' ? 'Something went wrong while saving. Your work has been kept as a draft.' : 'சேமிக்க முடியவில்லை.'), 'error');
      setIsSaving(false);
      return;
    }
    try {
      await deleteLocalDraft(draftKey);
    } catch {
      showToast(language === 'en' ? 'The document is saved, but its old draft could not be removed.' : 'ஆவணம் சேமிக்கப்பட்டது; பழைய வரைவை அகற்ற முடியவில்லை.', 'info');
    }

    showToast(language === 'ta' ? 'விநியோகக் குறிப்பு சேமிக்கப்பட்டது' : 'Delivery Note saved', 'success');
    navigate('/delivery-notes');
  };

  const displayCopyType = normalizeDeliveryNoteCopyType(String(formData.copyType || 'Original for Consignee'));

  return (
    <div className="document-form mx-auto max-w-6xl space-y-6 pb-48 sm:pb-12">
      <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
        <button
          type="button"
          onClick={() => setLeaveTarget('/delivery-notes')}
          title={language === 'en' ? 'Back to delivery notes' : 'டெலிவரி நோட்ஸ்க்கு திரும்பு'}
          aria-label={language === 'en' ? 'Back to delivery notes' : 'டெலிவரி நோட்ஸ்க்கு திரும்பு'}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 shadow-sm"
        >
          <ArrowLeft size={22} className="text-stone-600" />
          <span className="text-sm font-semibold text-stone-700">{language === 'en' ? 'Back to Delivery Notes' : 'டெலிவரி நோட்ஸ்'}</span>
        </button>
        <div>
          <h1 className="text-2xl font-black text-stone-800">
            {id ? (language === 'en' ? 'Edit Delivery Note' : 'டெலிவரி நோட்டைத் திருத்து') : (language === 'en' ? 'New Delivery Note' : 'புதிய டெலிவரி நோட்')}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{draftSaveStatus === 'saving' ? 'Saving draft…' : draftSaveStatus === 'saved-locally' ? 'Saved locally' : draftSaveStatus === 'failed' ? 'Action required — draft save failed' : language === 'en' ? 'Transport / dispatch document' : 'பரிமாற்ற / டிஸ்பாட்ச் ஆவணம்'}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-[12px] font-black uppercase tracking-wide text-stone-800">{language === 'ta' ? 'இட விவரங்கள்' : 'PARTICULARS OF PLACE'}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">{language === 'en' ? '(a) From where goods are consigned' : '(a) பொருள் அனுப்பப்படும் இடம்'}</label>
            <input
              type="text"
              value={formData.fromPlace || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, fromPlace: event.target.value }))}
              title={language === 'en' ? 'From where goods are consigned' : 'பொருள் அனுப்பப்படும் இடம்'}
              placeholder={language === 'en' ? 'Enter from place' : 'அனுப்பும் இடத்தை உள்ளிடவும்'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">{language === 'en' ? '(b) To which goods are consigned' : '(b) பொருள் சேரும் இடம்'}</label>
            <input
              type="text"
              value={formData.toPlace || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, toPlace: event.target.value }))}
              title={language === 'en' ? 'To which goods are consigned' : 'பொருள் சேரும் இடம்'}
              placeholder={language === 'en' ? 'Enter to place' : 'சேரும் இடத்தை உள்ளிடவும்'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Delivery Note Number' : 'டெலிவரி நோட் எண்'}</label>
            <input
              type="text"
              value={formData.deliveryNoteNumber || formData.dnNumber || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, deliveryNoteNumber: event.target.value, dnNumber: event.target.value }))}
              title={language === 'en' ? 'Delivery Note Number' : 'டெலிவரி நோட் எண்'}
              placeholder={language === 'en' ? 'Enter delivery note number' : 'டெலிவரி நோட் எண்ணை உள்ளிடவும்'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Date' : 'தேதி'}</label>
            <input
              type="date"
              value={formData.date || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, date: event.target.value }))}
              title={language === 'en' ? 'Date' : 'தேதி'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Type of Copy' : 'நகல் வகை'}</label>
            <select
              value={displayCopyType}
              onChange={(event) => setFormData((previous) => ({ ...previous, copyType: event.target.value as DeliveryNote['copyType'] }))}
              title={language === 'en' ? 'Type of Copy' : 'நகல் வகை'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {DELIVERY_NOTE_COPY_TYPES.map((copyType) => (
                <option key={copyType} value={copyType}>{copyType}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Customer' : 'வாடிக்கையாளர்'}</label>
            <select
              value={formData.customerId || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, customerId: event.target.value, consigneeId: event.target.value }))}
              title={language === 'en' ? 'Customer' : 'வாடிக்கையாளர்'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{language === 'en' ? 'Select customer' : 'வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்'}</option>
              {state.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <div className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-700">{language === 'en' ? 'Consignee Auto-fill' : 'கன்சைனி தானியங்கி விவரங்கள்'}</div>
          {selectedCustomer ? (
            <div className="grid gap-3 text-sm text-stone-700 md:grid-cols-2 lg:grid-cols-4">
              <div><span className="font-semibold text-stone-900">{language === 'en' ? 'Name' : 'பெயர்'}:</span> {selectedCustomer.name}</div>
              <div className="md:col-span-2"><span className="font-semibold text-stone-900">{language === 'en' ? 'Address' : 'முகவரி'}:</span> {selectedCustomer.address || '-'}</div>
              <div><span className="font-semibold text-stone-900">GSTIN:</span> {getCustomerGstin(selectedCustomer) || '-'}</div>
              <div><span className="font-semibold text-stone-900">{language === 'en' ? 'Phone' : 'போன்'}:</span> {selectedCustomer.phone || '-'}</div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">{language === 'en' ? 'Select a customer to auto-fill consignee details.' : 'கன்சைனி விவரங்களை தானாக நிரப்ப வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்.'}</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-800">{language === 'en' ? 'Goods Details' : 'பொருள் விவரங்கள்'}</h2>
            <p className="text-sm text-stone-500">{language === 'en' ? 'Description, HSN/SAC, tax rate, quantity and remarks.' : 'விளக்கம், HSN/SAC, வரி விகிதம், அளவு மற்றும் குறிப்பு.'}</p>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white"
          >
            <Plus size={16} /> {language === 'en' ? 'Add Row' : 'வரி சேர்க்கவும்'}
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {(formData.items || []).map((item, index) => {
            const normalizedItem = normalizeDeliveryNoteItem(item as Partial<DeliveryNoteItem>);
            return (
              <div key={normalizedItem.id || index} className="rounded-2xl border border-stone-200 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 min-[1180px]:grid-cols-[2fr_150px_130px_120px_2fr_auto]">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-600">{language === 'en' ? 'Description of Goods' : 'பொருள் விளக்கம்'}</label>
                    <input
                      type="text"
                      value={normalizedItem.description}
                      onChange={(event) => handleUpdateItem(index, 'description', event.target.value)}
                      title={language === 'en' ? 'Description of Goods' : 'பொருள் விளக்கம்'}
                      placeholder={language === 'en' ? 'Description of goods' : 'பொருள் விளக்கம்'}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-600">HSN/SAC</label>
                    <input
                      type="text"
                      value={normalizedItem.hsnSac || ''}
                      onChange={(event) => handleUpdateItem(index, 'hsnSac', event.target.value)}
                      title="HSN/SAC"
                      placeholder="8471"
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-600">{language === 'en' ? 'Rate of Tax %' : 'வரி %'}</label>
                    <input
                      type="number"
                      min="0"
                      value={normalizedItem.taxRate || 0}
                      onChange={(event) => handleUpdateItem(index, 'taxRate', Number(event.target.value) || 0)}
                      title={language === 'en' ? 'Rate of Tax %' : 'வரி %'}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-600">{language === 'en' ? 'Quantity' : 'அளவு'}</label>
                    <input
                      type="number"
                      min="0"
                      value={normalizedItem.quantity}
                      onChange={(event) => handleUpdateItem(index, 'quantity', Number(event.target.value) || 0)}
                      title={language === 'en' ? 'Quantity' : 'அளவு'}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-600">{language === 'en' ? 'Remarks' : 'குறிப்பு'}</label>
                    <input
                      type="text"
                      value={normalizedItem.remarks || ''}
                      onChange={(event) => handleUpdateItem(index, 'remarks', event.target.value)}
                      title={language === 'en' ? 'Remarks' : 'குறிப்பு'}
                      placeholder={language === 'en' ? 'Optional remarks' : 'விருப்ப குறிப்பு'}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      title={language === 'en' ? 'Remove row' : 'வரியை நீக்கு'}
                      aria-label={language === 'en' ? 'Remove row' : 'வரியை நீக்கு'}
                      className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Transport Purpose' : 'போக்குவரத்து நோக்கம்'}</label>
            <select
              value={formData.transportPurpose || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, transportPurpose: event.target.value }))}
              title={language === 'en' ? 'Transport Purpose' : 'போக்குவரத்து நோக்கம்'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{language === 'en' ? 'Select purpose' : 'நோக்கத்தைத் தேர்ந்தெடுக்கவும்'}</option>
              {DELIVERY_NOTE_TRANSPORT_PURPOSES.map((purpose) => (
                <option key={purpose} value={purpose}>{purpose}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Vehicle Number' : 'வண்டி எண்'}</label>
            <input
              type="text"
              value={formData.vehicleNumber || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, vehicleNumber: event.target.value.toUpperCase() }))}
              title={language === 'en' ? 'Vehicle Number' : 'வண்டி எண்'}
              placeholder="TN12 R 9378"
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 uppercase outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Approximate Value' : 'தோராயமான மதிப்பு'}</label>
            <input
              type="number"
              min="0"
              value={formData.approximateValue ?? 0}
              onChange={(event) => setFormData((previous) => ({ ...previous, approximateValue: Number(event.target.value) || 0 }))}
              title={language === 'en' ? 'Approximate Value' : 'தோராயமான மதிப்பு'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-1 text-xs text-stone-500">{formatCurrency(Number(formData.approximateValue || 0))}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-sm font-bold text-stone-800">{language === 'en' ? 'Purpose of Transport' : 'போக்குவரத்து நோக்கம்'}</div>
            <div className="mt-3 grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
              {DELIVERY_NOTE_TRANSPORT_PURPOSES.map((purpose) => {
                const checked = (formData.transportPurpose || '') === purpose;
                return (
                  <div key={purpose} className="flex items-center gap-2">
                    <span className="font-mono text-base">{checked ? '☑' : '☐'}</span>
                    <span>{purpose}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-sm font-bold text-stone-800">{language === 'en' ? 'Vehicle No:' : 'வண்டி எண்:'}</div>
            <div className="mt-2 text-lg font-semibold text-stone-900">{formData.vehicleNumber || '-'}</div>
            <div className="mt-4 text-sm font-bold text-stone-800">{language === 'en' ? 'Approximate Value' : 'தோராயமான மதிப்பு'}</div>
            <div className="mt-2 text-lg font-semibold text-stone-900">{formatCurrency(Number(formData.approximateValue || 0))}</div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-stone-700">{language === 'en' ? 'Remarks' : 'குறிப்புகள்'}</label>
          <textarea
            value={formData.remarks || ''}
            onChange={(event) => setFormData((previous) => ({ ...previous, remarks: event.target.value }))}
            rows={3}
            title={language === 'en' ? 'Remarks' : 'குறிப்புகள்'}
            className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={language === 'en' ? 'Optional remarks for the delivery note' : 'டெலிவரி நோட்டுக்கான கூடுதல் குறிப்புகள்'}
          />
        </div>
      </div>

      <div className="hidden flex-wrap gap-3 sm:flex">
        <button
          type="button"
          onClick={() => setLeaveTarget('/delivery-notes')}
          className="min-h-12 rounded-2xl border border-stone-200 bg-white px-6 py-3 font-semibold text-stone-700 shadow-sm"
        >
          {language === 'ta' ? 'பின்செல்' : 'Back'}
        </button>
        <button type="button" onClick={() => id ? navigate(`/delivery-notes/${id}`) : showToast(language === 'ta' ? 'முழு முன்னோட்டத்தைத் திறக்க முதலில் ஆவணத்தைச் சேமிக்கவும்.' : 'Save the document first to open its full preview.', 'info')} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-3 font-semibold text-emerald-800"><Eye size={18} /> {language === 'ta' ? 'முன்னோட்டம்' : 'Preview'}</button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm"
        >
          <Save size={18} /> {language === 'ta' ? 'சேமித்து முடி' : 'Save and Finish'}
        </button>
      </div>
      <div className="fixed inset-x-0 z-30 border-t border-stone-200 bg-white px-3 py-2 shadow-[0_-3px_12px_rgba(28,25,23,0.08)] sm:hidden print:hidden bottom-[calc(72px+env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center justify-between px-1 text-sm">
          <span className="font-medium text-stone-600">{language === 'ta' ? 'தோராயமான மொத்தம்' : 'Approximate total'}</span>
          <span className="font-black text-emerald-700">{formatCurrency(Number(formData.approximateValue || 0))}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { id ? navigate(`/delivery-notes/${id}`) : showToast(language === 'ta' ? 'முழு முன்னோட்டத்தைத் திறக்க முதலில் ஆவணத்தைச் சேமிக்கவும்.' : 'Save the document first to open its full preview.', 'info'); }} className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800">{language === 'ta' ? 'முன்னோட்டம்' : 'Preview'}</button>
          <button type="button" onClick={handleSave} className="min-h-12 rounded-xl bg-emerald-600 px-2 font-semibold text-white">{language === 'ta' ? 'சேமித்து முடி' : 'Save and Finish'}</button>
        </div>
      </div>
      <ConfirmDialog open={Boolean(leaveTarget)} title={language === 'ta' ? 'இந்த விநியோகக் குறிப்பிலிருந்து வெளியேறவா?' : 'Leave this delivery note?'} message={hasUnsavedDraft ? 'BillEase will save a durable local draft before leaving.' : 'Your latest changes are saved locally.'} confirmLabel={language === 'ta' ? 'வெளியேறு' : 'Leave'} onCancel={() => setLeaveTarget(null)} onConfirm={async () => { const target = leaveTarget; if (!(await flushDraft())) { showToast('Could not save a recovery draft. Continue editing and try again.', 'error'); return; } setLeaveTarget(null); if (target) navigate(target); }} />
    </div>
  );
}
