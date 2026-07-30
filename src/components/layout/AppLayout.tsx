import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import FloatingHelp from './FloatingHelp';
import { useData } from '../../context/DataContext';
import MobileBottomNavigation from './MobileBottomNavigation';
import { useCallback, useState } from 'react';

function SyncStatusBadge({ status }: { status: string }) {
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
    loading: 'Loading cloud data...',
    online: 'Saved',
    syncing: 'Saving...',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    local: 'Saved locally',
    offline: 'Offline',
    failed: 'Cloud sync failed',
    'action-required': 'Action required',
  };
  return (
    <div className={`px-4 py-1 text-[10px] font-medium text-center border-b ${colors[status] || colors.offline}`}>
      {labels[status] || labels.offline}
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
        <SyncStatusBadge status={syncStatus} />
        {syncNotice && (
          <div role="alert" className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
            <span>{syncNotice}</span>
            {(syncStatus === 'failed' || syncStatus === 'action-required' || syncStatus === 'offline') && <button type="button" onClick={retrySync} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-bold">Retry</button>}
          </div>
        )}
        {lastSavedAt && (
          <div className="border-b border-stone-200 bg-white/80 px-4 py-1 text-[11px] text-stone-500 md:px-8">
            Last saved: {new Date(lastSavedAt).toLocaleString()}
          </div>
        )}
        {firebaseStatus.localMode && syncStatus === 'offline' && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 md:px-8">
            Firebase not connected. Running in local mode.
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(7rem+env(safe-area-inset-bottom))] lg:p-8">
          <Outlet />
        </main>
      </div>
      <FloatingHelp />
      <MobileBottomNavigation onOpenMore={openMobileDrawer} />
    </div>
  );
}
