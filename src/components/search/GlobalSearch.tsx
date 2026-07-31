import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Package, Search, Truck, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAccessibleOverlay } from '../../hooks/useAccessibleOverlay';

interface SearchResult {
  id: string;
  group: 'Invoices' | 'Quotations' | 'Delivery Notes' | 'Customers' | 'Products';
  label: string;
  detail: string;
  to: string;
  icon: typeof FileText;
  haystack: string;
}

export default function GlobalSearch() {
  const { state } = useData();
  const { language, t } = useLanguage();
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const closeSearch = useCallback(() => setOpen(false), []);
  const mobileOpen = open && typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  useAccessibleOverlay({
    open: mobileOpen,
    containerRef: mobileDialogRef,
    initialFocusRef: inputRef,
    onClose: closeSearch,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 140);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const allResults = useMemo<SearchResult[]>(() => [
    ...state.invoices.map((document) => {
      const customer = state.customers.find((item) => item.id === document.customerId);
      const quotation = document.type === 'estimate';
      return {
        id: document.id,
        group: quotation ? 'Quotations' as const : 'Invoices' as const,
        label: `${quotation ? text('Quotation', 'விலைமதிப்பீடு') : text('Invoice', 'விலைப்பட்டியல்')} ${document.invoiceNumber}`,
        detail: customer?.name || text('Unknown customer', 'வாடிக்கையாளர் தெரியவில்லை'),
        to: `/${quotation ? 'estimates' : 'invoices'}/${document.id}`,
        icon: FileText,
        haystack: [document.invoiceNumber, customer?.name, customer?.gstNumber, customer?.gstin, customer?.phone].filter(Boolean).join(' ').toLowerCase(),
      };
    }),
    ...state.deliveryNotes.map((document) => {
      const customer = state.customers.find((item) => item.id === document.customerId);
      return {
        id: document.id,
        group: 'Delivery Notes' as const,
        label: `${text('Delivery Note', 'விநியோகக் குறிப்பு')} ${document.deliveryNoteNumber || document.dnNumber || ''}`,
        detail: customer?.name || text('Unknown customer', 'வாடிக்கையாளர் தெரியவில்லை'),
        to: `/delivery-notes/${document.id}`,
        icon: Truck,
        haystack: [document.deliveryNoteNumber, document.dnNumber, customer?.name, customer?.phone].filter(Boolean).join(' ').toLowerCase(),
      };
    }),
    ...state.customers.map((customer) => ({
      id: customer.id,
      group: 'Customers' as const,
      label: customer.name,
      detail: customer.phone || customer.gstNumber || customer.gstin || t('customers'),
      to: `/customers?customer=${encodeURIComponent(customer.id)}`,
      icon: Users,
      haystack: [customer.name, customer.gstNumber, customer.gstin, customer.phone].filter(Boolean).join(' ').toLowerCase(),
    })),
    ...state.products.map((product) => ({
      id: product.id,
      group: 'Products' as const,
      label: product.name,
      detail: [product.hsnSac, product.unit].filter(Boolean).join(' · ') || text('Product or service', 'பொருள் அல்லது சேவை'),
      to: `/products?product=${encodeURIComponent(product.id)}`,
      icon: Package,
      haystack: [product.name, product.hsnSac].filter(Boolean).join(' ').toLowerCase(),
    })),
  ], [language, state.customers, state.deliveryNotes, state.invoices, state.products, t]);

  const results = useMemo(
    () => debouncedQuery ? allResults.filter((result) => result.haystack.includes(debouncedQuery)).slice(0, 30) : [],
    [allResults, debouncedQuery],
  );

  const groups = useMemo(() => ['Invoices', 'Quotations', 'Delivery Notes', 'Customers', 'Products']
    .map((name) => ({ name, items: results.filter((result) => result.group === name) }))
    .filter((group) => group.items.length), [results]);
  const orderedResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => setActiveIndex(0), [debouncedQuery]);

  const choose = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(result.to);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!orderedResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % orderedResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + orderedResults.length) % orderedResults.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(orderedResults[activeIndex]);
    }
  };

  const renderSearchInput = () => (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={19} />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={text('Search invoices, customers, products…', 'விலைப்பட்டியல், வாடிக்கையாளர், பொருட்களைத் தேடவும்…')}
        className="min-h-12 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        aria-label={text('Search all records', 'அனைத்து பதிவுகளிலும் தேடு')}
        aria-expanded={open}
      />
    </div>
  );

  return (
    <>
      <div className="relative hidden w-full max-w-xl md:block">
        {renderSearchInput()}
        {open && query && (
          <SearchResults groups={groups} results={results} activeIndex={activeIndex} query={query} onChoose={choose} language={language} />
        )}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-700 md:hidden" aria-label={text('Open global search', 'தேடலைத் திற')}>
        <Search size={20} />
        <span className="hidden min-[390px]:inline">{text('Search', 'தேடு')}</span>
      </button>
      {mobileOpen && createPortal(
        <div ref={mobileDialogRef} className="fixed inset-0 z-[100] bg-white p-4 md:hidden" role="dialog" aria-modal="true" aria-labelledby="global-search-title" tabIndex={-1}>
          <div className="mx-auto flex h-full max-w-2xl flex-col">
            <h2 id="global-search-title" className="sr-only">{text('Search records', 'பதிவுகளைத் தேடு')}</h2>
            <div className="flex items-center gap-2">
              {renderSearchInput()}
              <button type="button" onClick={closeSearch} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-stone-200" aria-label={text('Close search', 'தேடலை மூடு')}><X size={22} /></button>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {query && <SearchResults groups={groups} results={results} activeIndex={activeIndex} query={query} onChoose={choose} language={language} inline />}
              {!query && <p className="py-12 text-center text-sm text-stone-500">{text('Type a number, customer, GSTIN, phone, product or HSN/SAC.', 'எண், வாடிக்கையாளர், GSTIN, தொலைபேசி, பொருள் அல்லது HSN/SAC-ஐ உள்ளிடவும்.')}</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function SearchResults({ groups, results, activeIndex, query, onChoose, language, inline = false }: {
  groups: { name: string; items: SearchResult[] }[];
  results: SearchResult[];
  activeIndex: number;
  query: string;
  onChoose: (result: SearchResult) => void;
  language: 'en' | 'ta';
  inline?: boolean;
}) {
  let resultIndex = -1;
  const content = results.length ? groups.map((group) => (
    <section key={group.name} className="py-2">
      <h3 className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-500">{language === 'ta' ? ({
        Invoices: 'விலைப்பட்டியல்கள்',
        Quotations: 'விலைமதிப்பீடுகள்',
        'Delivery Notes': 'விநியோகக் குறிப்புகள்',
        Customers: 'வாடிக்கையாளர்கள்',
        Products: 'பொருட்கள்',
      } as Record<string, string>)[group.name] : group.name}</h3>
      {group.items.map((result) => {
        resultIndex += 1;
        const currentIndex = resultIndex;
        const Icon = result.icon;
        return (
          <button key={`${result.group}-${result.id}`} type="button" onClick={() => onChoose(result)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${activeIndex === currentIndex ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-stone-50'}`}>
            <Icon size={20} className="shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{result.label}</span>
              <span className="block truncate text-xs text-stone-500">{result.detail}</span>
            </span>
          </button>
        );
      })}
    </section>
  )) : <p className="px-4 py-10 text-center text-sm text-stone-500">{language === 'ta' ? `“${query}” என்பதற்குச் சேமிக்கப்பட்ட முடிவுகள் இல்லை.` : `No cached results for “${query}”.`}</p>;

  return inline ? <div>{content}</div> : (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
      {content}
    </div>
  );
}
