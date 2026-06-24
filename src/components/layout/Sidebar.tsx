import { Link, useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { getEstimatesNavLabel } from '../../lib/estimateUtils';
import { LayoutDashboard, Users, FileText, Settings, Menu, X, PiggyBank, Receipt, DollarSign, Wallet, BarChart2, Truck, LogOut } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export default function Sidebar() {
  const { state } = useData();
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const links = [
    { to: '/', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/invoices', icon: FileText, label: t('invoices') },
    { to: '/estimates', icon: Receipt, label: getEstimatesNavLabel(state.settings, language) },
    { to: '/delivery-notes', icon: Truck, label: 'Delivery Notes' },
    { to: '/customers', icon: Users, label: t('customers') },
    { to: '/products', icon: PiggyBank, label: t('products') },
    { to: '/payments', icon: DollarSign, label: t('payments') },
    { to: '/expenses', icon: Wallet, label: t('expenses') },
    { to: '/reports', icon: BarChart2, label: t('reports') },
    { to: '/settings', icon: Settings, label: t('settings') },
  ];

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <div className="print:hidden lg:hidden flex items-center justify-between bg-white border-b px-4 py-3">
        <span className="font-bold text-lg text-primary-600">BillEase (பில்-ஈஸ்)</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -mr-2">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r shadow-sm transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      ) + " print:hidden"}>
        <div className="p-6 hidden md:flex items-center gap-3 border-b border-stone-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">B</div>
          <div>
            <h1 className="font-bold text-sm leading-tight uppercase tracking-wider text-stone-800">BillEase</h1>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">பில்ease</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMenu}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 font-semibold" 
                    : "text-stone-500 hover:bg-stone-50 font-medium"
                )}
              >
                <Icon size={20} className={cn(isActive ? "text-emerald-600" : "text-stone-400")} />
                <span className="text-sm">{link.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-stone-100">
          <button
            onClick={() => {
              closeMenu();
              logout();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-colors text-rose-600 hover:bg-rose-50 font-medium"
          >
            <LogOut size={20} />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>
      
      {/* Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden" 
          onClick={closeMenu}
        />
      )}
    </>
  );
}
