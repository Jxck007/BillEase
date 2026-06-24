import { ReactNode, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { InvoiceTemplateId, TemplateVisibilitySettings } from '../lib/types';
import { INVOICE_TEMPLATES, TEMPLATE_PRESETS } from '../templates/invoiceTemplates';
import { Trash2 } from 'lucide-react';

type BankDetailsForm = {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
};

function parseBankDetails(raw?: string): BankDetailsForm {
  const lines = (raw || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const pick = (prefix: string) => {
    const row = lines.find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()));
    return row ? row.slice(prefix.length).trim() : '';
  };
  return {
    bankName: pick('Bank Name:') || lines[0] || '',
    accountNumber: pick('A/C No:') || '',
    ifscCode: pick('IFSC Code:') || '',
    branch: pick('Branch:') || '',
  };
}

function formatBankDetails(details: BankDetailsForm) {
  return [
    details.bankName ? `Bank Name: ${details.bankName}` : '',
    details.accountNumber ? `A/C No: ${details.accountNumber}` : '',
    details.ifscCode ? `IFSC Code: ${details.ifscCode}` : '',
    details.branch ? `Branch: ${details.branch}` : '',
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
        <div className="font-semibold text-stone-800">{label}</div>
        <div className="text-xs text-stone-500">{tamil}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" />
    </label>
  );
}

export default function Settings() {
  const { state, updateProfile, updateSettings, firebaseStatus, uploadBackup, downloadBackup } = useData();
  const { t, language, setLanguage } = useLanguage();
  const [logoPreview, setLogoPreview] = useState(state.profile.logo);
  const [logoError, setLogoError] = useState('');
  const [qrPreview, setQrPreview] = useState(state.profile.qrCodeImage || '');
  const [qrError, setQrError] = useState('');

  const visibility = state.settings.template.visibility;
  const selectedTemplateName = useMemo(() => INVOICE_TEMPLATES.find((item) => item.id === (state.settings.defaultTemplate as InvoiceTemplateId)), [state.settings.defaultTemplate]);
  const bankDetails = useMemo(() => parseBankDetails(state.profile.bankDetails), [state.profile.bankDetails]);

  const updateProfileField = (field: 'name' | 'address' | 'phone' | 'email' | 'gst' | 'logo' | 'qrCodeImage' | 'stateCode' | 'tagline' | 'bankDetails' | 'msmeNumber', value: string) => {
    updateProfile({ ...state.profile, [field]: value });
  };
  const updateBankDetailsField = (field: keyof BankDetailsForm, value: string) => {
    updateProfileField('bankDetails', formatBankDetails({ ...bankDetails, [field]: value }));
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

  const selectTemplate = (templateId: InvoiceTemplateId) => {
    updateSettings({
      defaultTemplate: templateId,
      template: {
        templateId,
        ...TEMPLATE_PRESETS[templateId],
      } as never,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-stone-800">{t('settings')}</h1>
        <p className="mt-1 text-stone-500">{language === 'en' ? 'Manage your business profile, GST defaults, templates, and app language.' : 'வணிக விவரங்கள், GST defaults, டெம்ப்ளேட், மொழி ஆகியவற்றை மாற்றவும்.'}</p>
      </div>

      <Section title={language === 'en' ? 'Firebase Status' : 'Firebase நிலை'} subtitle={language === 'en' ? 'Deployment and local-mode connectivity overview.' : 'டிப்ளாய்மென்ட் மற்றும் local-mode இணைப்பு நிலை.'}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={`rounded-2xl border px-4 py-3 ${firebaseStatus.appConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="text-xs font-bold uppercase tracking-widest">App</div>
            <div className="mt-1 font-semibold">{firebaseStatus.appConnected ? 'Connected' : 'Not connected'}</div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${firebaseStatus.firestoreConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="text-xs font-bold uppercase tracking-widest">Firestore</div>
            <div className="mt-1 font-semibold">{firebaseStatus.firestoreConnected ? 'Connected' : 'Not connected'}</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
          <div className="font-semibold text-stone-800">{language === 'en' ? 'Missing variables' : 'Missing variables'}</div>
          <div className="mt-1 break-words">
            {firebaseStatus.missingVariables.length > 0 ? firebaseStatus.missingVariables.join(', ') : (language === 'en' ? 'None' : 'None')}
          </div>
        </div>
      </Section>

      <Section title="Data Management" subtitle="Backup, restore, and sync your business data.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button 
            type="button" 
            onClick={async () => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", "billease_backup.json");
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
            }}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700 hover:bg-stone-50 text-left"
          >
            Export Backup (Download File)
          </button>
          
          <label className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer text-left">
            Import Backup (Upload File)
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const importedState = JSON.parse(event.target?.result as string);
                    localStorage.setItem('appData', JSON.stringify(importedState));
                    window.location.reload();
                  } catch (err) {
                    alert('Invalid backup file');
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
                alert('Force Upload To Cloud Successful');
              } catch (err) {
                alert('Upload Failed');
              }
            }}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800 hover:bg-emerald-100 text-left"
          >
            Force Upload To Cloud
          </button>

          <button 
            type="button" 
            onClick={async () => {
              try {
                await downloadBackup();
                alert('Force Download From Cloud Successful');
                window.location.reload();
              } catch (err) {
                alert('Download Failed');
              }
            }}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-800 hover:bg-amber-100 text-left"
          >
            Force Download From Cloud
          </button>
        </div>
      </Section>          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
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
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-stone-800">{language === 'en' ? 'Bank details (for print/export)' : '????? ????????? (print/export)'}</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    value={bankDetails.bankName}
                    onChange={(event) => updateBankDetailsField('bankName', event.target.value)}
                    title={language === 'en' ? 'Bank name' : '????? ?????'}
                    placeholder={language === 'en' ? 'Bank name' : '????? ?????'}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    value={bankDetails.accountNumber}
                    onChange={(event) => updateBankDetailsField('accountNumber', event.target.value)}
                    title={language === 'en' ? 'Account number' : '?????? ???'}
                    placeholder={language === 'en' ? 'A/C No' : '?????? ???'}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    value={bankDetails.ifscCode}
                    onChange={(event) => updateBankDetailsField('ifscCode', event.target.value.toUpperCase())}
                    title="IFSC Code"
                    placeholder="IFSC Code"
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    value={bankDetails.branch}
                    onChange={(event) => updateBankDetailsField('branch', event.target.value)}
                    title={language === 'en' ? 'Branch' : '????'}
                    placeholder={language === 'en' ? 'Branch' : '????'}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
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

          <Section title={language === 'en' ? 'Template Engine' : 'டெம்ப்ளேட் அமைப்பு'} subtitle={language === 'en' ? 'Choose the default invoice layout and field visibility.' : 'Default layout மற்றும் எந்த field காட்டவேண்டும் என்பதை தேர்வு செய்யவும்.'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {INVOICE_TEMPLATES.map((templateOption) => {
                const isActive = state.settings.defaultTemplate === templateOption.id;
                return (
                  <button key={templateOption.id} type="button" onClick={() => selectTemplate(templateOption.id)} className={`rounded-2xl border p-4 text-left ${isActive ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white'}`}>
                    <div className="font-semibold text-stone-800">{templateOption.title}</div>
                    <div className="text-xs text-stone-500 mt-1">{templateOption.tamil}</div>
                  </button>
                );
              })}
            </div>

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
                <div className="text-xs text-stone-500">{selectedTemplateName?.title || state.settings.defaultTemplate}</div>
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

