import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import FloatingHelp from './FloatingHelp';
import BottomNav from './BottomNav';
import { useData } from '../../context/DataContext';

function SyncStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    loading: 'bg-stone-100 text-stone-600 border-stone-200',
    online: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    syncing: 'bg-blue-50 text-blue-700 border-blue-200',
    offline: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const labels: Record<string, string> = {
    loading: 'Loading cloud data...',
    online: 'Saved',
    syncing: 'Saving...',
    offline: 'Offline',
    failed: 'Cloud sync failed',
  };
  return (
    <div className={`px-4 py-1 text-[10px] font-medium text-center border-b ${colors[status] || colors.offline}`}>
      {labels[status] || labels.offline}
    </div>
  );
}

export default function AppLayout() {
  const { firebaseStatus, syncStatus, lastSavedAt } = useData();

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(180deg,_#fffdf9_0%,_#f7f5ef_100%)] flex flex-col md:flex-row text-stone-800 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-dvh md:h-screen overflow-hidden">
        <Navbar />
        <SyncStatusBadge status={syncStatus} />
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 w-full max-w-7xl mx-auto pb-28 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <FloatingHelp />
    </div>
  );
}
