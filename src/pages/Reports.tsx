import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

export default function Reports() {
  const { state } = useData();
  const { t, language } = useLanguage();

  const totalInvoices = state.invoices.filter(i => i.type === 'invoice');
  
  const totalSales = totalInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalReceived = state.payments.reduce((sum, p) => sum + p.amount, 0);
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
        <h1 className="text-2xl font-bold text-stone-800">{t('reports')}</h1>
        <p className="text-stone-500 mt-1">
          {language === 'en' ? 'Overview of your business performance.' : 'உங்கள் வியாபாரத்தின் அறிக்கை.'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
           <p className="text-sm font-medium text-stone-500 mb-2">{language === 'en' ? 'Total Billed' : 'மொத்த பில்'}</p>
           <h3 className="text-2xl font-bold text-stone-800">{formatCurrency(totalSales)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100">
           <p className="text-sm font-medium text-green-600 mb-2">{language === 'en' ? 'Total Received' : 'மொத்த வரவு'}</p>
           <h3 className="text-2xl font-bold text-green-700">{formatCurrency(totalReceived)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
           <p className="text-sm font-medium text-red-600 mb-2">{language === 'en' ? 'Total Expenses' : 'மொத்த செலவு'}</p>
           <h3 className="text-2xl font-bold text-red-700">{formatCurrency(totalExpenses)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
           <p className="text-sm font-medium text-emerald-600 mb-2">{language === 'en' ? 'Net Earnings' : 'நிகர லாபம் / பணம்'}</p>
           <h3 className="text-2xl font-bold text-emerald-700">{formatCurrency(netEarnings)}</h3>
        </div>
      </div>

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
