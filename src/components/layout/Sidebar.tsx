import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Building2, FilePlus2, FileText, LayoutDashboard, LogOut, Package,
  ReceiptText, Settings, Truck, Users, X, BarChart3,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

const groups = [
  {
    labelKey: '',
    links: [{ to: '/', icon: LayoutDashboard, labelKey: 'dashboard' }],
  },
  {
    labelKey: 'create',
    links: [
      { to: '/invoices/new', icon: FilePlus2, labelKey: 'newInvoice' },
      { to: '/estimates/new', icon: FilePlus2, labelKey: 'newQuotation' },
      { to: '/delivery-notes/new', icon: FilePlus2, labelKey: 'newDeliveryNote' },
    ],
  },
  {
    labelKey: 'records',
    links: [
      { to: '/invoices', icon: FileText, labelKey: 'invoices' },
      { to: '/estimates', icon: ReceiptText, labelKey: 'quotations' },
      { to: '/delivery-notes', icon: Truck, labelKey: 'deliveryNotes' },
    ],
  },
  {
    labelKey: '',
    links: [
      { to: '/customers', icon: Users, labelKey: 'customers' },
      { to: '/products', icon: Package, labelKey: 'products' },
      { to: '/reports', icon: BarChart3, labelKey: 'reports' },
      { to: '/settings#company', icon: Building2, labelKey: 'company' },
      { to: '/settings', icon: Settings, labelKey: 'settings' },
    ],
  },
];

const mobileMoreLinks = groups[3].links.filter((link) => link.to !== '/customers');

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [mobileOpen, onCloseMobile]);

  const isActive = (to: string) => {
    const path = to.split('#')[0];
    if (path === '/') return location.pathname === '/';
    if (path === '/settings') return location.pathname === '/settings' && (to.includes('#') ? location.hash === '#company' : location.hash !== '#company');
    if (path.endsWith('/new')) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <>
      <aside className={cn(
        'mobile-navigation-drawer print:hidden fixed inset-y-0 left-0 z-50 flex w-[min(19rem,90vw)] flex-col border-r border-stone-200 bg-white transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-[100dvh] lg:w-64 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )} aria-label="Navigation drawer" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined}>
        <div className="flex min-h-16 items-center gap-3 border-b border-stone-100 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white">B</div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-stone-900">BillEase</p>
            <p className="text-xs text-stone-500">{t('simpleBusinessBilling')}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onCloseMobile} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-stone-100 lg:hidden" aria-label="Close navigation menu"><X size={24} /></button>
        </div>
        <nav className="hidden flex-1 overflow-y-auto px-3 py-3 lg:block" aria-label="Primary navigation">
          {groups.map((group, groupIndex) => (
            <div key={`${group.labelKey}-${groupIndex}`} className={groupIndex ? 'mt-4' : ''}>
              {group.labelKey && <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">{t(group.labelKey)}</p>}
              <div className="space-y-1">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.to);
                  return (
                    <Link key={link.to} to={link.to} onClick={onCloseMobile} aria-current={active ? 'page' : undefined} className={cn(
                      'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold',
                      active ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                    )}>
                      <Icon size={20} className="shrink-0" />
                      {t(link.labelKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <nav className="flex-1 overflow-y-auto px-3 py-4 lg:hidden" aria-label="More navigation">
          <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{t('more')}</p>
          <div className="space-y-1">
            {mobileMoreLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link key={link.to} to={link.to} onClick={onCloseMobile} aria-current={active ? 'page' : undefined} className={cn(
                  'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold',
                  active ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                )}>
                  <Icon size={20} className="shrink-0" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-stone-100 p-3">
          <button type="button" onClick={() => { onCloseMobile(); logout(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">
            <LogOut size={20} />
            {t('logout')}
          </button>
        </div>
      </aside>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onCloseMobile} aria-label="Close navigation menu backdrop" />}
    </>
  );
}
