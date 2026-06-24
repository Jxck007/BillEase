import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../lib/utils';
import { FileText, Users, CreditCard, PiggyBank, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { state } = useData();
  const { t, language } = useLanguage();

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate stats
  const totalInvoices = state.invoices.length;
  const unpaidInvoices = state.invoices.filter(i => i.status !== 'paid');
  const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);
  const todaySales = state.invoices
                       .filter(i => i.createdAt.startsWith(todayStr))
                       .reduce((sum, inv) => sum + inv.total, 0);
  const recentAuditLogs = state.auditLogs.slice(-4).reverse();

  const stats = [
    {
      title: t('todaySales'),
      value: formatCurrency(todaySales),
      icon: CreditCard,
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: t('unpaidInvoices'),
      value: formatCurrency(unpaidAmount),
      subtitle: `${unpaidInvoices.length} bills pending`,
      icon: FileText,
      color: 'bg-rose-100 text-rose-700',
    },
    {
      title: t('totalCustomers'),
      value: state.customers.length.toString(),
      icon: Users,
      color: 'bg-emerald-100 text-emerald-700',
    }
  ];

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{language === 'en' ? 'Today / இன்று' : 'இன்றைய விற்பனை'}</p>
          <h3 className="text-2xl font-black mt-1">{formatCurrency(todaySales)}</h3>
          <p className="text-xs text-stone-400 mt-2">{state.invoices.filter(i => i.createdAt.startsWith(todayStr)).length} orders today</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{t('unpaidInvoices')}</p>
          <h3 className="text-2xl font-black mt-1 text-rose-500">{formatCurrency(unpaidAmount)}</h3>
          <p className="text-xs text-stone-400 mt-2">{unpaidInvoices.length} pending bills</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{t('totalCustomers')}</p>
          <h3 className="text-2xl font-black mt-1">{state.customers.length}</h3>
          <p className="text-xs text-stone-400 mt-2">Saved contacts</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Items Sold / பொருட்கள்</p>
          <h3 className="text-2xl font-black mt-1">{state.products.length}</h3>
          <p className="text-xs text-stone-400 mt-2">Products listed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 flex-1 lg:grid-cols-12">
        {/* Recent Activity Table */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col">
          <div className="p-6 border-b border-stone-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-stone-800">Recent Invoices</h3>
              <p className="text-xs text-stone-400 uppercase tracking-wide font-medium">சமீபத்திய பில்கள்</p>
            </div>
            <Link to="/invoices" className="text-emerald-600 text-xs font-bold hover:underline">See All / அனைத்தையும் பார்</Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            {state.invoices.length > 0 ? (
              <table className="w-full min-w-[400px] md:min-w-[500px] text-left">
                <thead>
                  <tr className="bg-stone-50 text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                    <th className="px-6 py-3">Inv # / எண்</th>
                    <th className="px-6 py-3">Customer / பெயர்</th>
                    <th className="px-6 py-3 text-right">Amount / தொகை</th>
                    <th className="px-6 py-3">Status / நிலை</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {state.invoices.slice(-5).reverse().map(inv => (
                    <tr key={inv.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4 font-mono">#{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 font-medium">
                        {state.customers.find(c => c.id === inv.customerId)?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold">{formatCurrency(inv.total)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {t(inv.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-stone-500 text-sm">
                {language === 'en' ? 'No recent bills found.' : 'சமீபத்திய பில்கள் ஏதும் இல்லை.'}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Helpers */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-emerald-700 rounded-3xl p-6 text-white shadow-xl flex flex-col flex-1 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold leading-tight">Quick Actions</h4>
                  <p className="text-xs text-white/70">விரைவு செயல்பாடுகள்</p>
                </div>
              </div>
              <div className="space-y-2">
                <Link to="/invoices/new" className="flex items-center gap-3 bg-white/10 p-4 rounded-xl hover:bg-white/20 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">INV</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">New Invoice</p>
                    <p className="text-[10px] text-white/70 truncate">Create a bill instantly</p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link to="/estimates/new" className="flex items-center gap-3 bg-white/10 p-4 rounded-xl hover:bg-white/20 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">EST</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">New Quotation</p>
                    <p className="text-[10px] text-white/70 truncate">Send pricing quotes</p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link to="/delivery-notes/new" className="flex items-center gap-3 bg-white/10 p-4 rounded-xl hover:bg-white/20 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">DN</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">New Delivery Note</p>
                    <p className="text-[10px] text-white/70 truncate">Transport documents</p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                </Link>
                <div className="border-t border-white/10 pt-2 mt-2">
                  <Link to="/customers" className="flex items-center gap-3 bg-white/10 p-4 rounded-xl hover:bg-white/20 transition-colors group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">CU</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Customers</p>
                      <p className="text-[10px] text-white/70 truncate">Manage contacts</p>
                    </div>
                    <ArrowRight size={16} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link to="/products" className="flex items-center gap-3 bg-white/10 p-4 rounded-xl hover:bg-white/20 transition-colors group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">PR</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Products</p>
                      <p className="text-[10px] text-white/70 truncate">Manage items</p>
                    </div>
                    <ArrowRight size={16} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link to="/payments" className="flex items-center gap-3 bg-white/10 p-4 rounded-xl hover:bg-white/20 transition-colors group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">$</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Record Payment</p>
                      <p className="text-[10px] text-white/70 truncate">Update pending bills</p>
                    </div>
                    <ArrowRight size={16} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Background design elements */}
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl"></div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
            <h4 className="font-bold text-stone-800 mb-2">Recent Activity</h4>
            <div className="space-y-3 text-sm">
              {recentAuditLogs.length > 0 ? recentAuditLogs.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-stone-50 p-3">
                  <p className="font-semibold text-stone-800">{entry.message}</p>
                  <p className="text-xs text-stone-500 mt-1">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              )) : (
                <p className="text-stone-500 text-sm">{language === 'en' ? 'No audit activity yet.' : 'இன்னும் activity இல்லை.'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
