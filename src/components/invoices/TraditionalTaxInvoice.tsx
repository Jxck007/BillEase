import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { BusinessProfile, Customer, Invoice } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { withDefaultCustomerFieldVisibility } from '../../lib/invoiceCustomerFields';
import InvoiceAuthorizationAssets from '../documents/InvoiceAuthorizationAssets';
import { useLanguage } from '../../context/LanguageContext';

function numberToWordsIndian(num: number) {
  if (num === 0) return 'zero';
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const words = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ` ${a[n % 10]}` : '');
    if (n < 1000) return `${a[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ''}`;
    return '';
  };

  let n = Math.floor(num);
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  if (crore) { parts.push(`${words(crore)} crore`); n %= 10000000; }
  const lakh = Math.floor(n / 100000);
  if (lakh) { parts.push(`${words(lakh)} lakh`); n %= 100000; }
  const thousand = Math.floor(n / 1000);
  if (thousand) { parts.push(`${words(thousand)} thousand`); n %= 1000; }
  if (n) parts.push(words(n));
  return parts.join(' ');
}

function numberToWordsIndianTamil(num: number) {
  if (num === 0) return 'பூஜ்ஜியம்';
  const ones = ['', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது', 'பத்து', 'பதினொன்று', 'பன்னிரண்டு', 'பதின்மூன்று', 'பதினான்கு', 'பதினைந்து', 'பதினாறு', 'பதினேழு', 'பதினெட்டு', 'பத்தொன்பது'];
  const tens = ['', '', 'இருபது', 'முப்பது', 'நாற்பது', 'ஐம்பது', 'அறுபது', 'எழுபது', 'எண்பது', 'தொண்ணூறு'];
  const words = (value: number): string => {
    if (value < 20) return ones[value];
    if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`;
    if (value < 1000) return `${ones[Math.floor(value / 100)]} நூறு${value % 100 ? ` ${words(value % 100)}` : ''}`;
    return '';
  };
  let value = Math.floor(num);
  const parts: string[] = [];
  const crore = Math.floor(value / 10000000);
  if (crore) { parts.push(`${words(crore)} கோடி`); value %= 10000000; }
  const lakh = Math.floor(value / 100000);
  if (lakh) { parts.push(`${words(lakh)} லட்சம்`); value %= 100000; }
  const thousand = Math.floor(value / 1000);
  if (thousand) { parts.push(`${words(thousand)} ஆயிரம்`); value %= 1000; }
  if (value) parts.push(words(value));
  return parts.join(' ');
}

type Props = {
  invoice: Invoice;
  profile?: BusinessProfile;
  customer?: Customer | null;
  showQr?: boolean;
  copyLabel?: string;
};

function UpiPaymentQr({ invoice, profile }: { invoice: Invoice; profile: BusinessProfile }) {
  const { language } = useLanguage();
  const [image, setImage] = useState('');
  const amount = Math.max(0, invoice.total - invoice.amountPaid);
  const enabled = profile.enableUpiQr && profile.upiId?.trim() && profile.upiPayeeName?.trim();
  useEffect(() => {
    if (!enabled) { setImage(''); return; }
    const params = new URLSearchParams({ pa: profile.upiId!.trim(), pn: profile.upiPayeeName!.trim(), cu: 'INR', tn: `${invoice.invoiceNumber} ${profile.upiPaymentNote || ''}`.trim() });
    if (profile.showUpiAmount) params.set('am', amount.toFixed(2));
    let active = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(`upi://pay?${params.toString()}`, { width: 180, margin: 1, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => { if (active) setImage(dataUrl); })
      .catch(() => { if (active) setImage(''); });
    return () => { active = false; };
  }, [enabled, profile.upiId, profile.upiPayeeName, profile.upiPaymentNote, profile.showUpiAmount, invoice.invoiceNumber, amount]);
  if (!enabled || !image) return null;
  return <div className="tv-upi"><img src={image} alt={language === 'ta' ? 'UPI கட்டண QR' : 'Scan to pay by UPI'} className="tv-qr" /><div><strong>{language === 'ta' ? 'பணம் செலுத்த ஸ்கேன் செய்யவும்' : 'Scan to Pay'}</strong><br />UPI ID: {profile.upiId}<br />{language === 'ta' ? 'தொகை' : 'Amount'}: {formatCurrency(amount)}<br />{language === 'ta' ? 'விலைப்பட்டியல்' : 'Invoice'}: {invoice.invoiceNumber}</div></div>;
}

export function CanonicalInvoiceDocument({ invoice, profile, customer, showQr = true, copyLabel = '' }: Props) {
  const { language, t } = useLanguage();
  const seller = profile || ({
    name: 'My Business', address: '-', gst: '-', email: '-', phone: '-', logo: '', bankDetails: '-',
  } as BusinessProfile);
  const items = invoice.items || [];
  const amountInWords = language === 'ta'
    ? `${numberToWordsIndianTamil(Math.floor(invoice.total || 0))} ரூபாய் மட்டும்`
    : `${numberToWordsIndian(Math.floor(invoice.total || 0))} rupees only`;
  const isIGST = (invoice.igstTotal || 0) > 0;
  const hasDiscount = (invoice.discountTotal || 0) > 0;
  const customerVisibility = withDefaultCustomerFieldVisibility(invoice.customerFieldVisibility);
  const label = copyLabel || invoice.copyType || 'DUPLICATE COPY';

  return (
    <div className="invoice-print-page bg-white text-black">
      <div className="tv-container">
        <header className="tv-header">
          <div className="tv-title">{t('taxInvoice')}</div>
          <div className="tv-copy">{label}</div>
        </header>

        <section className="tv-seller">
          <div>
            <div className="seller-brand">
              {seller.logo ? <img src={seller.logo} alt="company logo" className="seller-logo" /> : null}
              <div className="seller-name">{seller.name}</div>
            </div>
            {seller.tagline ? <div className="seller-desc">{seller.tagline}</div> : null}
            <div className="seller-contact">GSTIN: {seller.gst || '-'}</div>
            {seller.msmeNumber ? <div className="seller-contact">MSME No: {seller.msmeNumber}</div> : null}
            <div className="seller-contact">{seller.address}</div>
            <div className="seller-contact">Email: {seller.email}</div>
            <div className="seller-contact">Cell: {seller.phone}</div>
          </div>
          <div className="tv-invoice-details">
            <table><tbody>
              <tr><td>{t('invoiceNo')}</td><td>:</td><td>{invoice.invoiceNumber || '-'}</td></tr>
              <tr><td>{t('date')}</td><td>:</td><td>{invoice.date ? format(new Date(invoice.date), 'dd/MM/yyyy') : '-'}</td></tr>
              {invoice.poNumber && <tr><td>P.O Number</td><td>:</td><td>{invoice.poNumber}</td></tr>}
              {invoice.poMode && <tr><td>P.O Mode</td><td>:</td><td>{invoice.poMode}</td></tr>}
              <tr><td>P.O Date</td><td>:</td><td>{invoice.poDate ? format(new Date(invoice.poDate), 'dd/MM/yyyy') : '-'}</td></tr>
            </tbody></table>
          </div>
        </section>

        <section className="tv-buyer">
          <div className="tv-sub">{t('buyer')}</div>
          <div className="buyer-name">{customer?.name || '-'}</div>
          {customerVisibility.address && <div className="buyer-contact">{customer?.address || '-'}</div>}
          {customerVisibility.phone && customer?.phone && <div className="buyer-contact">Phone: {customer.phone}</div>}
          {customerVisibility.email && customer?.email && <div className="buyer-contact">Email: {customer.email}</div>}
          {customerVisibility.gstNumber && <div className="buyer-contact">GSTIN: {customer?.gstNumber || '-'}</div>}
        </section>

        <section className="tv-table-wrap overflow-x-auto">
          <table className="tv-table">
            <thead><tr><th>{language === 'ta' ? 'வ.எண்' : 'SL No'}</th><th>{t('descriptionOfGoods')}</th><th>HSN/SAC</th><th>{t('quantity')}</th><th>{t('rate')}</th><th>{t('totalAmount')}</th></tr></thead>
            <tbody>
              {items.map((it, idx) => {
                const base = (it.quantity || 0) * (it.price || 0);
                const discount = it.discountType === 'flat' ? (it.discount || 0) : (base * (it.discount || 0)) / 100;
                const lineTotal = Math.max(0, base - discount);
                return <tr key={it.id || idx}><td className="tv-td-center">{idx + 1}</td><td>{it.name || '-'}</td><td className="tv-td-center">{it.hsnSac || '-'}</td><td className="tv-td-center">{it.quantity}</td><td className="tv-td-right">{formatCurrency(it.price || 0)}</td><td className="tv-td-right">{formatCurrency(lineTotal)}</td></tr>;
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={5} className="tv-td-right">{t('subtotal')}</td><td className="tv-td-right">{formatCurrency(invoice.subtotal || 0)}</td></tr>
              {!isIGST && <tr><td colSpan={5} className="tv-td-right">INPUT CGST @ 9%</td><td className="tv-td-right">{formatCurrency(invoice.cgstTotal || 0)}</td></tr>}
              {!isIGST && <tr><td colSpan={5} className="tv-td-right">INPUT SGST @ 9%</td><td className="tv-td-right">{formatCurrency(invoice.sgstTotal || 0)}</td></tr>}
              {isIGST && <tr><td colSpan={5} className="tv-td-right">IGST</td><td className="tv-td-right">{formatCurrency(invoice.igstTotal || 0)}</td></tr>}
              {hasDiscount && <tr><td colSpan={5} className="tv-td-right">{t('discount')}</td><td className="tv-td-right">-{formatCurrency(invoice.discountTotal || 0)}</td></tr>}
              {(invoice.roundOff || 0) !== 0 && <tr><td colSpan={5} className="tv-td-right">{language === 'ta' ? 'முழுமையாக்கம்' : 'Round Off'}</td><td className="tv-td-right">{formatCurrency(invoice.roundOff || 0)}</td></tr>}
              <tr><td colSpan={5} className="tv-td-right tv-total">{t('total')}</td><td className="tv-td-right tv-total">{formatCurrency(invoice.total || 0)}</td></tr>
            </tfoot>
          </table>
        </section>

        <section className="tv-bottom">
          <div className="tv-bank">
            <div className="tv-sub">{t('bankDetails')}</div>
            <pre className="bank-pre">{seller.bankDetails || '-'}</pre>
            {showQr && seller.qrCodeImage ? <img src={seller.qrCodeImage} alt="payment qr" className="tv-qr" /> : null}
            <UpiPaymentQr invoice={invoice} profile={seller} />
          </div>
          <div className="tv-right">
            <div className="tv-sub">E. & O.E</div>
            <div className="amount-words-label">{t('amountInWords')}</div>
            <div className="amount-words">{amountInWords}</div>
            <div className="signature authorization-block">
              <InvoiceAuthorizationAssets />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default CanonicalInvoiceDocument;
