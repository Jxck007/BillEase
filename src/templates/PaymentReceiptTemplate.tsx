import { format } from 'date-fns';
import type { BusinessProfile, Customer, Invoice, Payment } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import InvoiceAuthorizationAssets from '../components/documents/InvoiceAuthorizationAssets';
import ComputerGeneratedFooter from '../components/documents/ComputerGeneratedFooter';
import { useLanguage } from '../context/LanguageContext';

export default function PaymentReceiptTemplate({ payment, invoice, profile, customer }: { payment: Payment; invoice: Invoice; profile: BusinessProfile; customer?: Customer | null }) {
  const { language } = useLanguage();
  const text = (en: string, ta: string) => language === 'ta' ? ta : en;
  return (
    <div className="receipt-print-page flex min-h-[277mm] flex-col border-2 border-black bg-white p-5 text-[12px] text-black">
      <header className="border-b-2 border-black pb-4 text-center">
        <h1 className="text-[20px] font-black uppercase tracking-[.18em]">{text('Payment Receipt', 'கட்டண ரசீது')}</h1>
        <p className="mt-2 text-[16px] font-black">{profile.name}</p>
        <p className="whitespace-pre-wrap">{profile.address}</p>
        <p>{profile.phone} · {profile.email}</p>
      </header>
      <main className="pt-8">
        <div className="grid grid-cols-2 gap-4 rounded border border-black p-4">
          <div><span className="text-stone-600">{text('Receipt number', 'ரசீது எண்')}</span><strong className="mt-1 block">R-{payment.id}</strong></div>
          <div className="text-right"><span className="text-stone-600">{text('Payment date', 'கட்டண தேதி')}</span><strong className="mt-1 block">{format(new Date(payment.paidAt), 'dd MMM yyyy')}</strong></div>
          <div><span className="text-stone-600">{text('Invoice number', 'விலைப்பட்டியல் எண்')}</span><strong className="mt-1 block">{invoice.invoiceNumber}</strong></div>
          <div className="text-right"><span className="text-stone-600">{text('Customer', 'வாடிக்கையாளர்')}</span><strong className="mt-1 block">{customer?.name || invoice.customerSnapshot?.name || '-'}</strong></div>
        </div>
        <div className="my-8 rounded border-2 border-black p-6 text-center">
          <p className="text-stone-600">{text('Amount received', 'பெறப்பட்ட தொகை')}</p>
          <p className="mt-2 text-[28px] font-black">{formatCurrency(payment.amount)}</p>
        </div>
        <dl className="mx-auto max-w-md divide-y border-y">
          <div className="flex justify-between p-3"><dt>{text('Payment method', 'கட்டண முறை')}</dt><dd className="font-bold">{payment.method}</dd></div>
          <div className="flex justify-between p-3"><dt>{text('Payment reference', 'கட்டண குறிப்பு')}</dt><dd className="font-bold">{payment.reference || '—'}</dd></div>
          <div className="flex justify-between p-3"><dt>{text('Remaining balance', 'மீதமுள்ள நிலுவை')}</dt><dd className="font-bold">{formatCurrency(invoice.balanceDue)}</dd></div>
        </dl>
      </main>
      <div className="flex-1" aria-hidden="true" />
      <div className="receipt-authorization-group">
        <div className="document-final-section ml-auto w-[90mm]"><InvoiceAuthorizationAssets documentType="invoice" /></div>
        <ComputerGeneratedFooter />
      </div>
    </div>
  );
}
