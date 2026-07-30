import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FilePlus2,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  ReceiptText,
  Truck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';

type SheetName = 'records' | 'create' | null;

const records = [
  { to: '/invoices', labelKey: 'invoices', icon: FileText },
  { to: '/estimates', labelKey: 'quotations', icon: ReceiptText },
  { to: '/delivery-notes', labelKey: 'deliveryNotes', icon: Truck },
];

const quickCreate = [
  { to: '/invoices/new', labelKey: 'newInvoice', icon: FilePlus2 },
  { to: '/estimates/new', labelKey: 'newQuotation', icon: ReceiptText },
  { to: '/delivery-notes/new', labelKey: 'newDeliveryNote', icon: Truck },
  { to: '/customers?add=1', labelKey: 'addCustomer', icon: UserPlus },
];

function ActionSheet({ title, links, onClose }: {
  title: string;
  links: typeof records;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button, a[href]') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:hidden" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section ref={sheetRef} className="mobile-action-sheet w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-4 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="mobile-action-sheet-title">
        <div className="mb-3 flex min-h-12 items-center justify-between gap-3">
          <h2 id="mobile-action-sheet-title" className="text-lg font-bold text-stone-900">{title}</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-700" aria-label={`Close ${title}`}>
            <X size={24} />
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {links.map(({ to, labelKey, icon: Icon }) => (
            <Link key={to} to={to} onClick={onClose} className="flex min-h-14 items-center gap-3 rounded-2xl border border-stone-200 px-4 font-semibold text-stone-800 hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <Icon size={22} className="text-emerald-700" />
              {t(labelKey)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function MobileBottomNavigation({ onOpenMore }: { onOpenMore: () => void }) {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardOpen(viewport.height < window.innerHeight * 0.72);
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, []);

  useEffect(() => setSheet(null), [location.pathname]);

  const recordsActive = /^\/(invoices|estimates|delivery-notes)(\/|$)/.test(location.pathname);
  const moreActive = /^\/(products|reports|settings)(\/|$)/.test(location.pathname);

  const directAction = (to: string) => {
    setSheet(null);
    navigate(to);
  };

  if (keyboardOpen) return null;

  const itemClass = (active: boolean) => cn(
    'flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
    active ? 'text-emerald-700' : 'text-stone-500',
  );

  return (
    <>
      <nav className="mobile-bottom-nav print:hidden fixed inset-x-0 bottom-0 z-[60] border-t border-stone-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile navigation" data-no-export="true">
        <div className="mx-auto grid min-h-[72px] max-w-xl grid-cols-5 items-center">
          <button type="button" onClick={() => directAction('/')} className={itemClass(location.pathname === '/')} aria-current={location.pathname === '/' ? 'page' : undefined}>
            <LayoutDashboard size={21} />
            <span>{t('dashboard')}</span>
          </button>
          <button type="button" onClick={() => setSheet('records')} className={itemClass(recordsActive)} aria-expanded={sheet === 'records'} aria-haspopup="dialog">
            <FileText size={21} />
            <span>{t('records')}</span>
          </button>
          <button type="button" onClick={() => setSheet('create')} className="mx-auto -mt-7 flex h-[60px] w-[60px] items-center justify-center rounded-full border-4 border-stone-50 bg-emerald-600 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2" aria-label="Open quick create menu" aria-expanded={sheet === 'create'} aria-haspopup="dialog">
            <Plus size={31} strokeWidth={2.5} />
          </button>
          <button type="button" onClick={() => directAction('/customers')} className={itemClass(location.pathname.startsWith('/customers'))} aria-current={location.pathname.startsWith('/customers') ? 'page' : undefined}>
            <Users size={21} />
            <span>{t('customers')}</span>
          </button>
          <button type="button" onClick={() => { setSheet(null); onOpenMore(); }} className={itemClass(moreActive)} aria-haspopup="dialog">
            <Menu size={21} />
            <span>{t('more')}</span>
          </button>
        </div>
      </nav>
      {sheet === 'records' && <ActionSheet title={t('records')} links={records} onClose={() => setSheet(null)} />}
      {sheet === 'create' && <ActionSheet title={t('quickCreate')} links={quickCreate} onClose={() => setSheet(null)} />}
    </>
  );
}
