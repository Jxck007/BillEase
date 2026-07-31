import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Building2, FilePlus2, FileText, LayoutDashboard, LogOut, Package,
  ReceiptText, Settings, Truck, Users, X, BarChart3,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAccessibleOverlay } from '../../hooks/useAccessibleOverlay';

const groups = [
  { labelKey: '', links: [{ to: '/', icon: LayoutDashboard, labelKey: 'dashboard' }] },
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

type SidebarProps = { mobileOpen: boolean; onCloseMobile: () => void };

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { logout } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useAccessibleOverlay({
    open: mobileOpen,
    containerRef: overlayRef,
    onClose: onCloseMobile,
    initialFocusRef: closeButtonRef,
  });

  const isActive = (to: string) => {
    const path = to.split('#')[0];
    if (path === '/') return location.pathname === '/';
    if (path === '/settings') return location.pathname === '/settings' && (to.includes('#') ? location.hash === '#company' : location.hash !== '#company');
    if (path.endsWith('/new')) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navigationGroups = (mobile: boolean) => {
    const visibleGroups = mobile ? [{ labelKey: 'more', links: mobileMoreLinks }] : groups;
    return visibleGroups.map((group, groupIndex) => (
      <div key={`${group.labelKey}-${groupIndex}`} className={groupIndex ? 'mt-4' : ''}>
        {group.labelKey && <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">{t(group.labelKey)}</p>}
        <div className="space-y-1">
          {group.links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.to);
            return (
              <Link key={link.to} to={link.to} onClick={onCloseMobile} aria-current={active ? 'page' : undefined} className={cn(
                'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                active ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
              )}>
                <Icon size={20} className="shrink-0" />
                {t(link.labelKey)}
              </Link>
            );
          })}
        </div>
      </div>
    ));
  };

  const footer = (
    <div className="shrink-0 border-t border-stone-100 bg-white p-3">
      <button type="button" onClick={() => { onCloseMobile(); logout(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
        <LogOut size={20} />{t('logout')}
      </button>
    </div>
  );

  const brand = (mobile: boolean) => (
    <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-stone-100 px-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white">B</div>
      <div className="min-w-0 flex-1"><p className="font-bold text-stone-900">BillEase</p><p className="text-xs text-stone-500">{t('simpleBusinessBilling')}</p></div>
      {mobile && <button ref={closeButtonRef} type="button" onClick={onCloseMobile} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-stone-100" aria-label={language === 'ta' ? 'வழிசெலுத்தல் பட்டியலை மூடு' : 'Close navigation menu'}><X size={24} /></button>}
    </div>
  );

  const mobileDrawer = mobileOpen && typeof document !== 'undefined' ? createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[100] lg:hidden" data-billease-overlay>
      <div className="absolute inset-0 bg-black/35" aria-hidden="true" onMouseDown={onCloseMobile} />
      <aside role="dialog" aria-modal="true" aria-label={language === 'ta' ? 'வழிசெலுத்தல் பட்டியல்' : 'Navigation drawer'} className="relative z-[101] flex h-[100dvh] w-[min(19rem,90vw)] flex-col border-r border-stone-200 bg-white shadow-2xl" tabIndex={-1}>
        {brand(true)}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label={language === 'ta' ? 'மேலும் வழிசெலுத்தல்' : 'More navigation'}>{navigationGroups(true)}</nav>
        {footer}
      </aside>
    </div>, document.body,
  ) : null;

  return (
    <>
      <aside className="hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-stone-200 bg-white lg:sticky lg:top-0 lg:flex" aria-label={language === 'ta' ? 'முதன்மை வழிசெலுத்தல்' : 'Primary navigation'}>
        {brand(false)}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-4" aria-label={language === 'ta' ? 'முதன்மை வழிசெலுத்தல்' : 'Primary navigation'}>{navigationGroups(false)}</nav>
        {footer}
      </aside>
      {mobileDrawer}
    </>
  );
}
