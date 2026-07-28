import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Landmark,
  Palette,
  PlugZap,
  Save,
  Trash2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { TemplateVisibilitySettings } from '../lib/types';
import {
  DEFAULT_VISUAL_ASSETS,
  removeVisualAsset,
  restoreDefaultVisualAsset,
  saveVisualAsset,
  useVisualAsset,
  VisualAssetName,
} from '../lib/firebase';
import { prepareDocumentAsset } from '../utils/imageAssets';
import { useIntegrationAvailability } from '../hooks/useIntegrationAvailability';
import PinLookupField from '../components/forms/PinLookupField';

type SettingsSectionId = 'company' | 'payment' | 'branding' | 'integrations';
type BankDetailsForm = {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  branch: string;
  accountType: string;
  swiftCode: string;
};

const sectionDefinitions = [
  { id: 'company' as const, label: 'Company Profile', icon: Building2 },
  { id: 'payment' as const, label: 'Payment & Bank', icon: Landmark },
  { id: 'branding' as const, label: 'Branding & Documents', icon: Palette },
  { id: 'integrations' as const, label: 'Integrations', icon: PlugZap },
];

function parseBankDetails(raw?: string): BankDetailsForm {
  const lines = (raw || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const pick = (prefix: string) => {
    const row = lines.find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()));
    return row ? row.slice(prefix.length).trim() : '';
  };
  return {
    bankName: pick('Bank Name:') || lines[0] || '',
    accountHolderName: pick('Account Holder:') || '',
    accountNumber: pick('A/C No:') || '',
    confirmAccountNumber: pick('A/C No:') || '',
    ifscCode: pick('IFSC Code:') || '',
    branch: pick('Branch:') || '',
    accountType: pick('Account Type:') || '',
    swiftCode: pick('SWIFT Code:') || '',
  };
}

function formatBankDetails(details: BankDetailsForm) {
  return [
    details.bankName ? `Bank Name: ${details.bankName}` : '',
    details.accountHolderName ? `Account Holder: ${details.accountHolderName}` : '',
    details.accountNumber ? `A/C No: ${details.accountNumber}` : '',
    details.ifscCode ? `IFSC Code: ${details.ifscCode}` : '',
    details.branch ? `Branch: ${details.branch}` : '',
    details.accountType ? `Account Type: ${details.accountType}` : '',
    details.swiftCode ? `SWIFT Code: ${details.swiftCode}` : '',
  ].filter(Boolean).join('\n');
}

function Field({ label, secondary, children, className = '' }: {
  label: string;
  secondary?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-semibold text-stone-800">
        {label}
        {secondary && <span className="ml-2 text-xs font-normal text-stone-500">{secondary}</span>}
      </label>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label, secondary }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  secondary?: string;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-800">{label}</span>
        {secondary && <span className="block text-xs text-stone-500">{secondary}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" />
    </label>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-bold text-stone-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function VisualAssetManager({ name, title, children }: {
  name: VisualAssetName;
  title: string;
  children: ReactNode;
}) {
  const asset = useVisualAsset(name);
  const [preview, setPreview] = useState(asset);
  const [status, setStatus] = useState('');

  useEffect(() => setPreview(asset), [asset]);

  const saveAction = async (action: () => Promise<void>, success: string) => {
    try {
      setStatus('Saving…');
      await action();
      setStatus(success);
    } catch (error) {
      setStatus((error as Error).message || 'Unable to save this image.');
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 p-4">
      <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="flex min-h-32 items-center justify-center rounded-xl bg-stone-50 p-3">
          {preview ? <img src={preview} alt={`${title} preview`} className="max-h-28 max-w-full object-contain" /> : <span className="text-center text-sm text-stone-500">No image</span>}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-stone-900">{title}</h3>
          <p className="mt-1 text-xs text-stone-500">Stored separately from your invoices and business records.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="inline-flex min-h-12 cursor-pointer items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">
              {preview ? 'Replace' : 'Upload'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                try {
                  setStatus('Processing…');
                  const dataUrl = await prepareDocumentAsset(file, name);
                  await saveVisualAsset(name, dataUrl);
                  setPreview(dataUrl);
                  setStatus('Saved');
                } catch (error) {
                  setStatus((error as Error).message || 'Unable to process this image.');
                }
              }} />
            </label>
            {preview && (
              <button type="button" onClick={() => saveAction(async () => {
                await removeVisualAsset(name);
                setPreview('');
              }, 'Removed')} className="min-h-12 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700">
                Remove
              </button>
            )}
            {preview !== DEFAULT_VISUAL_ASSETS[name] && (
              <button type="button" onClick={() => saveAction(async () => {
                await restoreDefaultVisualAsset(name);
                setPreview(DEFAULT_VISUAL_ASSETS[name]);
              }, 'Supplied default restored')} className="min-h-12 rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-700">
                Restore default
              </button>
            )}
          </div>
          {status && <p className="mt-2 text-sm text-stone-600" role="status">{status}</p>}
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">{children}</div>
    </div>
  );
}

function useDesktopSettingsLayout() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}

export default function Settings() {
  const { state, updateProfile, updateSettings } = useData();
  const { t, language, setLanguage } = useLanguage();
  const { availability, status: availabilityStatus } = useIntegrationAvailability();
  const desktop = useDesktopSettingsLayout();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('company');
  const [logoPreview, setLogoPreview] = useState(state.profile.logo || '');
  const [logoError, setLogoError] = useState('');
  const [qrPreview, setQrPreview] = useState(state.profile.qrCodeImage || '');
  const [qrError, setQrError] = useState('');
  const [bankDraft, setBankDraft] = useState<BankDetailsForm>(() => parseBankDetails(state.profile.bankDetails));
  const [bankStatus, setBankStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => setBankDraft(parseBankDetails(state.profile.bankDetails)), [state.profile.bankDetails]);

  const updateProfileField = (field: keyof typeof state.profile, value: string | boolean) => {
    updateProfile({ ...state.profile, [field]: value });
  };

  const updateTemplateVisibility = (field: keyof TemplateVisibilitySettings, value: boolean) => {
    updateSettings({
      template: {
        ...state.settings.template,
        visibility: { ...state.settings.template.visibility, [field]: value },
      },
    });
  };

  const saveBankDetails = () => {
    if (bankDraft.accountNumber && bankDraft.accountNumber !== bankDraft.confirmAccountNumber) {
      setBankStatus('error');
      return;
    }
    const normalized = Object.fromEntries(Object.entries(bankDraft).map(([key, value]) => [
      key,
      key === 'ifscCode' ? value.trim().toUpperCase() : value.trim(),
    ])) as BankDetailsForm;
    updateProfileField('bankDetails', formatBankDetails(normalized));
    setBankDraft(normalized);
    setBankStatus('saved');
  };

  const loadSimpleImage = (file: File | null, kind: 'logo' | 'qr') => {
    if (!file) return;
    const setError = kind === 'logo' ? setLogoError : setQrError;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Use a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 500 * 1024) {
      setError('Image must be smaller than 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setError('');
      if (kind === 'logo') {
        setLogoPreview(dataUrl);
        updateProfileField('logo', dataUrl);
      } else {
        setQrPreview(dataUrl);
        updateProfileField('qrCodeImage', dataUrl);
      }
    };
    reader.onerror = () => setError('Unable to read this image.');
    reader.readAsDataURL(file);
  };

  const companyContent = (
    <Panel title="Company Profile" description="Business information shown on documents and exports.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Business name" secondary="வணிக பெயர்" className="md:col-span-2">
          <input value={state.profile.name} onChange={(event) => updateProfileField('name', event.target.value)} className="settings-input" />
        </Field>
        <Field label="GSTIN" secondary="GST எண்">
          <input value={state.profile.gst} onChange={(event) => updateProfileField('gst', event.target.value.toUpperCase())} className="settings-input uppercase" />
        </Field>
        <Field label="MSME number">
          <input value={state.profile.msmeNumber || ''} onChange={(event) => updateProfileField('msmeNumber', event.target.value.toUpperCase())} className="settings-input uppercase" />
        </Field>
        <Field label="Address" secondary="முகவரி" className="md:col-span-2">
          <textarea rows={3} value={state.profile.address} onChange={(event) => updateProfileField('address', event.target.value)} className="settings-input" />
        </Field>
        <div className="md:col-span-2">
          <PinLookupField
            value={state.profile.pinCode || ''}
            enabled={availability.postal && state.settings.integrations.pinLookup}
            onChange={(value) => updateProfileField('pinCode', value)}
            onApply={(result) => updateProfileField('address', `${result.locality}, ${result.district}, ${result.state}`)}
          />
        </div>
        <Field label="Phone" secondary="தொலைபேசி">
          <input value={state.profile.phone} onChange={(event) => updateProfileField('phone', event.target.value)} className="settings-input" />
        </Field>
        <Field label="Email">
          <input type="email" value={state.profile.email} onChange={(event) => updateProfileField('email', event.target.value)} className="settings-input" />
        </Field>
        <Field label="State code">
          <input value={state.profile.stateCode || ''} onChange={(event) => {
            updateProfileField('stateCode', event.target.value);
            updateSettings({ businessStateCode: event.target.value });
          }} className="settings-input" />
        </Field>
        <Field label="App language">
          <select value={language} onChange={(event) => {
            const next = event.target.value as 'en' | 'ta';
            setLanguage(next);
            updateSettings({ language: next });
          }} className="settings-input">
            <option value="en">English</option>
            <option value="ta">தமிழ்</option>
          </select>
        </Field>
      </div>
    </Panel>
  );

  const paymentContent = (
    <div className="space-y-4">
      <Panel title="Bank Details" description="Optional payment information printed on documents.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Bank name"><input value={bankDraft.bankName} onChange={(event) => setBankDraft((current) => ({ ...current, bankName: event.target.value }))} className="settings-input" /></Field>
          <Field label="Account holder"><input value={bankDraft.accountHolderName} onChange={(event) => setBankDraft((current) => ({ ...current, accountHolderName: event.target.value }))} className="settings-input" /></Field>
          <Field label="Account number">
            <div className="relative">
              <input type={showAccount ? 'text' : 'password'} value={bankDraft.accountNumber} onChange={(event) => setBankDraft((current) => ({ ...current, accountNumber: event.target.value }))} className="settings-input pr-12" />
              <button type="button" onClick={() => setShowAccount((current) => !current)} className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center text-stone-500" aria-label={showAccount ? 'Hide account number' : 'Reveal account number'}>{showAccount ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </Field>
          <Field label="Confirm account number"><input type={showAccount ? 'text' : 'password'} value={bankDraft.confirmAccountNumber} onChange={(event) => setBankDraft((current) => ({ ...current, confirmAccountNumber: event.target.value }))} className="settings-input" /></Field>
          <Field label="IFSC"><input value={bankDraft.ifscCode} onChange={(event) => setBankDraft((current) => ({ ...current, ifscCode: event.target.value.toUpperCase() }))} className="settings-input uppercase" /></Field>
          <Field label="Branch"><input value={bankDraft.branch} onChange={(event) => setBankDraft((current) => ({ ...current, branch: event.target.value }))} className="settings-input" /></Field>
          <Field label="Account type"><input value={bankDraft.accountType} onChange={(event) => setBankDraft((current) => ({ ...current, accountType: event.target.value }))} className="settings-input" /></Field>
          <Field label="SWIFT code"><input value={bankDraft.swiftCode} onChange={(event) => setBankDraft((current) => ({ ...current, swiftCode: event.target.value }))} className="settings-input uppercase" /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveBankDetails} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white"><Save size={18} />Save bank details</button>
          <span className={`text-sm ${bankStatus === 'error' ? 'text-rose-700' : 'text-stone-500'}`}>{bankStatus === 'saved' ? 'Saved' : bankStatus === 'error' ? 'Account numbers do not match' : 'Changes save only when you press Save'}</span>
        </div>
      </Panel>

      <Panel title="UPI Payment" description="QR payment settings for invoices and quotations.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="UPI ID"><input value={state.profile.upiId || ''} onChange={(event) => updateProfileField('upiId', event.target.value.replace(/\s/g, '').toLowerCase())} className="settings-input" placeholder="business@bank" /></Field>
          <Field label="UPI payee name"><input value={state.profile.upiPayeeName || ''} onChange={(event) => updateProfileField('upiPayeeName', event.target.value)} className="settings-input" /></Field>
          <Field label="Default payment note" className="md:col-span-2"><input value={state.profile.upiPaymentNote || ''} onChange={(event) => updateProfileField('upiPaymentNote', event.target.value)} className="settings-input" /></Field>
          <Switch checked={Boolean(state.profile.enableUpiQr)} onChange={(checked) => {
            if (checked && !state.profile.upiPayeeName?.trim()) return;
            updateProfileField('enableUpiQr', checked);
          }} label="Enable UPI QR on documents" />
          <Switch checked={Boolean(state.profile.showUpiAmount)} onChange={(checked) => updateProfileField('showUpiAmount', checked)} label="Show payment amount in QR" />
          <Field label="Optional fixed payment QR" className="md:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => loadSimpleImage(event.target.files?.[0] || null, 'qr')} className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-200 p-2" />
              {qrPreview && <img src={qrPreview} alt="Payment QR preview" className="h-20 w-20 rounded-xl border object-contain p-1" />}
              {qrPreview && <button type="button" onClick={() => { setQrPreview(''); updateProfileField('qrCodeImage', ''); }} className="min-h-12 rounded-xl border border-rose-200 px-4 text-rose-700"><Trash2 size={18} /></button>}
            </div>
            {qrError && <p className="mt-2 text-sm text-rose-700">{qrError}</p>}
          </Field>
        </div>
        {state.profile.enableUpiQr && !state.profile.upiPayeeName?.trim() && <p className="mt-3 text-sm text-rose-700">Enter a payee name before enabling the UPI QR.</p>}
      </Panel>
    </div>
  );

  const brandingContent = (
    <div className="space-y-4">
      <Panel title="Logo & Document Header">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <Field label="Company logo">
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => loadSimpleImage(event.target.files?.[0] || null, 'logo')} className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-200 p-2" />
              {logoPreview && <button type="button" onClick={() => { setLogoPreview(''); updateProfileField('logo', ''); }} className="min-h-12 rounded-xl border border-rose-200 px-4 text-rose-700"><Trash2 size={18} /></button>}
            </div>
            {logoError && <p className="mt-2 text-sm text-rose-700">{logoError}</p>}
          </Field>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center gap-3">
              {logoPreview ? <img src={logoPreview} alt="Logo preview" className="h-14 w-14 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-xs text-stone-400">Logo</div>}
              <div className="min-w-0">
                <p className="truncate font-bold text-stone-900">{state.profile.name || 'Your Business'}</p>
                <p className="truncate text-xs text-stone-500">{state.profile.email || 'Business email'}</p>
                <p className="truncate text-xs text-stone-500">GSTIN: {state.profile.gst || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Authorization Assets" description="These are visual images, not legally certified digital signatures.">
        <div className="space-y-4">
          <VisualAssetManager name="signature" title="Authorized Signature">
            {(['invoice', 'quotation', 'deliveryNote'] as const).map((kind) => (
              <Switch key={kind} checked={state.settings.signatureVisibility[kind]} onChange={(checked) => updateSettings({ signatureVisibility: { ...state.settings.signatureVisibility, [kind]: checked } })} label={`Show on ${kind === 'deliveryNote' ? 'Delivery Note' : kind[0].toUpperCase() + kind.slice(1)}`} />
            ))}
          </VisualAssetManager>
          <VisualAssetManager name="seal" title="Company Seal / Stamp">
            {(['invoice', 'quotation', 'deliveryNote'] as const).map((kind) => (
              <Switch key={kind} checked={state.settings.sealVisibility?.[kind] !== false} onChange={(checked) => updateSettings({ sealVisibility: { ...state.settings.sealVisibility, [kind]: checked } })} label={`Show on ${kind === 'deliveryNote' ? 'Delivery Note' : kind[0].toUpperCase() + kind.slice(1)}`} />
            ))}
          </VisualAssetManager>
        </div>
      </Panel>

      <Panel title="Document Visibility" description="Choose which information appears on generated documents.">
        <div className="grid gap-2 md:grid-cols-2">
          {([
            ['logo', 'Logo'],
            ['gstNumber', 'GSTIN'],
            ['address', 'Address'],
            ['phoneEmail', 'Phone and email'],
            ['discountColumn', 'Discount'],
            ['hsnSac', 'HSN / SAC'],
            ['taxBreakdown', 'Tax breakdown'],
            ['signature', 'Signature area'],
            ['terms', 'Terms and conditions'],
            ['qrCode', 'QR code'],
            ['bankDetails', 'Bank details'],
          ] as [keyof TemplateVisibilitySettings, string][]).map(([key, label]) => (
            <Switch key={key} checked={state.settings.template.visibility[key]} onChange={(checked) => updateTemplateVisibility(key, checked)} label={label} />
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Default GST mode">
            <select value={state.settings.taxMode} onChange={(event) => updateSettings({ taxMode: event.target.value as 'exclusive' | 'inclusive' })} className="settings-input">
              <option value="exclusive">GST Exclusive</option>
              <option value="inclusive">GST Inclusive</option>
            </select>
          </Field>
          <Field label="Quotation terminology">
            <select value={state.settings.estimateDocumentLabel} onChange={(event) => updateSettings({ estimateDocumentLabel: event.target.value as 'estimate' | 'quotation' })} className="settings-input">
              <option value="estimate">Estimate</option>
              <option value="quotation">Quotation</option>
            </select>
          </Field>
        </div>
      </Panel>
    </div>
  );

  const integrations = [
    { key: 'serverEmail' as const, label: 'Server Email', configured: availability.email },
    { key: 'pinLookup' as const, label: 'PIN Code Lookup', configured: availability.postal },
    { key: 'authorizedSignature' as const, label: 'Authorized Signature', configured: true },
  ].filter((integration) => integration.configured);

  const integrationsContent = (
    <Panel title="Integrations" description="Only services available in this deployment are shown.">
      <div className="space-y-3">
        {integrations.length ? integrations.map((integration) => (
          <div key={integration.key} className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3">
            <div>
              <p className="font-semibold text-stone-900">{integration.label}</p>
              <p className="text-xs text-stone-500">{state.settings.integrations[integration.key] ? 'Configured and enabled' : 'Configured but disabled'}</p>
            </div>
            <input type="checkbox" checked={state.settings.integrations[integration.key]} onChange={(event) => updateSettings({ integrations: { ...state.settings.integrations, [integration.key]: event.target.checked } })} className="h-5 w-5" />
          </div>
        )) : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No external integrations are configured.</p>}
        {availability.email && state.settings.integrations.serverEmail && (
          <Switch checked={state.settings.emailCcBusiness} onChange={(checked) => updateSettings({ emailCcBusiness: checked })} label="CC business email" secondary="Include the company email when sending documents." />
        )}
        <details className="rounded-xl border border-stone-200">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 py-3 font-semibold text-stone-700">Advanced integrations <ChevronDown size={18} /></summary>
          <div className="border-t border-stone-100 p-4 text-sm text-stone-500">
            GST verification, barcode scanning, OCR import and AI quick actions are not configured and remain hidden from normal workflows.
          </div>
        </details>
        {availabilityStatus === 'error' && <p className="text-sm text-amber-700">Integration availability could not be refreshed. Core billing remains available.</p>}
      </div>
    </Panel>
  );

  const contentBySection: Record<SettingsSectionId, ReactNode> = {
    company: companyContent,
    payment: paymentContent,
    branding: brandingContent,
    integrations: integrationsContent,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div>
        <Link to="/" className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} />Back to Dashboard</Link>
        <h1 className="mt-2 text-2xl font-black text-stone-900">{t('settings')}</h1>
        <p className="mt-1 text-sm text-stone-500">Manage company, payment, branding and connected services.</p>
      </div>

      {desktop ? (
        <div className="grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-6">
          <nav className="sticky top-24 space-y-1 rounded-2xl border border-stone-200 bg-white p-2" aria-label="Settings sections">
            {sectionDefinitions.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveSection(id)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold ${activeSection === id ? 'bg-emerald-50 text-emerald-800' : 'text-stone-600 hover:bg-stone-50'}`} aria-current={activeSection === id ? 'page' : undefined}>
                <Icon size={20} />{label}
              </button>
            ))}
          </nav>
          <div>{contentBySection[activeSection]}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sectionDefinitions.map(({ id, label, icon: Icon }) => {
            const expanded = activeSection === id;
            return (
              <div key={id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <button type="button" onClick={() => setActiveSection(id)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-bold text-stone-800" aria-expanded={expanded}>
                  <Icon size={20} className="text-emerald-700" />
                  <span className="flex-1">{label}</span>
                  <ChevronDown size={20} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && <div className="border-t border-stone-100 bg-stone-50 p-3">{contentBySection[id]}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
