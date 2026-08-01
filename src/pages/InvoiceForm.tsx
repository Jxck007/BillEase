import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eye, Plus, Save, Sparkles } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Customer, Invoice, InvoiceItem, Product } from '../lib/types';
import { formatCurrency, generateId, roundMoney } from '../lib/utils';
import { buildDefaultInvoiceNumber, calculateInvoiceFromDraft, clearDraft, getNextInvoiceNumber, loadDraft } from '../services/invoiceService';
import { getStateCodeFromGSTIN, getStateNameFromCode, validateGSTIN } from '../gst/gstService';
import { useAutosaveDraft } from '../hooks/useAutosaveDraft';
import ItemRow from '../components/invoice/ItemRow';
import { CUSTOMER_FIELD_OPTIONS, DEFAULT_CUSTOMER_FIELD_VISIBILITY, withDefaultCustomerFieldVisibility } from '../lib/invoiceCustomerFields';
import { ESTIMATE_COPY_TYPES, getEstimateDocumentName, getEstimateNumberLabel, normalizeEstimateCopyType } from '../lib/estimateUtils';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { deleteLocalDraft, loadLocalDraft } from '../services/localDataStore';

function Label({ english, tamil, helper }: { english: string; tamil: string; helper?: string }) {
  const { language } = useLanguage();
  return (
    <div className="mb-1">
      <div className="text-sm font-semibold text-stone-800">{language === 'ta' ? tamil : english}</div>
      {helper && <div className="mt-1 text-[11px] text-stone-400">{helper}</div>}
    </div>
  );
}

const blankItem = (): InvoiceItem => ({
  id: generateId(),
  productId: '',
  name: '',
  description: '',
  hsnSac: '',
  unit: 'Nos',
  quantity: 1,
  price: 0,
  taxRate: 0,
  discount: 0,
  discountType: 'percent',
});

export default function InvoiceForm() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer') || '';
  const { state, addInvoice, updateInvoice, addCustomer, addAuditLog } = useData();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const isEditing = Boolean(id && id !== 'new');
  const isEstimate = location.pathname.includes('/estimates');
  const invoiceType: Invoice['type'] = isEstimate ? 'estimate' : 'invoice';

  const createInitialDraft = (): Partial<Invoice> => ({
    id: generateId(),
    invoiceNumber: getNextInvoiceNumber(state.invoices, state.settings.invoicePrefix, invoiceType),
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: undefined,
    poNumber: '',
    poDate: '',
    poMode: '',
    copyType: (invoiceType === 'estimate' ? 'ORIGINAL COPY' : 'DUPLICATE COPY') as Invoice['copyType'],
    placeOfSupply: state.profile.stateCode ? getStateNameFromCode(state.profile.stateCode) : '',
    reverseCharge: false,
    gstMode: state.settings.taxMode,
    templateId: invoiceType === 'invoice' ? 'canonical' : state.settings.defaultTemplate,
    draft: true,
    items: [blankItem()],
    subtotal: 0,
    taxableAmount: 0,
    taxTotal: 0,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 0,
    discountTotal: 0,
    shippingCharge: 0,
    adjustment: 0,
    roundOff: 0,
    total: 0,
    payments: [],
    amountPaid: 0,
    balanceDue: 0,
    paymentStatus: 'unpaid',
    status: 'unpaid' as Invoice['status'],
    notes: '',
    terms: '',
    signatureName: state.profile.name,
    customerFieldVisibility: DEFAULT_CUSTOMER_FIELD_VISIBILITY,
    qrCodeData: '',
    type: invoiceType,
  });

  const [draft, setDraft] = useState<Partial<Invoice>>(createInitialDraft);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '', stateCode: '' });
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedCustomer = useMemo(
    () => state.customers.find((customer) => customer.id === draft.customerId),
    [state.customers, draft.customerId]
  );

  const calculated = useMemo(() => calculateInvoiceFromDraft(draft, state.profile, selectedCustomer), [draft, state.profile, selectedCustomer]);
  const viewDraft = { ...draft, ...calculated } as Partial<Invoice>;

  const draftKey = `${invoiceType}:${isEditing ? id : 'new'}`;
  const { flushDraft, draftSaveStatus, hasUnsavedDraft } = useAutosaveDraft(viewDraft, state.settings.enableAutosave && state.settings.enableDrafts, draftKey, isEstimate ? 'quotation' : 'invoice');

  useEffect(() => {
    if (isEditing) {
      const invoice = state.invoices.find((entry) => entry.id === id);
      if (invoice) {
        setDraft(invoice);
        setCustomerSearch(state.customers.find((customer) => customer.id === invoice.customerId)?.name || '');
      }
      return;
    }

    let active = true;
    const restore = async () => {
      let saved = loadDraft();
      try {
        const durable = await loadLocalDraft<Partial<Invoice>>(draftKey);
        if (durable?.value.type === invoiceType) saved = durable.value;
      } catch {
        showToast('Local draft recovery is unavailable. Keep this tab open while editing.', 'error');
      }
      if (!active) return;
      if (saved && saved.type === invoiceType) {
        setDraft({ ...createInitialDraft(), ...saved, id: saved.id || generateId(), type: invoiceType });
        setCustomerSearch(state.customers.find((customer) => customer.id === saved.customerId)?.name || saved.customerSnapshot?.name || '');
      } else {
        const customer = state.customers.find((entry) => entry.id === preselectedCustomerId);
        setDraft({ ...createInitialDraft(), customerId: customer?.id || '' });
        setCustomerSearch(customer?.name || '');
      }
    };
    void restore();
    return () => { active = false; };
  }, [id, isEditing, invoiceType, preselectedCustomerId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasUnsavedDraft) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedDraft]);

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSearch(selectedCustomer.name);
      if (!draft.placeOfSupply && selectedCustomer.stateCode) {
        setDraft((current) => ({ ...current, placeOfSupply: getStateNameFromCode(selectedCustomer.stateCode) }));
      }
    }
  }, [selectedCustomer]);

  const updateDraft = (patch: Partial<Invoice>) => setDraft((current) => ({ ...current, ...patch }));
  const updateItem = (itemId: string, patch: Partial<InvoiceItem>) => updateDraft({ items: (draft.items || []).map((item) => item.id === itemId ? { ...item, ...patch } : item) });

  const productMatches = (query: string) => state.products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) || (product.hsnSac || '').toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  const customerMatches = state.customers.filter((customer) => customer.name.toLowerCase().includes(customerSearch.toLowerCase()) || customer.phone.includes(customerSearch) || (customer.gstNumber || '').toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 6);

  const selectProduct = (itemId: string, product: Product) => {
    updateDraft({
      items: (draft.items || []).map((item) => item.id === itemId ? {
        ...item,
        productId: product.id,
        name: product.name,
        description: product.description || item.description,
        hsnSac: product.hsnSac || item.hsnSac,
        unit: product.unit || item.unit || 'Nos',
        price: product.price,
        taxRate: product.taxRate,
      } : item),
    });
    setActiveItemId(null);
  };
  const addRecentProduct = (product: Product) => {
    updateDraft({
      items: [
        ...(draft.items || []).filter((item) => item.name.trim()),
        {
          ...blankItem(),
          productId: product.id,
          name: product.name,
          description: product.description || '',
          hsnSac: product.hsnSac || '',
          unit: product.unit,
          price: product.price,
          taxRate: product.taxRate,
        },
      ],
    });
  };

  const addItem = () => updateDraft({ items: [...(draft.items || []), blankItem()] });
  const removeItem = (itemId: string) => updateDraft({ items: (draft.items || []).filter((item) => item.id !== itemId) });

  const handleSave = async () => {
    if (isSaving) return;
    if (!draft.customerId) {
      showToast(language === 'en' ? 'Select a customer first.' : 'முதலில் வாடிக்கையாளரைத் தேர்வு செய்யவும்.', 'error');
      return;
    }

    const validItems = (draft.items || []).filter((item) => item.name.trim().length > 0);
    if (validItems.length === 0) {
      showToast(language === 'en' ? 'Add at least one item.' : 'குறைந்தது ஒரு பொருளை சேர்க்கவும்.', 'error');
      return;
    }

    const payload: Omit<Invoice, 'createdAt'> = {
      ...(viewDraft as Omit<Invoice, 'createdAt'>),
      id: draft.id || generateId(),
      invoiceNumber: draft.invoiceNumber || buildDefaultInvoiceNumber(state.settings.invoicePrefix, state.settings.invoiceStartingNumber, invoiceType),
      customerId: draft.customerId,
      date: draft.date || new Date().toISOString().split('T')[0],
      dueDate: isEstimate ? undefined : (draft.dueDate || undefined),
      poNumber: draft.poNumber || '',
      poDate: draft.poDate || '',
      poMode: draft.poMode || '',
      copyType: isEstimate
        ? normalizeEstimateCopyType(draft.copyType)
        : (draft.copyType || 'DUPLICATE COPY'),
      items: validItems,
      subtotal: roundMoney(viewDraft.subtotal || 0),
      taxableAmount: roundMoney(viewDraft.taxableAmount || 0),
      taxTotal: roundMoney(viewDraft.taxTotal || 0),
      cgstTotal: roundMoney(viewDraft.cgstTotal || 0),
      sgstTotal: roundMoney(viewDraft.sgstTotal || 0),
      igstTotal: roundMoney(viewDraft.igstTotal || 0),
      discountTotal: roundMoney(viewDraft.discountTotal || 0),
      shippingCharge: isEstimate ? 0 : roundMoney(viewDraft.shippingCharge || 0),
      adjustment: isEstimate ? 0 : roundMoney(viewDraft.adjustment || 0),
      roundOff: roundMoney(viewDraft.roundOff || 0),
      total: roundMoney(viewDraft.total || 0),
      payments: isEstimate ? [] : (draft.payments || []),
      amountPaid: isEstimate ? 0 : roundMoney(draft.amountPaid || 0),
      balanceDue: isEstimate ? roundMoney(viewDraft.total || 0) : roundMoney(Math.max(0, (viewDraft.total || 0) - (draft.amountPaid || 0))),
      paymentStatus: isEstimate ? 'unpaid' : (draft.paymentStatus || 'unpaid'),
      status: isEstimate ? 'unpaid' : (draft.status || 'unpaid'),
      notes: draft.notes || '',
      terms: draft.terms || state.settings.template.footerText,
      type: invoiceType,
      draft: false,
      placeOfSupply: draft.placeOfSupply,
      reverseCharge: Boolean(draft.reverseCharge),
      gstMode: draft.gstMode || state.settings.taxMode,
      templateId: isEstimate ? (draft.templateId || state.settings.defaultTemplate) : 'canonical',
      signatureName: draft.signatureName || state.profile.name,
      customerFieldVisibility: withDefaultCustomerFieldVisibility(draft.customerFieldVisibility),
      qrCodeData: draft.qrCodeData || '',
    };

    setIsSaving(true);
    const draftSafe = await flushDraft();
    if (!draftSafe) {
      showToast('Something went wrong while saving. Your work is still open as a draft.', 'error');
      setIsSaving(false);
      return;
    }
    const result = isEditing && draft.id
      ? await updateInvoice(draft.id, payload)
      : await addInvoice(payload);
    if (!result.ok) {
      showToast(result.errors?.[0]?.message || 'Something went wrong while saving. Your work has been kept as a draft.', 'error');
      setIsSaving(false);
      return;
    }
    if (isEditing && draft.id) void addAuditLog({ entityType: 'invoice', entityId: draft.id, action: 'updated', message: 'Invoice updated' });
    try {
      await deleteLocalDraft(draftKey);
      clearDraft();
    } catch {
      showToast('The document is saved, but its old draft could not be removed.', 'info');
    }
    showToast(isEstimate ? 'Quotation saved' : 'Invoice saved', 'success');
    navigate(isEstimate ? '/estimates' : '/invoices');
  };

  const invoiceItems = draft.items || [];
  const activeProductQuery = activeItemId ? (draft.items || []).find((item) => item.id === activeItemId)?.name || '' : '';
  const activeProductMatches = activeItemId ? productMatches(activeProductQuery) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-48 sm:pb-12">
      <div className="flex items-start gap-3 border-b border-stone-200 pb-4">
        <button type="button" title={t('back')} aria-label={t('back')} onClick={() => setLeaveTarget(isEstimate ? '/estimates' : '/invoices')} className="shrink-0 inline-flex min-h-12 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 shadow-sm">
          <ArrowLeft size={24} className="text-stone-600" />
          <span className="text-sm font-semibold text-stone-700">{isEstimate ? (language === 'ta' ? '← விலைமதிப்பீடுகள்' : '← Quotations') : (language === 'ta' ? '← விலைப்பட்டியல்கள்' : '← Invoices')}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-stone-800">{isEditing ? t('edit') : isEstimate ? (language === 'en' ? `Create ${getEstimateDocumentName(state.settings, language)}` : `புதிய ${getEstimateDocumentName(state.settings, language)}`) : t('createInvoice')}</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">{invoiceType}</span>
          </div>
          <p className="mt-1 text-sm text-stone-600" role="status" aria-live="polite">{draftSaveStatus === 'saving' ? (language === 'ta' ? 'வரைவு இந்தச் சாதனத்தில் சேமிக்கப்படுகிறது…' : 'Saving draft on this device…') : draftSaveStatus === 'saved-locally' ? (language === 'ta' ? 'வரைவு இந்தச் சாதனத்தில் சேமிக்கப்பட்டது' : 'Draft saved on this device') : draftSaveStatus === 'failed' ? (language === 'ta' ? 'வரைவைச் சேமிக்க முடியவில்லை — மீண்டும் முயலவும்' : 'Draft could not be saved — try again') : language === 'en' ? 'Drafts save automatically on this device' : 'வரைவுகள் இந்தச் சாதனத்தில் தானாகச் சேமிக்கப்படும்'}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-6">
          <div className="rounded-3xl border bg-white p-4 md:p-6 shadow-sm space-y-6">
            <details open className="form-section">
              <summary>{language === 'ta' ? 'வாடிக்கையாளர்' : 'Customer'}</summary>
              <div className="pt-4">
                <Label english={t('customerName')} tamil="வாடிக்கையாளர் பெயர்" helper={language === 'en' ? 'Search or create a customer quickly.' : 'வாடிக்கையாளரை தேடவும் அல்லது புதிதாக சேர்க்கவும்.'} />
                <div className="relative">
                  <input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); const match = state.customers.find((customer) => customer.name.toLowerCase() === event.target.value.trim().toLowerCase()); updateDraft({ customerId: match?.id || '' }); }} placeholder={language === 'en' ? 'Type name or phone' : 'பெயர் அல்லது போன்'} className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="absolute right-2 top-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{language === 'en' ? 'New' : 'புதிய'}</button>
                  {customerSearch && customerMatches.length > 0 && !selectedCustomer && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-xl">
                      {customerMatches.map((customer) => (
                        <button key={customer.id} type="button" onClick={() => { updateDraft({ customerId: customer.id }); setCustomerSearch(customer.name); }} className="block w-full border-b px-4 py-3 text-left last:border-0 hover:bg-emerald-50">
                          <div className="font-semibold text-stone-800">{customer.name}</div>
                          <div className="text-xs text-stone-500">{customer.phone}{customer.gstNumber ? ` • ${customer.gstNumber}` : ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedCustomer && <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-stone-700">{selectedCustomer.name}{selectedCustomer.gstNumber ? ` • ${selectedCustomer.gstNumber}` : ''}{selectedCustomer.stateCode ? ` • ${selectedCustomer.stateCode}` : ''}</div>}
              </div>
            </details>

            <details open className="form-section">
              <summary>{language === 'ta' ? 'ஆவண விவரங்கள்' : 'Document details'}</summary>
              <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
                <div>
                  <Label english={isEstimate ? getEstimateNumberLabel(state.settings) : t('invoiceNumber')} tamil="பில் எண்" />
                  <input value={draft.invoiceNumber || ''} onChange={(event) => updateDraft({ invoiceNumber: event.target.value.toUpperCase() })} placeholder={isEstimate ? getEstimateNumberLabel(state.settings) : (language === 'en' ? 'Invoice number' : 'பில் எண்')} title={isEstimate ? getEstimateNumberLabel(state.settings) : (language === 'en' ? 'Invoice number' : 'பில் எண்')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold uppercase outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <Label english={t('date')} tamil="தேதி" />
                  <input type="date" value={draft.date || ''} onChange={(event) => updateDraft({ date: event.target.value })} title={t('date')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                {isEstimate ? (
                  <div>
                    <Label english={language === 'en' ? 'Copy Type' : 'நகல் வகை'} tamil="நகல் வகை" helper={language === 'en' ? 'Shown on the generated quotation/estimate' : 'உருவாக்கப்படும் ஆவணத்தில் காட்டப்படும்'} />
                    <select
                      value={normalizeEstimateCopyType(draft.copyType)}
                      onChange={(event) => updateDraft({ copyType: event.target.value as Invoice['copyType'] })}
                      title={language === 'en' ? 'Copy Type' : 'நகல் வகை'}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {ESTIMATE_COPY_TYPES.map((copyType) => (
                        <option key={copyType.value} value={copyType.value}>{copyType.label}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {!isEstimate ? (
                  <>
                    <div>
                      <Label english="P.O Number" tamil="P.O எண்" />
                      <input value={draft.poNumber || ''} onChange={(event) => updateDraft({ poNumber: event.target.value })} title="P.O Number" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <Label english="P.O Date" tamil="P.O தேதி" />
                      <input type="date" value={draft.poDate || ''} onChange={(event) => updateDraft({ poDate: event.target.value })} title="P.O Date" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <Label english="P.O Mode" tamil="P.O Mode" helper="Email / WhatsApp / Phone" />
                      <input value={draft.poMode || ''} onChange={(event) => updateDraft({ poMode: event.target.value })} title="P.O Mode" placeholder="Email" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </>
                ) : null}
              </div>
            </details>

            {isEstimate ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {language === 'en'
                  ? `${getEstimateDocumentName(state.settings, language)} documents use the quotation layout for preview, print, PDF, PNG, and sharing.`
                  : `${getEstimateDocumentName(state.settings, language)} ஆவணங்கள் விலைமதிப்பீட்டு வடிவமைப்பைப் பயன்படுத்தும்.`}
              </div>
            ) : null}

            <details open className="form-section">
              <summary>{language === 'ta' ? 'பொருட்கள்' : 'Items'}</summary>
              <div className="relative pt-4">
              {state.products.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{language === 'ta' ? 'சமீபத்திய பொருட்கள்' : 'Recent products'}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {state.products.slice(-5).reverse().map((product) => (
                      <button key={product.id} type="button" onClick={() => addRecentProduct(product)} className="min-h-12 shrink-0 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 hover:border-emerald-300 hover:bg-emerald-50">
                        + {product.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-bold text-stone-800">{language === 'en' ? 'Items' : 'பொருட்கள்'}</h2>
                <span className="ml-3 text-xs text-stone-500">{language === 'en' ? 'Add and edit invoice line items' : 'பொருள்களைச் சேர்க்கவும் மற்றும் தொகுக்கவும்'}</span>
                <button type="button" onClick={addItem} className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-white font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><Plus size={16} />{t('addItem')}</button>
              </div>
              <div className="space-y-4 pt-2">
                {invoiceItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    productMatches={productMatches}
                    activeMatches={activeProductMatches}
                    isActive={activeItemId === item.id}
                    gstMode={draft.gstMode || state.settings.taxMode}
                    isEstimate={isEstimate}
                    onFocus={() => setActiveItemId(item.id)}
                    onChange={(patch) => updateItem(item.id, patch)}
                    onSelectProduct={(p) => selectProduct(item.id, p)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
              </div>
            </details>

            <button type="button" onClick={() => setIsAdvancedOpen((current) => !current)} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 font-semibold text-stone-800">
              <span>{language === 'en' ? '4. Totals and additional options' : '4. மொத்தம் மற்றும் கூடுதல் விருப்பங்கள்'}</span>
              {isAdvancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isAdvancedOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label english={t('placeOfSupply')} tamil="விநியோக இடம்" helper={language === 'en' ? 'Used for CGST/SGST vs IGST logic.' : 'CGST/SGST அல்லது IGST கணக்கிற்குப் பயன்படும்.'} />
                  <input value={draft.placeOfSupply || ''} onChange={(event) => updateDraft({ placeOfSupply: event.target.value })} title={t('placeOfSupply')} placeholder={language === 'en' ? 'Place of supply' : 'விநியோக இடம்'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <Label english={language === 'en' ? 'GST Mode' : 'GST வகை'} tamil="வரி முறை" />
                  <select value={draft.gstMode || state.settings.taxMode} onChange={(event) => updateDraft({ gstMode: event.target.value as 'inclusive' | 'exclusive' })} title={language === 'en' ? 'GST mode' : 'GST வகை'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="exclusive">{language === 'ta' ? 'GST தனியாக' : 'GST Exclusive'}</option>
                    <option value="inclusive">{language === 'ta' ? 'GST உட்பட' : 'GST Inclusive'}</option>
                  </select>
                </div>
                {!isEstimate ? (
                  <div>
                    <Label english={t('reverseCharge')} tamil="ரிவர்ஸ் சார்ஜ்" />
                    <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                      <input type="checkbox" checked={Boolean(draft.reverseCharge)} onChange={(event) => updateDraft({ reverseCharge: event.target.checked })} />
                      <span className="text-sm text-stone-700">{language === 'en' ? 'Show reverse charge on invoice' : 'பில்லில் reverse charge காட்டவும்'}</span>
                    </label>
                  </div>
                ) : null}
                {!isEstimate ? (
                  <div>
                    <Label english={t('dueDate')} tamil="கடைசி தேதி" helper={language === 'en' ? 'Required only when overdue tracking is needed.' : 'காலாவதி கண்காணிப்பு தேவைப்பட்டால் மட்டும் அமைக்கவும்.'} />
                    <input type="date" value={draft.dueDate || ''} min={draft.date || undefined} onChange={(event) => updateDraft({ dueDate: event.target.value || undefined })} title={t('dueDate')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                ) : null}
                {!isEstimate ? (
                  <div>
                    <Label english={language === 'en' ? 'Shipping / Extra Charges' : 'கூடுதல் கட்டணம்'} tamil="கூடுதல் கட்டணம்" />
                    <input type="text" inputMode="decimal" value={draft.shippingCharge || 0} onChange={(event) => updateDraft({ shippingCharge: Number(event.target.value) || 0 })} title={language === 'en' ? 'Shipping charges' : 'கூடுதல் கட்டணம்'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-right outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                ) : null}
                {!isEstimate ? (
                  <div>
                    <Label english={t('adjustment')} tamil="சரி செய்த தொகை" />
                    <input type="text" inputMode="decimal" value={draft.adjustment || 0} onChange={(event) => updateDraft({ adjustment: Number(event.target.value) || 0 })} title={t('adjustment')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-right outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                ) : null}
                <div>
                  <Label english={language === 'en' ? 'Signature name' : 'கையொப்ப பெயர்'} tamil="கையொப்பம்" />
                  <input value={draft.signatureName || ''} onChange={(event) => updateDraft({ signatureName: event.target.value })} title={language === 'en' ? 'Signature name' : 'கையொப்ப பெயர்'} placeholder={language === 'en' ? 'Signature name' : 'கையொப்ப பெயர்'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                {!isEstimate ? (
                <div>
                  <Label english={language === 'en' ? 'Copy Type' : 'நகल் வகை'} tamil="நகल் வகை" helper={language === 'en' ? 'Select the type of invoice copy' : 'பில் நகलின் வகையைத் தேர்வு செய்யவும்'} />
                  <select value={draft.copyType || 'DUPLICATE COPY'} onChange={(event) => updateDraft({ copyType: event.target.value as Invoice['copyType'] })} title={language === 'en' ? 'Copy type' : 'நகல் வகை'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="ORIGINAL COPY">{language === 'en' ? 'Original Copy' : 'அசல் நகல்'}</option>
                    <option value="DUPLICATE COPY">{language === 'en' ? 'Duplicate Copy' : 'நகल்'}</option>
                    <option value="TRANSPORT COPY">{language === 'en' ? 'Transport Copy' : 'போக்குவரத்து நகல்'}</option>
                    <option value="EXTRA COPY">{language === 'en' ? 'Extra Copy' : 'கூடுதல் நகல்'}</option>
                  </select>
                </div>
                                ) : null}
                <div className="md:col-span-2">
                  <Label english={language === 'en' ? 'Customer details shown on document' : 'ஆவணத்தில் காட்டப்படும் வாடிக்கையாளர் விவரங்கள்'} tamil="வாடிக்கையாளர் விவரங்கள்" />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 rounded-2xl border border-stone-200 bg-white p-3 text-sm">
                    {CUSTOMER_FIELD_OPTIONS.map((option) => (
                      <label key={option.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={withDefaultCustomerFieldVisibility(draft.customerFieldVisibility)[option.key]}
                          onChange={(event) => updateDraft({
                            customerFieldVisibility: {
                              ...withDefaultCustomerFieldVisibility(draft.customerFieldVisibility),
                              [option.key]: event.target.checked,
                            },
                          })}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDraft({ customerFieldVisibility: DEFAULT_CUSTOMER_FIELD_VISIBILITY })}
                    className="mt-2 rounded-xl border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    {language === 'en' ? 'Reset fields' : 'புலங்களை மீட்டமை'}
                  </button>
                </div>
                <div className="md:col-span-2">
                  <Label english={t('notes')} tamil="குறிப்புகள்" />
                  <textarea value={draft.notes || ''} onChange={(event) => updateDraft({ notes: event.target.value })} rows={3} title={t('notes')} placeholder={language === 'en' ? 'Notes' : 'குறிப்புகள்'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="md:col-span-2">
                  <Label english={language === 'en' ? 'Terms & Conditions' : 'விதிமுறைகள் & நிபந்தனைகள்'} tamil="விதிமுறைகள்" />
                  <textarea value={draft.terms || ''} onChange={(event) => updateDraft({ terms: event.target.value })} rows={3} title={language === 'en' ? 'Terms & conditions' : 'விதிமுறைகள்'} placeholder={language === 'en' ? 'Terms & conditions' : 'விதிமுறைகள்'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 min-[1180px]:sticky min-[1180px]:top-24">
          <details open className="rounded-3xl border bg-white p-5 shadow-sm">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-bold text-stone-800 min-[1180px]:hidden">
              <Sparkles size={18} className="text-emerald-600" />{language === 'en' ? 'Live summary' : 'நேரடி சுருக்கம்'}
            </summary>
            <div className="space-y-3">
            <div className="hidden items-center gap-2 text-stone-800 font-bold min-[1180px]:flex"><Sparkles size={18} className="text-emerald-600" />{language === 'en' ? 'Live summary' : 'நேரடி சுருக்கம்'}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>{t('subtotal')}</span><span>{formatCurrency(viewDraft.subtotal || 0)}</span></div>
              <div className="flex justify-between"><span>{t('taxableAmount')}</span><span>{formatCurrency(viewDraft.taxableAmount || 0)}</span></div>
              <div className="flex justify-between"><span>{t('cgst')}</span><span>{formatCurrency(viewDraft.cgstTotal || 0)}</span></div>
              <div className="flex justify-between"><span>{t('sgst')}</span><span>{formatCurrency(viewDraft.sgstTotal || 0)}</span></div>
              <div className="flex justify-between"><span>{t('igst')}</span><span>{formatCurrency(viewDraft.igstTotal || 0)}</span></div>
              {(viewDraft.discountTotal || 0) > 0 && <div className="flex justify-between text-amber-700"><span>{t('discount')}</span><span>-{formatCurrency(viewDraft.discountTotal || 0)}</span></div>}
              {!isEstimate && <div className="flex justify-between"><span>{language === 'en' ? 'Shipping' : 'கூடுதல்'}</span><span>{formatCurrency(viewDraft.shippingCharge || 0)}</span></div>}
              {!isEstimate && <div className="flex justify-between"><span>{language === 'en' ? 'Adjustment' : 'சரி செய்தல்'}</span><span>{formatCurrency(viewDraft.adjustment || 0)}</span></div>}
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="font-bold text-stone-800">{t('grandTotal')}</span>
                <span className="text-2xl font-black text-emerald-600">{formatCurrency(viewDraft.total || 0)}</span>
              </div>
              {!isEstimate && <div className="flex justify-between text-stone-500"><span>{t('balanceDue')}</span><span>{formatCurrency(Math.max(0, (viewDraft.total || 0) - (draft.amountPaid || 0)))}</span></div>}
              <details className="border-t border-stone-100 pt-2">
                <summary className="cursor-pointer font-semibold text-stone-700">{language === 'ta' ? 'GST சரிபார்ப்பு' : 'GST check'}</summary>
                <div className="mt-2 space-y-1 text-xs text-stone-500">
                  <div>Business state: {state.settings.businessStateCode || state.profile.stateCode || '-'}</div>
                  <div>Customer state: {selectedCustomer?.stateCode || getStateCodeFromGSTIN(selectedCustomer?.gstNumber) || '-'}</div>
                  <div>GSTIN valid: {selectedCustomer?.gstNumber ? (validateGSTIN(selectedCustomer.gstNumber) ? 'Yes' : 'No') : '-'}</div>
                </div>
              </details>
            </div>
            </div>
          </details>
        </aside>
      </div>

      <div className="hidden border-t bg-white px-4 py-3 sm:block sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button type="button" onClick={() => setLeaveTarget(isEstimate ? '/estimates' : '/invoices')} className="min-h-12 rounded-2xl border border-stone-200 bg-white px-5 py-3 font-semibold text-stone-700 shadow-sm">{t('back')}</button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => isEditing && draft.id ? navigate(`/${isEstimate ? 'estimates' : 'invoices'}/${draft.id}`) : showToast(language === 'ta' ? 'முழு முன்னோட்டத்தைத் திறக்க முதலில் ஆவணத்தைச் சேமிக்கவும்.' : 'Save the document first to open its full preview.', 'info')} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800"><Eye size={18} /> {language === 'ta' ? 'முன்னோட்டம்' : 'Preview'}</button>
            <button type="button" disabled={isSaving} onClick={handleSave} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3 font-bold text-white shadow-sm disabled:opacity-60"><Save size={18} />{isSaving ? 'Saving…' : language === 'ta' ? 'சேமித்து முடி' : 'Save and Finish'}</button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 z-30 border-t border-stone-200 bg-white px-3 py-2 shadow-[0_-3px_12px_rgba(28,25,23,0.08)] sm:hidden print:hidden bottom-[calc(72px+env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center justify-between px-1 text-sm">
          <span className="font-medium text-stone-600">{t('total')}</span>
          <span className="font-black text-emerald-700">{formatCurrency(viewDraft.total || 0)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { isEditing && draft.id ? navigate(`/${isEstimate ? 'estimates' : 'invoices'}/${draft.id}`) : showToast(language === 'ta' ? 'முழு முன்னோட்டத்தைத் திறக்க முதலில் ஆவணத்தைச் சேமிக்கவும்.' : 'Save the document first to open its full preview.', 'info'); }} className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800">{language === 'ta' ? 'முன்னோட்டம்' : 'Preview'}</button>
          <button type="button" disabled={isSaving} onClick={handleSave} className="min-h-12 rounded-xl bg-emerald-700 px-2 font-semibold text-white disabled:opacity-60">{isSaving ? (language === 'ta' ? 'சேமிக்கிறது…' : 'Saving…') : language === 'ta' ? 'சேமித்து முடி' : 'Save and Finish'}</button>
        </div>
      </div>

      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={t('addCustomer')}>
        <div className="space-y-4">
          <div>
            <Label english={t('customerName')} tamil="வாடிக்கையாளர் பெயர்" />
            <input value={customerDraft.name} onChange={(event) => setCustomerDraft((current) => ({ ...current, name: event.target.value }))} placeholder={t('customerName')} title={t('customerName')} className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button type="button" onClick={() => setCustomerDetailsOpen((current) => !current)} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 font-semibold" aria-expanded={customerDetailsOpen}>{language === 'ta' ? 'கூடுதல் விவரங்கள் (விருப்பம்)' : 'More customer details (optional)'}<ChevronDown size={18} className={customerDetailsOpen ? 'rotate-180' : ''} /></button>
          {customerDetailsOpen && <div className="space-y-4 rounded-2xl border border-stone-200 p-4">
          <div>
            <Label english="Phone (Optional)" tamil="போன் எண் (விருப்பம்)" />
            <input value={customerDraft.phone} onChange={(event) => setCustomerDraft((current) => ({ ...current, phone: event.target.value }))} placeholder={t('phone')} title={t('phone')} className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <Label english="Email (Optional)" tamil="Email (விருப்பம்)" />
            <input value={customerDraft.email} onChange={(event) => setCustomerDraft((current) => ({ ...current, email: event.target.value }))} placeholder={t('email')} title={t('email')} className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <Label english="Address (Optional)" tamil="முகவரி (விருப்பம்)" />
            <textarea value={customerDraft.address} onChange={(event) => setCustomerDraft((current) => ({ ...current, address: event.target.value }))} rows={2} placeholder={t('address')} title={t('address')} className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <Label english="GST Number (Optional)" tamil="GST எண் (விருப்பம்)" />
            <input value={customerDraft.gstNumber} onChange={(event) => setCustomerDraft((current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))} placeholder={t('gstNumber')} title={t('gstNumber')} className="w-full rounded-2xl border border-stone-200 px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <Label english={language === 'en' ? 'State code' : 'மாநிலக் குறியீடு'} tamil="மாநிலக் குறியீடு" />
            <input value={customerDraft.stateCode} onChange={(event) => setCustomerDraft((current) => ({ ...current, stateCode: event.target.value }))} placeholder={language === 'en' ? 'State code' : 'மாநிலக் குறியீடு'} title={language === 'en' ? 'State code' : 'மாநிலக் குறியீடு'} className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          </div>}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="rounded-xl border border-stone-200 px-4 py-2 text-stone-700">{t('cancel')}</button>
            <button type="button" onClick={handleCreateCustomer} className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white">{t('saveCustomer')}</button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(leaveTarget)} title="Leave this document?" message={hasUnsavedDraft ? 'BillEase will save a durable local draft before leaving.' : 'Your latest changes are saved locally.'} confirmLabel="Leave" onCancel={() => setLeaveTarget(null)} onConfirm={async () => { const target = leaveTarget; if (!(await flushDraft())) { showToast('Could not save a recovery draft. Continue editing and try again.', 'error'); return; } setLeaveTarget(null); if (target) navigate(target); }} />
    </div>
  );

  async function handleCreateCustomer() {
    if (!customerDraft.name.trim()) {
      showToast('Customer name is required.', 'error');
      return;
    }
    const stateCode = customerDraft.stateCode || state.profile.stateCode || getStateCodeFromGSTIN(state.profile.gst);
    const result = await addCustomer({
      name: customerDraft.name.trim(),
      phone: customerDraft.phone.trim(),
      email: customerDraft.email.trim(),
      address: customerDraft.address.trim(),
      gstNumber: customerDraft.gstNumber.trim().toUpperCase(),
      stateCode,
      whatsapp: customerDraft.phone.trim(),
      notes: '',
    });
    if (!result.ok) {
      showToast(result.errors?.[0]?.message || 'Something went wrong while saving the customer.', 'error');
      return;
    }
    setCustomerDraft({ name: '', phone: '', email: '', address: '', gstNumber: '', stateCode: '' });
    setIsCustomerModalOpen(false);
  }
}
