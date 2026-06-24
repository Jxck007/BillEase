import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
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

function createDraftNumber(existingCount: number) {
  const currentYear = new Date().getFullYear();
  return `DN/${currentYear}-${currentYear + 1}/${String(existingCount + 1).padStart(3, '0')}`;
}

export default function DeliveryNoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, addDeliveryNote, updateDeliveryNote } = useData();
  const { language } = useLanguage();

  const existingNote = state.deliveryNotes.find((note) => note.id === id);

  const [formData, setFormData] = useState<Partial<DeliveryNote>>(() =>
    existingNote
      ? normalizeDeliveryNote(existingNote as Partial<DeliveryNote> & Record<string, unknown>)
      : {
          deliveryNoteNumber: createDraftNumber(state.deliveryNotes.length),
          dnNumber: createDraftNumber(state.deliveryNotes.length),
          date: new Date().toISOString().split('T')[0],
          copyType: 'Original for Consignee',
          customerId: '',
          consigneeId: '',
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

  useEffect(() => {
    if (!existingNote) return;
    setFormData(normalizeDeliveryNote(existingNote as Partial<DeliveryNote> & Record<string, unknown>));
  }, [existingNote]);

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

  const handleSave = () => {
    if (!formData.customerId) {
      alert(language === 'en' ? 'Please select a customer' : 'வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்');
      return;
    }

    const items = (formData.items || []).map((item) => normalizeDeliveryNoteItem(item as Partial<DeliveryNoteItem>));
    const validItems = items.filter((item) => item.description.trim());

    if (validItems.length === 0) {
      alert(language === 'en' ? 'Add at least one goods row' : 'குறைந்தபட்சம் ஒரு பொருள் வரியைச் சேர்க்கவும்');
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

    if (id) {
      updateDeliveryNote(id, note);
    } else {
      addDeliveryNote(note);
    }

    navigate('/delivery-notes');
  };

  const displayCopyType = normalizeDeliveryNoteCopyType(String(formData.copyType || 'Original for Consignee'));

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
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
          <h1 className="text-2xl font-black text-stone-800">
            {id ? (language === 'en' ? 'Edit Delivery Note' : 'டெலிவரி நோட்டைத் திருத்து') : (language === 'en' ? 'New Delivery Note' : 'புதிய டெலிவரி நோட்')}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{language === 'en' ? 'Transport / dispatch document' : 'பரிமாற்ற / டிஸ்பாட்ச் ஆவணம்'}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-[12px] font-black uppercase tracking-wide text-stone-800">PARTICULARS OF PLACE</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">{language === 'en' ? '(a) From where goods are consigned' : '(a) பொருள் அனுப்பப்படும் இடம்'}</label>
            <input
              type="text"
              value={formData.fromPlace || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, fromPlace: event.target.value }))}
              title={language === 'en' ? 'From where goods are consigned' : 'பொருள் அனுப்பப்படும் இடம்'}
              placeholder={language === 'en' ? 'Enter from place' : 'From place'}
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
              placeholder={language === 'en' ? 'Enter to place' : 'To place'}
              className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_160px_140px_120px_2fr_auto]">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate('/delivery-notes')}
          className="rounded-2xl border border-stone-200 bg-white px-6 py-3 font-semibold text-stone-700 shadow-sm"
        >
          {language === 'en' ? 'Cancel' : 'ரத்து செய்'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-2xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm"
        >
          {language === 'en' ? 'Save' : 'சேமிக்கவும்'}
        </button>
      </div>
    </div>
  );
}