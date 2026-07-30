import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { calculateBillingMetrics } from '../services/paymentService';
import { useState } from 'react';

export default function Reports() {
  const { state } = useData();
  const { t, language } = useLanguage();
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredInvoices = state.invoices.filter((invoice) => invoice.type === 'invoice'
    && (statusFilter === 'all' || invoice.paymentStatus === statusFilter)
    && (customerFilter === 'all' || invoice.customerId === customerFilter)
    && (!fromDate || invoice.date >= fromDate)
    && (!toDate || invoice.date <= toDate));
  const totalInvoices = filteredInvoices.filter((invoice) => invoice.paymentStatus !== 'cancelled');
  const metrics = calculateBillingMetrics({ invoices: filteredInvoices });
  const totalSales = metrics.totalInvoiced;
  const totalReceived = metrics.totalCollected;
  const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = totalReceived - totalExpenses;

  const pieData = [
    { name: language === 'en' ? 'Received' : 'வரவு', value: totalReceived, color: '#10B981' }, // green-500
    { name: language === 'en' ? 'Pending' : 'வரவேண்டியது', value: Math.max(0, totalSales - totalReceived), color: '#F59E0B' }, // amber-500
  ];

  // Group sales by month (simple format)
  const salesByMonth = totalInvoices.reduce((acc: any, inv) => {
    const month = inv.date.substring(0, 7); // yyyy-mm
    if (!acc[month]) acc[month] = 0;
    acc[month] += inv.total;
    return acc;
  }, {});

  const barData = Object.keys(salesByMonth).sort().slice(-6).map(month => ({
    name: month,
    Sales: salesByMonth[month],
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={18} /> Back to Dashboard</Link>
        <h1 className="text-2xl font-bold text-stone-800">{t('reports')}</h1>
        <p className="text-stone-500 mt-1">
          {language === 'en' ? 'Overview of your business performance.' : 'உங்கள் வியாபாரத்தின் அறிக்கை.'}
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border p-3"><option value="all">All statuses</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="partially_paid">Partially Paid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option></select>
        <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="rounded-xl border p-3"><option value="all">All customers</option>{state.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Report from date" className="rounded-xl border p-3" />
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Report to date" className="rounded-xl border p-3" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          [language === 'en' ? 'Total invoiced' : 'மொத்த விலைப்பட்டியல்', formatCurrency(metrics.totalInvoiced)],
          [language === 'en' ? 'Total collected' : 'மொத்த வசூல்', formatCurrency(metrics.totalCollected)],
          [language === 'en' ? 'Total outstanding' : 'மொத்த நிலுவை', formatCurrency(metrics.totalOutstanding)],
          [language === 'en' ? 'Overdue amount' : 'காலாவதியான தொகை', formatCurrency(metrics.overdueAmount)],
          [language === 'en' ? 'Paid invoices' : 'செலுத்திய விலைப்பட்டியல்கள்', String(metrics.paidInvoicesCount)],
          [language === 'en' ? 'Unpaid invoices' : 'செலுத்தாத விலைப்பட்டியல்கள்', String(metrics.unpaidInvoicesCount)],
          [language === 'en' ? 'Partially paid' : 'பகுதி செலுத்தப்பட்டது', String(metrics.partiallyPaidInvoicesCount)],
          [language === 'en' ? 'Overdue invoices' : 'காலாவதியான விலைப்பட்டியல்கள்', String(metrics.overdueInvoicesCount)],
        ].map(([label, value]) => <div key={label} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100"><p className="text-sm font-medium text-stone-500 mb-2">{label}</p><h3 className="text-2xl font-bold text-stone-800">{value}</h3></div>)}
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{language === 'ta' ? 'கணக்கீட்டு விதி: விலைமதிப்பீடுகள் மற்றும் விநியோகக் குறிப்புகள் வசூலாக எண்ணப்படாது. ரத்து செய்யப்பட்ட விலைப்பட்டியல்கள் வருவாய் மற்றும் நிலுவையிலிருந்து விலக்கப்படும்.' : 'Calculation rule: quotations and delivery notes are never collected revenue. Cancelled invoices are excluded from invoiced and collectible totals.'}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-bold text-stone-800 mb-6">{language === 'en' ? 'Payments Overview' : 'வரவு சுருக்கம்'}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
             {pieData.map(d => (
               <div key={d.name} className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                 <span className="text-sm text-stone-600">{d.name}</span>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-bold text-stone-800 mb-6">{language === 'en' ? 'Sales Trend' : 'விற்பனை வரைபடம்'}</h3>
          <div className="h-64">
             {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                    <ChartTooltip cursor={{fill: '#f3f4f6'}} formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="Sales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-stone-400">
                  {language === 'en' ? 'Not enough data.' : 'போதிய தரவுகள் இல்லை.'}
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
