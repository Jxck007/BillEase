import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import FloatingHelp from './FloatingHelp';
import { useData } from '../../context/DataContext';
import MobileBottomNavigation from './MobileBottomNavigation';
import { useCallback, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

function SyncStatusArea({ status, lastSavedAt, notice, localMode, onRetry }: { status: string; lastSavedAt: string | null; notice: string | null; localMode: boolean; onRetry: () => void }) {
  const { language, t } = useLanguage();
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
  const showRetry = ['failed', 'action-required', 'offline'].includes(status) && !localMode;
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center text-sm font-medium ${colors[status] || colors.offline}`}>
      <span>{labels[status] || labels.offline}</span>
      {lastSavedAt && <span className="text-xs font-semibold">{t('lastSaved')}: {new Date(lastSavedAt).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-IN')}</span>}
      {notice && ['action-required', 'failed'].includes(status) && <span className="w-full text-xs">{notice}</span>}
      {showRetry && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-current bg-white/80 px-3 font-bold">{t('retry')}</button>}
    </div>
  );
}

export default function AppLayout() {
  const { firebaseStatus, syncStatus, lastSavedAt, syncNotice, retrySync } = useData();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const openMobileDrawer = useCallback(() => setMobileDrawerOpen(true), []);
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50 text-stone-800 font-sans lg:flex-row">
      <Sidebar mobileOpen={mobileDrawerOpen} onCloseMobile={closeMobileDrawer} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <SyncStatusArea status={syncStatus} lastSavedAt={lastSavedAt} notice={syncNotice} localMode={firebaseStatus.localMode} onRetry={retrySync} />
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(7rem+env(safe-area-inset-bottom))] lg:p-8">
          <Outlet />
        </main>
      </div>
      <FloatingHelp />
      <MobileBottomNavigation onOpenMore={openMobileDrawer} />
    </div>
  );
}
