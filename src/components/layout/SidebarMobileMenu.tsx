import { Link } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { getEstimatesNavLabel } from '../../lib/estimateUtils';
import { Users, Receipt, DollarSign, Wallet, BarChart2, Settings, X, Truck, LogOut } from 'lucide-react';

export default function SidebarMobileMenu({ onClose }: { onClose: () => void }) {
  const { state } = useData();
  const { t, language } = useLanguage();
  const { logout } = useAuth();

  const links = [
    { to: '/customers', icon: Users, label: t('customers') },
    { to: '/estimates', icon: Receipt, label: getEstimatesNavLabel(state.settings, language) },
    { to: '/delivery-notes', icon: Truck, label: 'Delivery Notes' },
    { to: '/payments', icon: DollarSign, label: t('payments') },
    { to: '/expenses', icon: Wallet, label: t('expenses') },
    { to: '/reports', icon: BarChart2, label: t('reports') },
    { to: '/settings', icon: Settings, label: t('settings') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div 
         className="w-full sm:w-80 bg-white rounded-3xl shadow-2xl overflow-hidden mt-auto mb-20 sm:my-auto max-h-[calc(100dvh-6rem)] sm:max-h-[calc(100dvh-4rem)] flex flex-col transform transition-all"
         onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-stone-100 flex justify-between items-center">
           <h3 className="font-bold text-stone-800">{language === 'en' ? 'More Options' : 'மேலும்'}</h3>
           <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 bg-stone-50 rounded-full">
             <X size={20} />
           </button>
        </div>
        <div className="p-2 overflow-y-auto">
           {links.map((link) => (
             <Link
                key={link.to}
                to={link.to}
                onClick={onClose}
                className="flex items-center gap-4 p-4 text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-2xl transition-colors font-medium"
             >
                <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-500">
                  <link.icon size={20} />
                </div>
                <span>{link.label}</span>
             </Link>
           ))}
           <div className="my-2 border-t border-stone-100" />
           <button
             onClick={() => {
               onClose();
               logout();
             }}
             className="flex w-full items-center gap-4 p-4 text-rose-600 hover:bg-rose-50 rounded-2xl transition-colors font-medium"
           >
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                <LogOut size={20} />
              </div>
              <span>Logout</span>
           </button>
        </div>
      </div>
    </div>
  );
}
