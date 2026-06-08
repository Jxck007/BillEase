import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { LayoutDashboard, FileText, PiggyBank, PlusCircle, Menu, Users, Wallet, BarChart2, Settings, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import SidebarMobileMenu from './SidebarMobileMenu'; // We'll create this to reuse sidebar logic

export default function BottomNav() {
  const { t, language } = useLanguage();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const links = [
    { to: '/', icon: LayoutDashboard, label: language === 'en' ? 'Home' : 'முகப்பு' },
    { to: '/invoices', icon: FileText, label: language === 'en' ? 'Bills' : 'பில்கள்' },
    { to: '/invoices/new', icon: PlusCircle, label: language === 'en' ? 'New' : 'புதிய', isFab: true },
    { to: '/delivery-notes', icon: Truck, label: language === 'en' ? 'DN' : 'DN' },
    { to: '/products', icon: PiggyBank, label: language === 'en' ? 'Items' : 'பொருட்கள்' },
  ];

  return (
    <>
      <nav className="print:hidden md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-40 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
        <div className="flex justify-around items-center px-1 py-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
            
            if (link.isFab) {
               return (
                 <Link 
                   key={link.to} 
                   to={link.to}
                   className="relative -top-5 flex flex-col items-center justify-center w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg border-4 border-[#fcfaf7] hover:bg-emerald-700 transition-colors"
                 >
                   <Icon size={24} />
                 </Link>
               )
            }

            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "flex flex-col items-center p-2 rounded-xl min-w-16",
                  isActive ? "text-emerald-600" : "text-stone-500"
                )}
              >
                <div className={cn(
                  "p-1 rounded-lg mb-1 transition-colors",
                  isActive ? "bg-emerald-50" : ""
                )}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-medium leading-none">{link.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setIsMoreOpen(true)}
            className="flex flex-col items-center p-2 rounded-xl min-w-16 text-stone-500"
          >
            <div className="p-1 rounded-lg mb-1 transition-colors">
              <Menu size={20} />
            </div>
            <span className="text-[10px] font-medium leading-none">{language === 'en' ? 'More' : 'மேலும்'}</span>
          </button>
        </div>
      </nav>

      {isMoreOpen && (
        <SidebarMobileMenu onClose={() => setIsMoreOpen(false)} />
      )}
    </>
  );
}
