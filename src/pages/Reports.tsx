import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../lib/utils';
import { calculateBillingMetrics } from '../services/paymentService';

type DateRange = 'any' | 'today' | 'week' | 'month' | 'last_month' | 'financial_year' | 'custom';
type ReportFilters = { status: string; customer: string; dateRange: DateRange; fromDate: string; toDate: string };

const DEFAULT_FILTERS: ReportFilters = { status: 'all', customer: 'all', dateRange: 'any', fromDate: '', toDate: '' };
const SESSION_KEY = 'billease.reportFilters';

function readSessionFilters(): ReportFilters {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return value && typeof value === 'object' ? { ...DEFAULT_FILTERS, ...value } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDateRange(filters: ReportFilters) {
  if (filters.dateRange === 'any') return { from: '', to: '' };
  if (filters.dateRange === 'custom') return { from: filters.fromDate, to: filters.toDate };
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  if (filters.dateRange === 'week') {
    const weekday = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - weekday);
  } else if (filters.dateRange === 'month') {
    from.setDate(1);
  } else if (filters.dateRange === 'last_month') {
    from.setMonth(from.getMonth() - 1, 1);
    to.setDate(0);
  } else if (filters.dateRange === 'financial_year') {
    const financialYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    from.setFullYear(financialYearStart, 3, 1);
  }
  return { from: isoDate(from), to: isoDate(to) };
}

export default function Reports() {
  const { state } = useData();
  const { t, language } = useLanguage();
  const text = (english: string, tamil: string) => language === 'ta' ? tamil : english;
  const [filters, setFilters] = useState<ReportFilters>(readSessionFilters);
  const [draft, setDraft] = useState<ReportFilters>(readSessionFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const statusLabels: Record<string, string> = {
    all: text('All', 'அனைத்தும்'), paid: text('Paid', 'செலுத்தப்பட்டது'), unpaid: text('Unpaid', 'செலுத்தப்படவில்லை'),
    partially_paid: text('Partially paid', 'பகுதி செலுத்தப்பட்டது'), overdue: text('Overdue', 'காலாவதி'), cancelled: text('Cancelled', 'ரத்து செய்யப்பட்டது'),
  };
  const dateLabels: Record<DateRange, string> = {
    any: text('Any time', 'எந்த காலமும்'), today: text('Today', 'இன்று'), week: text('This week', 'இந்த வாரம்'),
    month: text('This month', 'இந்த மாதம்'), last_month: text('Last month', 'கடந்த மாதம்'),
    financial_year: text('This financial year', 'இந்த நிதியாண்டு'), custom: text('Custom range', 'தனிப்பயன் காலவரம்பு'),
  };

  const applyFilters = () => {
    setFilters(draft);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft));
    setMobileFiltersOpen(false);
  };
  const clearFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    sessionStorage.removeItem(SESSION_KEY);
    setMobileFiltersOpen(false);
  };
  const applyWithout = (key: 'status' | 'customer' | 'dateRange') => {
    const next = key === 'dateRange'
      ? { ...filters, dateRange: 'any' as DateRange, fromDate: '', toDate: '' }
      : { ...filters, [key]: 'all' };
    setFilters(next);
    setDraft(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };

  const { from, to } = resolveDateRange(filters);
  const filteredInvoices = useMemo(() => state.invoices.filter((invoice) => invoice.type === 'invoice'
    && (filters.status === 'all' || invoice.paymentStatus === filters.status)
    && (filters.customer === 'all' || invoice.customerId === filters.customer)
    && (!from || invoice.date >= from)
    && (!to || invoice.date <= to)), [filters.customer, filters.status, from, state.invoices, to]);
  const totalInvoices = filteredInvoices.filter((invoice) => invoice.paymentStatus !== 'cancelled');
  const metrics = calculateBillingMetrics({ invoices: filteredInvoices });
  const activeFilters = [filters.status !== 'all', filters.customer !== 'all', filters.dateRange !== 'any'].filter(Boolean).length;
  const customerName = state.customers.find((customer) => customer.id === filters.customer)?.name || text('All', 'அனைத்தும்');
  const totalSales = metrics.totalInvoiced;
  const totalReceived = metrics.totalCollected;
  const pieData = [
    { name: text('Received', 'வரவு'), value: totalReceived, color: '#10B981' },
    { name: text('Pending', 'வரவேண்டியது'), value: Math.max(0, totalSales - totalReceived), color: '#F59E0B' },
  ];
  const salesByMonth = totalInvoices.reduce<Record<string, number>>((acc, invoice) => {
    const month = invoice.date.substring(0, 7);
    acc[month] = (acc[month] || 0) + invoice.total;
    return acc;
  }, {});
  const barData = Object.keys(salesByMonth).sort().slice(-6).map((month) => ({ name: month, Sales: salesByMonth[month] }));

  const FilterFields = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? 'space-y-4' : 'contents'}>
      <label className="report-filter-field">
        <span>{text('Status', 'நிலை')}</span>
        <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} aria-label={text('Filter by status', 'நிலையின்படி வடிகட்டு')}>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="report-filter-field">
        <span>{text('Customer', 'வாடிக்கையாளர்')}</span>
        <select value={draft.customer} onChange={(event) => setDraft({ ...draft, customer: event.target.value })} aria-label={text('Filter by customer', 'வாடிக்கையாளரின்படி வடிகட்டு')}>
          <option value="all">{text('All customers', 'அனைத்து வாடிக்கையாளர்கள்')}</option>
          {state.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </label>
      <label className="report-filter-field">
        <span>{text('Date range', 'தேதி வரம்பு')}</span>
        <select value={draft.dateRange} onChange={(event) => setDraft({ ...draft, dateRange: event.target.value as DateRange, fromDate: '', toDate: '' })} aria-label={text('Filter by date range', 'தேதி வரம்பின்படி வடிகட்டு')}>
          {Object.entries(dateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {draft.dateRange === 'custom' ? (
        <div className={mobile ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : 'col-span-full grid grid-cols-2 gap-3'}>
          {([
            ['fromDate', text('From date', 'தொடக்க தேதி'), text('Select start date', 'தொடக்க தேதியைத் தேர்ந்தெடுக்கவும்')],
            ['toDate', text('To date', 'முடிவு தேதி'), text('Select end date', 'முடிவு தேதியைத் தேர்ந்தெடுக்கவும்')],
          ] as const).map(([key, label, placeholder]) => (
            <label key={key} className="report-filter-field">
              <span>{label}</span>
              <div className="report-date-input">
                <CalendarDays size={18} aria-hidden="true" />
                <input type="date" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} aria-label={label} data-placeholder={placeholder} />
                {draft[key] ? <button type="button" onClick={() => setDraft({ ...draft, [key]: '' })} aria-label={`${text('Clear', 'அழி')} ${label}`}><X size={16} /></button> : null}
              </div>
              {!draft[key] ? <small>{placeholder}</small> : null}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> {t('backToDashboard')}</Link>
        <h1 className="text-2xl font-bold text-stone-800">{t('reports')}</h1>
        <p className="mt-1 text-stone-500">{text('Overview of your business performance.', 'உங்கள் வியாபாரத்தின் அறிக்கை.')}</p>
      </div>

      <div className="hidden rounded-2xl border border-stone-200 bg-white p-4 md:block">
        <div className="grid items-end gap-3 md:grid-cols-[minmax(140px,.8fr)_minmax(180px,1.2fr)_minmax(180px,1fr)_auto]">
          <FilterFields />
          <div className="flex gap-2">
            <button type="button" onClick={applyFilters} className="report-primary-action">{text('Apply', 'பயன்படுத்து')}</button>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <button type="button" onClick={() => setMobileFiltersOpen((open) => !open)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-left" aria-expanded={mobileFiltersOpen} aria-controls="mobile-report-filters">
          <SlidersHorizontal size={19} className="text-emerald-700" />
          <span className="min-w-0 flex-1"><strong className="block text-sm text-stone-800">{text('Filters', 'வடிகட்டிகள்')}{activeFilters ? ` (${activeFilters})` : ''}</strong><span className="block truncate text-xs text-stone-500">{text('Status', 'நிலை')}: {statusLabels[filters.status]} · {text('Customer', 'வாடிக்கையாளர்')}: {customerName} · {text('Date', 'தேதி')}: {dateLabels[filters.dateRange]}</span></span>
          <ChevronDown size={18} className={`transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileFiltersOpen ? <div id="mobile-report-filters" className="report-filter-sheet mt-3 rounded-2xl border border-stone-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg"><FilterFields mobile /><div className="mt-5"><button type="button" onClick={applyFilters} className="report-primary-action w-full">{text('Apply Filters', 'வடிகட்டிகளைப் பயன்படுத்து')}</button></div></div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="mr-auto text-sm font-semibold text-stone-700">{filteredInvoices.length} {text(filteredInvoices.length === 1 ? 'record' : 'records', 'பதிவுகள்')}</span>
        {filters.status !== 'all' ? <button type="button" onClick={() => applyWithout('status')} className="report-filter-chip" aria-label={text(`Remove ${statusLabels[filters.status]} status filter`, `${statusLabels[filters.status]} நிலை வடிகட்டியை அகற்று`)}>{text('Status', 'நிலை')}: {statusLabels[filters.status]} <X size={14} aria-hidden="true" /></button> : null}
        {filters.customer !== 'all' ? <button type="button" onClick={() => applyWithout('customer')} className="report-filter-chip" aria-label={text(`Remove ${customerName} customer filter`, `${customerName} வாடிக்கையாளர் வடிகட்டியை அகற்று`)}>{text('Customer', 'வாடிக்கையாளர்')}: {customerName} <X size={14} aria-hidden="true" /></button> : null}
        {filters.dateRange !== 'any' ? <button type="button" onClick={() => applyWithout('dateRange')} className="report-filter-chip" aria-label={text('Remove date range filter', 'தேதி வரம்பு வடிகட்டியை அகற்று')}>{text('Date', 'தேதி')}: {dateLabels[filters.dateRange]} <X size={14} aria-hidden="true" /></button> : null}
        {activeFilters ? <button type="button" onClick={clearFilters} className="min-h-11 px-2 text-sm font-bold text-emerald-700">{text('Clear all', 'அனைத்தையும் அழி')}</button> : null}
      </div>

      {filteredInvoices.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center font-semibold text-stone-600">{text('No records match the selected filters.', 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளுடன் எந்தப் பதிவுகளும் பொருந்தவில்லை.')}</div> : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          [text('Total invoiced', 'மொத்த விலைப்பட்டியல்'), formatCurrency(metrics.totalInvoiced)], [text('Total collected', 'மொத்த வசூல்'), formatCurrency(metrics.totalCollected)],
          [text('Total outstanding', 'மொத்த நிலுவை'), formatCurrency(metrics.totalOutstanding)], [text('Overdue amount', 'காலாவதியான தொகை'), formatCurrency(metrics.overdueAmount)],
          [text('Paid invoices', 'செலுத்திய விலைப்பட்டியல்கள்'), String(metrics.paidInvoicesCount)], [text('Unpaid invoices', 'செலுத்தாத விலைப்பட்டியல்கள்'), String(metrics.unpaidInvoicesCount)],
          [text('Partially paid', 'பகுதி செலுத்தப்பட்டது'), String(metrics.partiallyPaidInvoicesCount)], [text('Overdue invoices', 'காலாவதியான விலைப்பட்டியல்கள்'), String(metrics.overdueInvoicesCount)],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm"><p className="mb-2 text-sm font-medium text-stone-500">{label}</p><h3 className="text-2xl font-bold tabular-nums text-stone-800">{value}</h3></div>)}
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{text('Calculation rule: quotations and delivery notes are never collected revenue. Cancelled invoices are excluded from invoiced and collectible totals.', 'கணக்கீட்டு விதி: விலைமதிப்பீடுகள் மற்றும் விநியோகக் குறிப்புகள் வசூலாக எண்ணப்படாது. ரத்து செய்யப்பட்ட விலைப்பட்டியல்கள் வருவாய் மற்றும் நிலுவையிலிருந்து விலக்கப்படும்.')}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-100 bg-white p-6 shadow-sm"><h3 className="mb-6 font-bold text-stone-800">{text('Payments Overview', 'வரவு சுருக்கம்')}</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><ChartTooltip formatter={(value: number) => formatCurrency(value)} /></PieChart></ResponsiveContainer></div><div className="mt-4 flex justify-center gap-6">{pieData.map((entry) => <div key={entry.name} className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} /><span className="text-sm text-stone-600">{entry.name}</span></div>)}</div></div>
        <div className="rounded-2xl border border-stone-100 bg-white p-6 shadow-sm"><h3 className="mb-6 font-bold text-stone-800">{text('Sales Trend', 'விற்பனை வரைபடம்')}</h3><div className="h-64">{barData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><BarChart data={barData}><XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} /><YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} /><ChartTooltip cursor={{ fill: '#f3f4f6' }} formatter={(value: number) => formatCurrency(value)} /><Bar dataKey="Sales" fill="#3B82F6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-stone-400">{text('Not enough data.', 'போதிய தரவுகள் இல்லை.')}</div>}</div></div>
      </div>
    </div>
  );
}
