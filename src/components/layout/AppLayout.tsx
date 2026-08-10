import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import FloatingHelp from './FloatingHelp';
import { useData } from '../../context/DataContext';
import MobileBottomNavigation from './MobileBottomNavigation';
import { useCallback, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useHelp } from '../../context/HelpContext';
import Modal from '../ui/Modal';
import type { SyncDetails } from '../../context/DataContext';
import { syncPresentationState } from '../../services/syncPolicy';

function SyncStatusArea({ status, lastSavedAt, notice, localMode, details, onRetry }: { status: string; lastSavedAt: string | null; notice: string | null; localMode: boolean; details: SyncDetails; onRetry: () => void }) {
  const { language, t } = useLanguage();
  const { openHelp } = useHelp();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const colors: Record<string, string> = {
    loading: 'bg-stone-100 text-stone-600 border-stone-200',
    online: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    syncing: 'bg-blue-50 text-blue-700 border-blue-200',
    saving: 'bg-blue-50 text-blue-700 border-blue-200',
    unsaved: 'bg-amber-50 text-amber-700 border-amber-200',
    local: 'bg-violet-50 text-violet-700 border-violet-200',
    offline: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    'action-required': 'bg-rose-50 text-rose-800 border-rose-300',
  };
  const labels: Record<string, string> = {
    loading: t('loadingSavedRecords'),
    online: localMode ? t('savedOnDeviceCloudUnavailable') : t('savedAndCloudSynced'),
    syncing: t('syncingToCloud'),
    saving: t('syncingToCloud'),
    unsaved: t('savingOnDevice'),
    local: localMode ? t('savedOnDeviceCloudUnavailable') : t('savedOnDeviceSyncPending'),
    offline: navigator.onLine ? t('cloudUnavailableSavedOnDevice') : t('noInternetSavedOnDevice'),
    failed: t('syncFailedSavedOnDevice'),
    'action-required': t('savedDataNeedsAttention'),
  };
  const presentation = syncPresentationState({ pendingChanges: details.pendingChanges, online: details.internet, signedIn: details.signedIn, cloudAvailable: details.cloudAvailable, failed: status === 'failed' || status === 'action-required' });
  const presentationLabel: Record<string, string> = {
    saved: labels[status] || labels.online,
    offline: language === 'ta' ? 'இணையம் இல்லை — இந்தச் சாதனத்தில் சேமிக்கப்பட்டது' : 'No internet — saved on this device',
    'sign-in-required': language === 'ta' ? 'ஒத்திசைக்க உள்நுழைவு தேவை' : 'Sign-in required to sync',
    'cloud-unavailable': language === 'ta' ? 'மேக ஒத்திசைவு கிடைக்கவில்லை — பணி சாதனத்தில் பாதுகாப்பாக உள்ளது' : 'Cloud sync unavailable — work is safe locally',
    failed: language === 'ta' ? 'மேக ஒத்திசைவு தோல்வி — பணி சாதனத்தில் பாதுகாப்பாக உள்ளது' : 'Cloud sync failed — work is safe locally',
    syncing: language === 'ta' ? 'மேகத்துடன் ஒத்திசைக்கப்படுகிறது…' : 'Syncing to cloud…',
  };
  const showRetry = details.pendingChanges > 0 && !localMode && details.internet && details.signedIn;
  const pendingLong = Boolean(details.pendingSince && Date.now() - new Date(details.pendingSince).getTime() > 15_000);
  const visualStatus = localMode && status === 'online' ? 'local' : status;
  return (
    <div role="region" aria-label={language === 'ta' ? 'சேமிப்பு மற்றும் மேக ஒத்திசைவு நிலை' : 'Save and cloud sync status'} className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center font-sans text-sm font-medium ${colors[visualStatus] || colors.offline}`}>
      <span role="status" aria-live="polite" aria-atomic="true">{pendingLong ? (language === 'ta' ? 'உங்கள் பணி இந்தச் சாதனத்தில் பாதுகாப்பாக உள்ளது, ஆனால் மேக ஒத்திசைவு இன்னும் முடியவில்லை.' : 'Your work is safe on this device, but cloud sync has not completed.') : presentationLabel[presentation]}</span>
      {lastSavedAt && <span className="text-xs font-semibold">{t('lastSaved')}: {new Date(lastSavedAt).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-IN')}</span>}
      {notice && ['action-required', 'failed'].includes(status) && <span className="w-full text-xs">{notice}</span>}
      {showRetry && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-current bg-white/80 px-3 font-bold">{t('retry')}</button>}
      {details.pendingChanges > 0 && <button type="button" onClick={() => setDetailsOpen(true)} className="min-h-11 rounded-lg px-2 font-bold underline underline-offset-2">{language === 'ta' ? 'விவரங்களைக் காண்க' : 'View details'}</button>}
      <button type="button" onClick={() => openHelp('sync')} className="min-h-11 rounded-lg px-2 font-semibold underline underline-offset-2">{details.pendingChanges > 0 ? (language === 'ta' ? 'ஒத்திசைவு ஏன் நிலுவையில் உள்ளது?' : 'Why is sync pending?') : (language === 'ta' ? 'மேக ஒத்திசைவு பற்றி' : 'About cloud sync')}</button>
      <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title={language === 'ta' ? 'மேக ஒத்திசைவு விவரங்கள்' : 'Cloud sync details'}>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-sm">
          <dt>{language === 'ta' ? 'இணையம்' : 'Internet'}</dt><dd className="font-semibold">{details.internet ? (language === 'ta' ? 'இணைக்கப்பட்டது' : 'Connected') : (language === 'ta' ? 'கிடைக்கவில்லை' : 'Unavailable')}</dd>
          <dt>{language === 'ta' ? 'உள்நுழைந்துள்ளீர்கள்' : 'Signed in'}</dt><dd className="font-semibold">{details.signedIn ? (language === 'ta' ? 'ஆம்' : 'Yes') : (language === 'ta' ? 'இல்லை' : 'No')}</dd>
          <dt>{language === 'ta' ? 'மேகச் சேவை' : 'Cloud service'}</dt><dd className="font-semibold">{details.cloudAvailable ? (language === 'ta' ? 'கிடைக்கிறது' : 'Available') : (language === 'ta' ? 'கிடைக்கவில்லை' : 'Unavailable')}</dd>
          <dt>{language === 'ta' ? 'நிலுவை மாற்றங்கள்' : 'Pending changes'}</dt><dd className="font-semibold">{details.pendingChanges}</dd>
          <dt>{language === 'ta' ? 'கடைசி முயற்சி' : 'Last sync attempt'}</dt><dd className="text-right font-semibold">{details.lastAttemptAt ? new Date(details.lastAttemptAt).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-IN') : '—'}</dd>
          {details.errorReference ? <><dt>{language === 'ta' ? 'பிழைக் குறிப்பு' : 'Error reference'}</dt><dd className="font-mono text-xs">{details.errorReference}</dd></> : null}
        </dl>
      </Modal>
    </div>
  );
}

export default function AppLayout() {
  const { firebaseStatus, syncStatus, lastSavedAt, syncNotice, syncDetails, retrySync } = useData();
  const { user } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const openMobileDrawer = useCallback(() => setMobileDrawerOpen(true), []);
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50 text-stone-800 font-sans lg:flex-row">
      <Sidebar mobileOpen={mobileDrawerOpen} onCloseMobile={closeMobileDrawer} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <SyncStatusArea status={syncStatus} lastSavedAt={lastSavedAt} notice={syncNotice} localMode={firebaseStatus.localMode} details={{ ...syncDetails, signedIn: Boolean(user) }} onRetry={retrySync} />
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(7rem+env(safe-area-inset-bottom))] lg:p-8">
          <Outlet />
        </main>
      </div>
      <FloatingHelp />
      <MobileBottomNavigation onOpenMore={openMobileDrawer} />
    </div>
  );
}
