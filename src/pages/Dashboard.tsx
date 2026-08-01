import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, FilePlus2, FileText, ReceiptText, Truck, UserPlus, Users,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import { calculateBillingMetrics } from '../services/paymentService';

export default function Dashboard() {
  const { state } = useData();
  const { language, t } = useLanguage();

  const summary = useMemo(() => {
    const now = new Date();
    const thisMonth = (value: string) => {
      const date = new Date(value);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    };
    const invoices = state.invoices.filter((document) => document.type === 'invoice');
    const quotations = state.invoices.filter((document) => document.type === 'estimate');
    const monthlyInvoices = invoices.filter((document) => thisMonth(document.date || document.createdAt));
    const metrics = calculateBillingMetrics(state);
    const customerName = (id: string) => state.customers.find((customer) => customer.id === id)?.name
      || state.invoices.find((document) => document.customerId === id)?.customerSnapshot?.name
      || state.deliveryNotes.find((document) => document.customerId === id)?.customerSnapshot?.name
      || (language === 'ta' ? 'தெரியாத வாடிக்கையாளர்' : 'Unknown customer');
    const recentDocuments = [
      ...state.invoices.map((document) => ({
        id: document.id,
        label: document.type === 'estimate'
          ? `${language === 'ta' ? 'விலைமதிப்பீடு' : 'Quotation'} ${document.invoiceNumber}`
          : `${language === 'ta' ? 'விலைப்பட்டியல்' : 'Invoice'} ${document.invoiceNumber}`,
        customer: customerName(document.customerId),
        date: document.date || document.createdAt,
        total: document.total,
        to: `/${document.type === 'estimate' ? 'estimates' : 'invoices'}/${document.id}`,
      })),
      ...state.deliveryNotes.map((document) => ({
        id: document.id,
        label: `${language === 'ta' ? 'விநியோகக் குறிப்பு' : 'Delivery Note'} ${document.deliveryNoteNumber || document.dnNumber || ''}`,
        customer: customerName(document.customerId),
        date: document.date || document.createdAt,
        total: document.total || document.approximateValue || 0,
        to: `/delivery-notes/${document.id}`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

    return {
      revenue: monthlyInvoices.reduce((total, invoice) => total + invoice.total, 0),
      invoiceCount: monthlyInvoices.length,
      pendingQuotations: quotations.filter((quotation) => quotation.status !== 'paid').length,
      outstanding: invoices.reduce((total, invoice) => total + Math.max(0, invoice.total - invoice.amountPaid), 0),
      metrics,
      recentDocuments,
      recentCustomers: [...state.customers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    };
  }, [language, state.customers, state.deliveryNotes, state.invoices]);

  const actions = [
    { to: '/invoices/new', label: t('newInvoice'), hint: language === 'ta' ? 'வரி விலைப்பட்டியல் உருவாக்கு' : 'Create a tax invoice', icon: FilePlus2, tone: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { to: '/estimates/new', label: t('newQuotation'), hint: language === 'ta' ? 'விலைமதிப்பீடு தயாரி' : 'Prepare a price quote', icon: ReceiptText, tone: 'bg-white hover:bg-stone-50 text-stone-900 border border-stone-300' },
    { to: '/delivery-notes/new', label: t('newDeliveryNote'), hint: language === 'ta' ? 'அனுப்பிய பொருட்களைப் பதிவு செய்' : 'Record goods sent', icon: Truck, tone: 'bg-white hover:bg-stone-50 text-stone-900 border border-stone-300' },
    { to: '/customers?add=1', label: t('addCustomer'), hint: language === 'ta' ? 'வாடிக்கையாளரைச் சேமி' : 'Save a customer', icon: UserPlus, tone: 'bg-white hover:bg-stone-50 text-stone-900 border border-stone-300' },
  ];

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-emerald-700">{language === 'ta' ? 'வணிகக் கட்டுப்பாட்டு மையம்' : 'Business command center'}</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">{language === 'ta' ? 'நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?' : 'What would you like to do?'}</h1>
        <p className="mt-2 text-stone-600">{language === 'ta' ? 'கீழே ஒரு பணியைத் தேர்ந்தெடுக்கவும் அல்லது சமீபத்திய வணிகச் செயல்பாட்டைப் பார்க்கவும்.' : 'Choose a task below, or review your latest business activity.'}</p>
      </header>

      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="sr-only">{language === 'ta' ? 'விரைவு செயல்கள்' : 'Quick actions'}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map(({ to, label, hint, icon: Icon, tone }) => (
            <Link key={to} to={to} className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ${tone}`}>
              <Icon size={25} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">{label}</span>
                <span className="block text-xs opacity-75">{hint}</span>
              </span>
              <ArrowRight size={19} className="shrink-0 opacity-60" />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Business summary">
        {[
          [language === 'ta' ? 'மொத்த விலைப்பட்டியல்' : 'Total invoiced', formatCurrency(summary.metrics.totalInvoiced)],
          [language === 'ta' ? 'மொத்த வசூல்' : 'Total collected', formatCurrency(summary.metrics.totalCollected)],
          [language === 'ta' ? 'மொத்த நிலுவை' : 'Total outstanding', formatCurrency(summary.metrics.totalOutstanding)],
          [language === 'ta' ? 'காலாவதியான தொகை' : 'Overdue amount', formatCurrency(summary.metrics.overdueAmount)],
          [language === 'ta' ? 'செலுத்தியவை' : 'Paid invoices', summary.metrics.paidInvoicesCount.toString()],
          [language === 'ta' ? 'செலுத்தாதவை' : 'Unpaid invoices', summary.metrics.unpaidInvoicesCount.toString()],
          [language === 'ta' ? 'பகுதி செலுத்தியவை' : 'Partially paid', summary.metrics.partiallyPaidInvoicesCount.toString()],
          [language === 'ta' ? 'காலாவதியானவை' : 'Overdue invoices', summary.metrics.overdueInvoicesCount.toString()],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold text-stone-500 sm:text-sm">{label}</p>
            <p className="mt-2 break-words text-xl font-bold text-stone-900 sm:text-2xl">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.8fr)]">
        <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-bold text-stone-900">{language === 'ta' ? 'சமீபத்திய ஆவணங்கள்' : 'Recent documents'}</h2>
              <p className="text-xs text-stone-500">{language === 'ta' ? 'விலைப்பட்டியல்கள், விலைமதிப்பீடுகள் மற்றும் விநியோகக் குறிப்புகள்' : 'Invoices, quotations and delivery notes'}</p>
            </div>
            <Link to="/invoices" className="min-h-12 px-2 py-3 text-sm font-semibold text-emerald-700">{language === 'ta' ? 'பதிவுகளைப் பார்' : 'View records'}</Link>
          </div>
          {summary.recentDocuments.length ? (
            <div className="divide-y divide-stone-100">
              {summary.recentDocuments.map((document) => (
                <Link key={`${document.to}-${document.id}`} to={document.to} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone-50 sm:px-5">
                  <FileText size={20} className="shrink-0 text-stone-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-900">{document.label}</span>
                    <span className="block truncate text-xs text-stone-500">{document.customer} · {new Date(document.date).toLocaleDateString()}</span>
                  </span>
                  {document.total > 0 && <span className="text-sm font-bold text-stone-800">{formatCurrency(document.total)}</span>}
                </Link>
              ))}
            </div>
          ) : <EmptyMessage text={language === 'ta' ? 'ஆவணங்கள் இல்லை. மேலே உங்கள் முதல் விலைப்பட்டியலை உருவாக்கவும்.' : 'No documents yet. Create your first invoice above.'} />}
        </article>

        <div className="space-y-5">
          <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <h2 className="font-bold text-stone-900">{language === 'ta' ? 'சமீபத்திய வாடிக்கையாளர்கள்' : 'Recent customers'}</h2>
              <Link to="/customers" className="text-sm font-semibold text-emerald-700">{language === 'ta' ? 'அனைத்தையும் பார்' : 'View all'}</Link>
            </div>
            {summary.recentCustomers.length ? summary.recentCustomers.map((customer) => (
              <Link key={customer.id} to={`/customers?customer=${encodeURIComponent(customer.id)}`} className="flex min-h-14 items-center gap-3 border-b border-stone-100 px-5 py-3 last:border-0 hover:bg-stone-50">
                <Users size={18} className="text-stone-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{customer.name}</span>
                  <span className="block truncate text-xs text-stone-500">{customer.phone || (language === 'ta' ? 'தொலைபேசி எண் இல்லை' : 'No phone number')}</span>
                </span>
              </Link>
            )) : <EmptyMessage text={language === 'ta' ? 'வாடிக்கையாளர்கள் இன்னும் சேமிக்கப்படவில்லை.' : 'No customers saved yet.'} />}
          </article>
        </div>
      </section>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-stone-500">{text}</p>;
}
