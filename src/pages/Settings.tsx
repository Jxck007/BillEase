import { ReactNode, useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { TemplateVisibilitySettings } from '../lib/types';
import { ArrowLeft, Eye, EyeOff, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { removeVisualAsset, saveVisualAsset, useVisualAsset } from '../lib/firebase';
import { getCloudBackupRecordCounts, getRecordTotal } from '../lib/firebase';
import { prepareSignatureImage } from '../utils/imageAssets';
import { useIntegrationAvailability } from '../hooks/useIntegrationAvailability';
import PinLookupField from '../components/forms/PinLookupField';

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

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 p-5">
        <h2 className="text-lg font-bold text-stone-800">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, tamil }: { checked: boolean; onChange: (value: boolean) => void; label: string; tamil: string }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
      <div>
        <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> Back to Dashboard</Link>
        <div className="font-semibold text-stone-800">{label}</div>
        <div className="text-xs text-stone-500">{tamil}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" />
    </label>
  );
}

export default function Settings() {
  const { state, updateProfile, updateSettings } = useData();
  // Kept only while legacy settings markup is compiled; it is never rendered.
  const backupReminderNeeded = false;
  const lastBackupExportAt: string | null = null;
  const lastSavedAt: string | null = null;
  const syncStatus = (false ? 'online' : 'offline') as 'online' | 'syncing' | 'offline' | 'failed' | 'loading';
  const { t, language, setLanguage } = useLanguage();
  const [logoPreview, setLogoPreview] = useState(state.profile.logo);
  const [logoError, setLogoError] = useState('');
  const [qrPreview, setQrPreview] = useState(state.profile.qrCodeImage || '');
  const [qrError, setQrError] = useState('');
  const signature = useVisualAsset('signature');
  const [signaturePreview, setSignaturePreview] = useState(signature);
  const [signatureStatus, setSignatureStatus] = useState('');
  const { availability, status: integrationStatus } = useIntegrationAvailability();

  const visibility = state.settings.template.visibility;
  const [bankDraft, setBankDraft] = useState<BankDetailsForm>(() => parseBankDetails(state.profile.bankDetails));
  const [bankStatus, setBankStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => { setBankDraft(parseBankDetails(state.profile.bankDetails)); }, [state.profile.bankDetails]);
  useEffect(() => { if (signature) setSignaturePreview(signature); }, [signature]);

  const updateProfileField = (field: 'name' | 'address' | 'pinCode' | 'phone' | 'email' | 'gst' | 'logo' | 'qrCodeImage' | 'stateCode' | 'tagline' | 'bankDetails' | 'msmeNumber' | 'upiId' | 'upiPayeeName' | 'upiPaymentNote' | 'paymentQrImage', value: string) => {
    updateProfile({ ...state.profile, [field]: value });
  };
  const saveBankDetails = () => {
    if (bankDraft.accountNumber && bankDraft.accountNumber !== bankDraft.confirmAccountNumber) { setBankStatus('error'); return; }
    setBankStatus('saving');
    const normalized = Object.fromEntries(Object.entries(bankDraft).map(([key, value]) => [key, key === 'ifscCode' ? value.trim().toUpperCase() : value.trim()])) as BankDetailsForm;
    updateProfileField('bankDetails', formatBankDetails(normalized));
    setBankDraft(normalized);
    setBankStatus('saved');
  };

  const handleLogoUpload = (file: File | null) => {
    if (!file) return;
    
    // Validate file size (max 500KB to prevent localStorage overflow)
    const maxSize = 500 * 1024; // 500KB
    if (file.size > maxSize) {
      setLogoError(language === 'en' ? 'File too large. Max 500KB.' : 'கோப்பு மிக பெரியது. அதிகபட்சம் 500KB.');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setLogoError(language === 'en' ? 'Please upload an image file.' : 'ஒரு படம் upload செய்யவும்.');
      return;
    }

    setLogoError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const logo = String(reader.result || '');
        setLogoPreview(logo);
        updateProfileField('logo', logo);
      } catch (err) {
        setLogoError(language === 'en' ? 'Error uploading logo.' : 'லோகோ uploadல் பிழை.');
      }
    };
    reader.onerror = () => {
      setLogoError(language === 'en' ? 'Error reading file.' : 'கோப்பை படிக்க பிழை.');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = () => {
    setLogoPreview('');
    setLogoError('');
    updateProfileField('logo', '');
  };

  const handleQrUpload = (file: File | null) => {
    if (!file) return;

    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
      setQrError(language === 'en' ? 'QR file too large. Max 500KB.' : 'QR கோப்பு மிக பெரியது. அதிகபட்சம் 500KB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setQrError(language === 'en' ? 'Please upload a QR image file.' : 'QR படம் upload செய்யவும்.');
      return;
    }

    setQrError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const qrImage = String(reader.result || '');
        setQrPreview(qrImage);
        updateProfileField('qrCodeImage', qrImage);
      } catch {
        setQrError(language === 'en' ? 'Error uploading QR image.' : 'QR படம் uploadல் பிழை.');
      }
    };
    reader.onerror = () => {
      setQrError(language === 'en' ? 'Error reading QR file.' : 'QR கோப்பை படிக்க பிழை.');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteQr = () => {
    setQrPreview('');
    setQrError('');
    updateProfileField('qrCodeImage', '');
  };

  const updateTemplateVisibility = (field: keyof TemplateVisibilitySettings, value: boolean) => {
    updateSettings({
      template: {
        visibility: {
          ...state.settings.template.visibility,
          [field]: value,
        },
      } as never,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-stone-800">{t('settings')}</h1>
        <p className="mt-1 text-stone-500">{language === 'en' ? 'Manage your business profile, GST defaults, templates, and app language.' : 'வணிக விவரங்கள், GST defaults, டெம்ப்ளேட், மொழி ஆகியவற்றை மாற்றவும்.'}</p>
      </div>

      {/* Sync safety runs automatically in the background; no cloud overwrite controls are exposed here. */}
      {false && <Section title="Data Management" subtitle="Backup, restore, and sync your business data.">
        {/* Backup reminder */}
        <div className={`mb-4 rounded-2xl p-4 text-sm ${backupReminderNeeded ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <div className="font-bold">💾 Backup Reminder</div>
          <p className="mt-1 text-xs">
            {backupReminderNeeded
              ? (language === 'en'
                ? 'Please export a fresh JSON backup. Keep a copy on your phone or computer.'
                : 'புதிய JSON backup எடுத்து வைத்துக்கொள்ளுங்கள்.')
              : (language === 'en'
                ? 'Backup recently exported. Keep that file in a safe place.'
                : 'சமீபத்தில் backup எடுக்கப்பட்டது. அதை பாதுகாப்பாக வைத்துக்கொள்ளுங்கள்.')}
          </p>
          <p className="mt-2 text-xs">
            {language === 'en' ? 'Last backup export:' : 'கடைசி backup export:'} {lastBackupExportAt ? new Date(lastBackupExportAt).toLocaleString() : (language === 'en' ? 'Not yet exported' : 'இன்னும் எடுக்கவில்லை')}
          </p>
          <p className="mt-1 text-xs">
            {language === 'en' ? 'Last saved:' : 'கடைசியாக சேமித்தது:'} {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : '-'} · {syncStatus === 'online' ? 'Saved' : syncStatus === 'syncing' ? 'Saving' : syncStatus === 'failed' ? 'Cloud sync failed' : syncStatus === 'offline' ? 'Offline' : 'Loading'}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span>Current records:</span>
            <span className="font-semibold">{state.customers.length} customers</span>
            <span className="text-stone-500">·</span>
            <span className="font-semibold">{state.products.length} products</span>
            <span className="text-stone-500">·</span>
            <span className="font-semibold">{state.invoices.length} invoices</span>
            <span className="text-stone-500">·</span>
            <span className="font-semibold">{state.deliveryNotes.length} DNs</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button 
            type="button" 
            onClick={async () => {
              exportBackupJson();
            }}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700 hover:bg-stone-50 text-left"
          >
            💾 Export Backup (Download JSON)
          </button>
          
          <label className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer text-left">
            📂 Import Backup (Upload JSON)
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  try {
                    if (!legacyConfirm(language === 'en' ? 'This will replace ALL current data with the backup. Continue?' : 'இது தற்போதைய தரவு அனைத்தையும் மாற்றும். தொடரவா?')) return;
                    await importBackupJson(file);
                    window.location.reload();
                  } catch (err) {
                    legacyNotice(language === 'en' ? 'Invalid backup file.' : 'தவறான backup கோப்பு.');
                  }
                };
                reader.readAsText(file);
              }} 
            />
          </label>

          <button 
            type="button" 
            onClick={async () => {
              try {
                await uploadBackup();
                legacyNotice(language === 'en' ? 'Cloud upload successful.' : 'Cloud upload வெற்றி.');
              } catch (err) {
                if ((err as Error).message === 'EMPTY_OVERWRITE_BLOCKED') {
                  const cloudCounts = await getCloudBackupRecordCounts();
                  const warning = language === 'en'
                    ? `Cloud already has ${getRecordTotal(cloudCounts)} records. Current local data is empty. Uploading now could erase cloud data. Continue only if you are sure.`
                    : 'Cloud-ல் ஏற்கனவே data உள்ளது. இப்போது upload செய்தால் அதை நீக்கலாம். உறுதியாக இருந்தால் மட்டுமே தொடரவும்.';
                  if (legacyConfirm(warning)) {
                    await uploadBackup(true);
                    legacyNotice(language === 'en' ? 'Cloud upload successful.' : 'Cloud upload வெற்றி.');
                  }
                } else {
                  legacyNotice(language === 'en' ? 'Upload failed.' : 'Upload தோல்வி.');
                }
              }
            }}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800 hover:bg-emerald-100 text-left"
          >
            ☁️ Force Upload To Cloud
          </button>

          <button 
            type="button" 
            onClick={async () => {
              try {
                await downloadBackup();
                legacyNotice(language === 'en' ? 'Cloud download successful. Reloading...' : 'Cloud download வெற்றி.');
                window.location.reload();
              } catch (err) {
                legacyNotice(language === 'en' ? 'Download failed.' : 'Download தோல்வி.');
              }
            }}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-800 hover:bg-amber-100 text-left"
          >
            ☁️ Force Download From Cloud
          </button>
        </div>
      </Section>}          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6">
          <Section title={language === 'en' ? 'App Preferences' : 'செயலி விருப்பங்கள்'} subtitle={language === 'en' ? 'Switch the app language instantly.' : 'மொழியை உடனே மாற்றலாம்.'}>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setLanguage('en'); updateSettings({ language: 'en' }); }} className={`rounded-2xl border px-4 py-3 font-semibold ${language === 'en' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-white text-stone-700'}`}>English</button>
              <button type="button" onClick={() => { setLanguage('ta'); updateSettings({ language: 'ta' }); }} className={`rounded-2xl border px-4 py-3 font-semibold ${language === 'ta' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-white text-stone-700'}`}>தமிழ்</button>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'GST mode' : 'GST முறை'}</label>
                <select value={state.settings.taxMode} onChange={(event) => updateSettings({ taxMode: event.target.value as 'exclusive' | 'inclusive' })} title={language === 'en' ? 'GST mode' : 'GST முறை'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="exclusive">GST Exclusive</option>
                  <option value="inclusive">GST Inclusive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'Business state code' : 'வணிக மாநில code'}</label>
                <input value={state.settings.businessStateCode} onChange={(event) => updateSettings({ businessStateCode: event.target.value })} placeholder={language === 'en' ? '33' : '33'} title={language === 'en' ? 'Business state code' : 'வணிக மாநில code'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'Estimate / Quotation terminology' : 'மதிப்பீடு / Quotation பெயர்'}</label>
                <select
                  value={state.settings.estimateDocumentLabel || 'estimate'}
                  onChange={(event) => updateSettings({ estimateDocumentLabel: event.target.value as 'estimate' | 'quotation' })}
                  title={language === 'en' ? 'Estimate / Quotation terminology' : 'மதிப்பீடு / Quotation பெயர்'}
                  className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="estimate">{language === 'en' ? 'Estimate' : 'மதிப்பீடு (Estimate)'}</option>
                  <option value="quotation">{language === 'en' ? 'Quotation' : 'மதிப்பீடு (Quotation)'}</option>
                </select>
                <p className="mt-2 text-xs text-stone-500">{language === 'en' ? 'Controls navigation labels and the document title on generated estimates.' : 'உருவாக்கப்படும் estimate ஆவணத்தின் தலைப்பையும் menu பெயரையும் மாற்றும்.'}</p>
              </div>
            </div>
          </Section>

          <Section title="Payment Details" subtitle="Optional UPI payment information for invoices and quotations.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className="mb-1 block text-sm font-semibold text-stone-800">UPI ID</label><input value={state.profile.upiId ?? ''} onChange={(event) => updateProfileField('upiId', event.target.value.trim().toLowerCase())} placeholder="business@bank" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <div><label className="mb-1 block text-sm font-semibold text-stone-800">UPI payee / business name</label><input value={state.profile.upiPayeeName ?? ''} onChange={(event) => updateProfileField('upiPayeeName', event.target.value)} placeholder="Business name" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <div className="md:col-span-2"><label className="mb-1 block text-sm font-semibold text-stone-800">Default payment note</label><input value={state.profile.upiPaymentNote ?? ''} onChange={(event) => updateProfileField('upiPaymentNote', event.target.value)} placeholder="Thank you for your payment" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
              <Toggle checked={Boolean(state.profile.enableUpiQr)} onChange={(value) => { if (value && !state.profile.upiPayeeName?.trim()) return; updateProfile({ ...state.profile, enableUpiQr: value }); }} label="Enable UPI QR on documents" tamil="UPI QR" />
              <Toggle checked={Boolean(state.profile.showUpiAmount)} onChange={(value) => updateProfile({ ...state.profile, showUpiAmount: value })} label="Show payment amount in QR" tamil="தொகை" />
            </div>
            {state.profile.enableUpiQr && !state.profile.upiPayeeName?.trim() && <p className="mt-3 text-sm text-rose-700">Enter a payee name before enabling a UPI QR.</p>}
          </Section>

          <Section title={language === 'en' ? 'Business Profile' : 'வணிக விவரங்கள்'} subtitle={language === 'en' ? 'These details appear on invoices and exports.' : 'இந்த விவரங்கள் invoice-ல் காட்டப்படும்.'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'Business name' : 'வணிக பெயர்'}</label>
                <input value={state.profile.name} onChange={(event) => updateProfileField('name', event.target.value)} placeholder={language === 'en' ? 'Business name' : 'வணிக பெயர்'} title={language === 'en' ? 'Business name' : 'வணிக பெயர்'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'Tagline' : 'சிறு விளக்கம்'}</label>
                <input value={state.profile.tagline || ''} onChange={(event) => updateProfileField('tagline', event.target.value)} placeholder={language === 'en' ? 'Tagline' : 'சிறு விளக்கம்'} title={language === 'en' ? 'Tagline' : 'சிறு விளக்கம்'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-stone-800">{t('address')}</label>
                <textarea value={state.profile.address} onChange={(event) => updateProfileField('address', event.target.value)} rows={3} title={t('address')} placeholder={t('address')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2"><PinLookupField value={state.profile.pinCode ?? ''} enabled={availability.postal && state.settings.integrations.pinLookup} onChange={(value) => updateProfileField('pinCode', value)} onApply={(result) => updateProfileField('address', `${result.locality}, ${result.district}, ${result.state}`)} /></div>
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3"><label className="block text-sm font-semibold text-stone-800">Bank details (for print/export)</label><span className={`text-xs ${bankStatus === 'error' ? 'text-rose-700' : 'text-stone-500'}`}>{bankStatus === 'saving' ? 'Saving…' : bankStatus === 'saved' ? 'Saved' : bankStatus === 'error' ? 'Account numbers do not match' : 'Saved only when you choose Save'}</span></div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    value={bankDraft.bankName ?? ''}
                    onChange={(event) => setBankDraft((draft) => ({ ...draft, bankName: event.target.value }))}
                    title={language === 'en' ? 'Bank name' : '????? ?????'}
                    placeholder={language === 'en' ? 'Bank name' : '????? ?????'}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    value={bankDraft.accountHolderName ?? ''}
                    onChange={(event) => setBankDraft((draft) => ({ ...draft, accountHolderName: event.target.value }))}
                    placeholder="Account holder name"
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="relative"><input
                    value={bankDraft.accountNumber ?? ''}
                    onChange={(event) => setBankDraft((draft) => ({ ...draft, accountNumber: event.target.value }))}
                    type={showAccount ? 'text' : 'password'}
                    title={language === 'en' ? 'Account number' : '?????? ???'}
                    placeholder={language === 'en' ? 'A/C No' : '?????? ???'}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  /><button type="button" onClick={() => setShowAccount((show) => !show)} className="absolute inset-y-0 right-2 px-3 text-stone-500" aria-label={showAccount ? 'Hide account number' : 'Reveal account number'}>{showAccount ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                  <input value={bankDraft.confirmAccountNumber ?? ''} onChange={(event) => setBankDraft((draft) => ({ ...draft, confirmAccountNumber: event.target.value }))} type={showAccount ? 'text' : 'password'} placeholder="Confirm account number" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                  <input
                    value={bankDraft.ifscCode ?? ''}
                    onChange={(event) => setBankDraft((draft) => ({ ...draft, ifscCode: event.target.value.toUpperCase() }))}
                    title="IFSC Code"
                    placeholder="IFSC Code"
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    value={bankDraft.branch ?? ''}
                    onChange={(event) => setBankDraft((draft) => ({ ...draft, branch: event.target.value }))}
                    title={language === 'en' ? 'Branch' : '????'}
                    placeholder={language === 'en' ? 'Branch' : '????'}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input value={bankDraft.accountType ?? ''} onChange={(event) => setBankDraft((draft) => ({ ...draft, accountType: event.target.value }))} placeholder="Account type (optional)" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                  <input value={bankDraft.swiftCode ?? ''} onChange={(event) => setBankDraft((draft) => ({ ...draft, swiftCode: event.target.value }))} placeholder="SWIFT code (optional)" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <button type="button" onClick={saveBankDetails} className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white"><Save size={18} />Save bank details</button>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{t('phone')}</label>
                <input value={state.profile.phone} onChange={(event) => updateProfileField('phone', event.target.value)} placeholder={t('phone')} title={t('phone')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{t('email')}</label>
                <input value={state.profile.email} onChange={(event) => updateProfileField('email', event.target.value)} placeholder={t('email')} title={t('email')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{t('gstNumber')}</label>
                <input value={state.profile.gst} onChange={(event) => updateProfileField('gst', event.target.value.toUpperCase())} placeholder={t('gstNumber')} title={t('gstNumber')} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">MSME No</label>
                <input value={state.profile.msmeNumber || ''} onChange={(event) => updateProfileField('msmeNumber', event.target.value.toUpperCase())} placeholder="UDYAM-XX-0000000" title="MSME Number" className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'State code' : 'மாநில code'}</label>
                <input value={state.profile.stateCode || ''} onChange={(event) => updateProfileField('stateCode', event.target.value)} placeholder={language === 'en' ? '33' : '33'} title={language === 'en' ? 'State code' : 'மாநில code'} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'Logo upload' : 'லோகோ upload'}</label>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={(event) => handleLogoUpload(event.target.files?.[0] || null)} title={language === 'en' ? 'Logo upload' : 'லோகோ upload'} className="flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none" />
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleDeleteLogo}
                      className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                      title={language === 'en' ? 'Delete logo' : 'லோகோ நீக்கு'}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                {logoPreview && <p className="mt-2 text-xs text-emerald-700">Logo uploaded</p>}
                {logoError && <p className="mt-2 text-sm text-red-600">{logoError}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'QR image upload' : 'QR படம் upload'}</label>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={(event) => handleQrUpload(event.target.files?.[0] || null)} title={language === 'en' ? 'QR image upload' : 'QR படம் upload'} className="flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none" />
                  {qrPreview && (
                    <button
                      type="button"
                      onClick={handleDeleteQr}
                      className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                      title={language === 'en' ? 'Delete QR image' : 'QR படம் நீக்கு'}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                {qrPreview && <p className="mt-2 text-xs text-emerald-700">QR image uploaded</p>}
                {qrError && <p className="mt-2 text-sm text-red-600">{qrError}</p>}
              </div>
            </div>
          </Section>

          <Section title="Authorized Signature Image" subtitle="A visual signature for document output; this is not a certified digital signature.">
            <div className="space-y-4">{signaturePreview ? <img src={signaturePreview} alt="Authorized signature preview" className="h-24 max-w-full rounded-xl border bg-white object-contain p-2" /> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No signature image uploaded.</p>}<div className="flex flex-wrap gap-2"><label className="inline-flex min-h-12 cursor-pointer items-center rounded-xl bg-emerald-600 px-4 font-semibold text-white">{signaturePreview ? 'Replace' : 'Upload'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setSignatureStatus('Processing…'); const dataUrl = await prepareSignatureImage(file); await saveVisualAsset('signature', dataUrl); setSignaturePreview(dataUrl); setSignatureStatus('Saved'); } catch (error) { setSignatureStatus((error as Error).message); } }} /></label>{signaturePreview && <button type="button" onClick={async () => { await removeVisualAsset('signature'); setSignaturePreview(''); setSignatureStatus('Removed'); }} className="min-h-12 rounded-xl border border-rose-200 px-4 font-semibold text-rose-700">Remove</button>}</div>{signatureStatus && <p className="text-sm text-stone-600">{signatureStatus}</p>}<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(['invoice', 'quotation', 'deliveryNote'] as const).map((kind) => <Toggle key={kind} checked={state.settings.signatureVisibility[kind]} onChange={(checked) => updateSettings({ signatureVisibility: { ...state.settings.signatureVisibility, [kind]: checked } })} label={`Show on ${kind === 'deliveryNote' ? 'Delivery Note' : kind[0].toUpperCase() + kind.slice(1)}`} tamil="Authorized Signature" />)}</div></div>
          </Section>

          <Section title="Integrations" subtitle="Unavailable services cannot be enabled. Deferred features remain disabled.">
            <div className="space-y-3">{([['serverEmail', 'Server Email', availability.email], ['pinLookup', 'PIN Code Lookup', availability.postal], ['authorizedSignature', 'Authorized Signature', true]] as const).map(([key, label, configured]) => <div key={key} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">{label}</p><p className="text-xs text-stone-500">{integrationStatus === 'error' && key !== 'authorizedSignature' ? 'Error' : configured ? (state.settings.integrations[key] ? 'Configured' : 'Disabled') : 'Not configured'}</p></div><input type="checkbox" disabled={!configured} checked={configured && state.settings.integrations[key]} onChange={(event) => updateSettings({ integrations: { ...state.settings.integrations, [key]: event.target.checked } })} className="h-5 w-5" /></div>)}<label className="flex min-h-14 items-center justify-between rounded-xl border p-3"><span><b>CC business email</b><small className="block text-stone-500">Used by server email when enabled</small></span><input type="checkbox" checked={state.settings.emailCcBusiness} onChange={(event) => updateSettings({ emailCcBusiness: event.target.checked })} className="h-5 w-5" /></label>{['GST Verification', 'Barcode Scanner', 'OCR Import', 'AI Quick Actions', 'Automatic WhatsApp bot'].map((label) => <div key={label} className="flex min-h-14 items-center justify-between rounded-xl border bg-stone-50 p-3 text-stone-500"><span className="font-semibold">{label}</span><span className="text-xs">Future work · Disabled</span></div>)}</div>
          </Section>

          <Section title={language === 'en' ? 'Tax Invoice fields' : 'வரி பில் விவரங்கள்'} subtitle={language === 'en' ? 'BillEase uses one consistent Tax Invoice layout.' : 'BillEase ஒரே Tax Invoice layout-ஐ பயன்படுத்துகிறது.'}>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Toggle checked={visibility.logo} onChange={(value) => updateTemplateVisibility('logo', value)} label="Logo" tamil="லோகோ" />
              <Toggle checked={visibility.gstNumber} onChange={(value) => updateTemplateVisibility('gstNumber', value)} label={t('gstNumber')} tamil="GST எண்" />
              <Toggle checked={visibility.address} onChange={(value) => updateTemplateVisibility('address', value)} label={t('address')} tamil="முகவரி" />
              <Toggle checked={visibility.phoneEmail} onChange={(value) => updateTemplateVisibility('phoneEmail', value)} label={language === 'en' ? 'Phone / Email' : 'போன் / இமெயில்'} tamil="போன் / இமெயில்" />
              <Toggle checked={visibility.discountColumn} onChange={(value) => updateTemplateVisibility('discountColumn', value)} label={t('discount')} tamil="தள்ளுபடி" />
              <Toggle checked={visibility.hsnSac} onChange={(value) => updateTemplateVisibility('hsnSac', value)} label={language === 'en' ? 'HSN / SAC' : 'HSN / SAC'} tamil="HSN / SAC" />
              <Toggle checked={visibility.taxBreakdown} onChange={(value) => updateTemplateVisibility('taxBreakdown', value)} label={language === 'en' ? 'Tax breakdown' : 'வரி பிரிவு'} tamil="வரி பிரிவு" />
              <Toggle checked={visibility.signature} onChange={(value) => updateTemplateVisibility('signature', value)} label={language === 'en' ? 'Signature' : 'கையொப்பம்'} tamil="கையொப்பம்" />
              <Toggle checked={visibility.terms} onChange={(value) => updateTemplateVisibility('terms', value)} label={language === 'en' ? 'Terms & conditions' : 'விதிமுறைகள்'} tamil="விதிமுறைகள்" />
              <Toggle checked={visibility.qrCode} onChange={(value) => updateTemplateVisibility('qrCode', value)} label="QR code" tamil="QR குறியீடு" />
              <Toggle checked={visibility.bankDetails} onChange={(value) => updateTemplateVisibility('bankDetails', value)} label={language === 'en' ? 'Bank details' : 'வங்கி விவரம்'} tamil="வங்கி விவரம்" />
            </div>
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title={language === 'en' ? 'Quick Preview' : 'விரைவு preview'} subtitle={language === 'en' ? 'What your invoice header will feel like.' : 'உங்கள் invoice எப்படி இருக்கும் என்பது.'}>
            <div className="space-y-3 rounded-3xl border border-stone-200 bg-stone-50 p-4">
              {logoPreview ? <img src={logoPreview} alt="logo preview" className="mx-auto h-20 w-20 rounded-2xl object-cover" /> : <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-stone-400">Logo</div>}
              {qrPreview ? <img src={qrPreview} alt="qr preview" className="mx-auto h-20 w-20 rounded-xl border border-stone-200 bg-white object-contain p-1" /> : null}
              <div className="text-center">
                <div className="font-bold text-stone-800">{state.profile.name || 'Your Business'}</div>
                <div className="text-xs text-stone-500">Tax Invoice</div>
              </div>
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-3 text-xs text-stone-500">
                {language === 'en' ? 'This screen updates the billing defaults immediately.' : 'இந்த screen billing defaults-ஐ உடனே மாற்றும்.'}
              </div>
            </div>
          </Section>

          <Section title={language === 'en' ? 'Settings Snapshot' : 'அமைப்புகள் snapshot'}>
            <div className="space-y-3 text-sm text-stone-600">
              <div className="flex justify-between"><span>{language === 'en' ? 'Language' : 'மொழி'}</span><span className="font-semibold text-stone-800">{state.settings.language.toUpperCase()}</span></div>
              <div className="flex justify-between"><span>{language === 'en' ? 'GST mode' : 'GST mode'}</span><span className="font-semibold text-stone-800">{state.settings.taxMode}</span></div>
              <div className="flex justify-between"><span>{language === 'en' ? 'Default template' : 'Default template'}</span><span className="font-semibold text-stone-800">{state.settings.defaultTemplate}</span></div>
              <div className="flex justify-between"><span>{language === 'en' ? 'Business state' : 'Business state'}</span><span className="font-semibold text-stone-800">{state.settings.businessStateCode || '-'}</span></div>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
  // Legacy backup callbacks remain inert because their former UI is not rendered.
  const exportBackupJson = () => undefined;
  const importBackupJson = async (_file: File) => undefined;
  const uploadBackup = async (_force?: boolean) => undefined;
  const downloadBackup = async () => undefined;
  const legacyConfirm = (_message: string) => false;
  const legacyNotice = (_message: string) => undefined;
