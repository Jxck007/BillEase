import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import FloatingHelp from './FloatingHelp';
import BottomNav from './BottomNav';
import { useData } from '../../context/DataContext';

export default function AppLayout() {
  const { firebaseStatus } = useData();

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(180deg,_#fffdf9_0%,_#f7f5ef_100%)] flex flex-col md:flex-row text-stone-800 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-dvh md:h-screen overflow-hidden">
        <Navbar />
        {firebaseStatus.localMode && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 md:px-8">
            Firebase not connected. Running in local mode.
          </div>
        )}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 w-full max-w-7xl mx-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <FloatingHelp />
    </div>
  );
}
