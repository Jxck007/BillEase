import { format } from 'date-fns';
import { BusinessProfile, Customer, Invoice, Product, TemplateVisibilitySettings } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { withDefaultCustomerFieldVisibility } from '../lib/invoiceCustomerFields';
import {
  formatEstimateCopyTypeDisplay,
  getEstimateAmountInWords,
  getEstimateItemUnit,
  getEstimateLineAmount,
} from '../lib/estimateUtils';

type Props = {
  invoice: Invoice;
  profile?: BusinessProfile;
  customer?: Customer | null;
  products?: Product[];
  documentTitle: string;
  numberLabel: string;
  visibility?: Partial<TemplateVisibilitySettings>;
};

export default function QuotationEstimateTemplate({
  invoice,
  profile,
  customer,
  products = [],
  documentTitle,
  numberLabel,
  visibility: visibilityInput,
}: Props) {
  const company = profile || ({
    name: 'My Business',
    address: '-',
    gst: '-',
    email: '-',
    phone: '-',
    logo: '',
    bankDetails: '',
  } as BusinessProfile);

  const visibility = {
    logo: false,
    gstNumber: true,
    address: true,
    phoneEmail: true,
    hsnSac: true,
    taxBreakdown: false,
    signature: true,
    terms: true,
    discountColumn: true,
    qrCode: false,
    bankDetails: false,
    ...visibilityInput,
  };

  const customerVisibility = withDefaultCustomerFieldVisibility(invoice.customerFieldVisibility);
  const copyTypeLabel = formatEstimateCopyTypeDisplay(invoice.copyType);
  const amountInWords = getEstimateAmountInWords(invoice);
  const items = invoice.items || [];
  const hasDiscount = (invoice.discountTotal || 0) > 0;

  return (
    <div className="quotation-export-page mx-auto box-border w-[190mm] max-w-[190mm] bg-white p-[6mm] text-[10px] leading-tight text-black print:w-[190mm] print:max-w-[190mm] print:p-[5mm]">
      <div className="border-2 border-black">
        {/* ROW 1: Dedicated Title Row */}
        <div className="border-b-2 border-black py-2.5 text-center">
          <div className="text-[18px] font-black uppercase tracking-[0.2em]">{documentTitle}</div>
        </div>

        {/* ROW 2: Two Column Header */}
        <div className="grid grid-cols-12 border-b-2 border-black">
          {/* LEFT SIDE: Company Block */}
          <div className="col-span-6 border-r-2 border-black p-3 flex flex-col justify-center items-start gap-1.5">
            {visibility.logo && company.logo ? (
              <img src={company.logo} alt="company logo" className="h-10 w-10 object-contain border border-stone-200 rounded p-0.5" />
            ) : null}
            <div className="text-[14px] font-black uppercase leading-tight">{company.name}</div>
          </div>
          {/* RIGHT SIDE: Document Info Block */}
          <div className="col-span-6 flex flex-col justify-center p-3 text-right text-[10px] font-bold leading-normal">
            <div>Date: {invoice.date ? format(new Date(invoice.date), 'dd-MM-yyyy') : '-'}</div>
            <div>{numberLabel}: {invoice.invoiceNumber || '-'}</div>
            {copyTypeLabel ? <div className="text-[9px] font-black uppercase tracking-wide text-stone-600 mt-1">{copyTypeLabel}</div> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 border-b-2 border-black">
          <div className="min-h-32 border-r-2 border-black p-3">
            <div className="mb-2 text-[11px] font-black uppercase">From</div>
            <div className="space-y-0.5 text-[10px]">
              <div className="text-[12px] font-bold uppercase">{company.name}</div>
              {visibility.address && <div className="whitespace-pre-wrap">{company.address || '-'}</div>}
              {visibility.phoneEmail && company.phone && <div>Phone: {company.phone}</div>}
              {visibility.phoneEmail && company.email && <div>Email: {company.email}</div>}
              {visibility.gstNumber && <div>GSTIN: {company.gst || '-'}</div>}
            </div>
          </div>
          <div className="min-h-32 p-3">
            <div className="mb-2 text-[11px] font-black uppercase">To</div>
            <div className="space-y-0.5 text-[10px]">
              <div className="text-[12px] font-bold">{customer?.name || '-'}</div>
              {customerVisibility.address && customer?.address && <div className="whitespace-pre-wrap">{customer.address}</div>}
              {customerVisibility.phone && customer?.phone && <div>Phone: {customer.phone}</div>}
              {customerVisibility.email && customer?.email && <div>Email: {customer.email}</div>}
              {customerVisibility.gstNumber && customer?.gstNumber && <div>GSTIN: {customer.gstNumber}</div>}
            </div>
          </div>
        </div>

        <div className="border-b-2 border-black">
          <table className="w-full table-fixed border-collapse text-[9px]">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[24%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-r border-black px-1 py-1.5 text-center font-black">S.No</th>
                <th className="border-b border-r border-black px-1 py-1.5 text-left font-black">Description</th>
                <th className="border-b border-r border-black px-1 py-1.5 text-center font-black">HSN/SAC</th>
                <th className="border-b border-r border-black px-1 py-1.5 text-center font-black">Unit</th>
                <th className="border-b border-r border-black px-1 py-1.5 text-center font-black">Qty</th>
                <th className="border-b border-r border-black px-1 py-1.5 text-right font-black">Price</th>
                <th className="border-b border-r border-black px-1 py-1.5 text-center font-black">GST %</th>
                <th className="border-b border-black px-1 py-1.5 text-right font-black">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item, index) => (
                <tr key={item.id || `${index}`}>
                  <td className="border-r border-black px-1 py-1.5 text-center align-top">{index + 1}</td>
                  <td className="border-r border-black px-1 py-1.5 align-top break-words">
                    <div className="font-semibold">{item.name || item.description || '-'}</div>
                  </td>
                  <td className="border-r border-black px-1 py-1.5 text-center align-top break-words">{item.hsnSac || '-'}</td>
                  <td className="border-r border-black px-1 py-1.5 text-center align-top">{getEstimateItemUnit(item, products)}</td>
                  <td className="border-r border-black px-1 py-1.5 text-center align-top">{item.quantity}</td>
                  <td className="border-r border-black px-1 py-1.5 text-right align-top">{formatCurrency(item.price || 0)}</td>
                  <td className="border-r border-black px-1 py-1.5 text-center align-top">{typeof item.taxRate === 'number' ? `${item.taxRate}%` : '-'}</td>
                  <td className="px-1 py-1.5 text-right align-top font-semibold">{formatCurrency(getEstimateLineAmount(item))}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-2 py-4 text-center" colSpan={8}>No items added</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-12 border-b-2 border-black">
          <div className="col-span-7 border-r-2 border-black p-3">
            <div className="text-[11px] font-black uppercase">Amount in Words</div>
            <div className="mt-2 min-h-14 whitespace-pre-wrap text-[10px] italic leading-relaxed">{amountInWords}</div>
          </div>
          <div className="col-span-5 p-3">
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between gap-3"><span>Subtotal</span><span className="font-semibold">{formatCurrency(invoice.subtotal || 0)}</span></div>
              {hasDiscount && visibility.discountColumn && (
                <div className="flex justify-between gap-3"><span>Discount</span><span className="font-semibold">-{formatCurrency(invoice.discountTotal || 0)}</span></div>
              )}
              <div className="flex justify-between gap-3"><span>Tax</span><span className="font-semibold">{formatCurrency(invoice.taxTotal || 0)}</span></div>
              <div className="flex justify-between gap-3 border-t border-black pt-2 text-[11px] font-black">
                <span>Grand Total</span>
                <span>{formatCurrency(invoice.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {visibility.terms && (invoice.terms || '').trim() ? (
          <div className="border-b-2 border-black p-3">
            <div className="text-[11px] font-black uppercase">Declaration</div>
            <div className="mt-2 whitespace-pre-wrap text-[10px] leading-relaxed">{invoice.terms.trim()}</div>
          </div>
        ) : null}

        {visibility.signature ? (
          <div className="grid grid-cols-2">
            <div className="min-h-24 border-r-2 border-black p-3">
              <div className="text-[10px] font-semibold">Customer Signature</div>
              <div className="mt-10 border-t border-black pt-2 text-[9px]">{customer?.name || ''}</div>
            </div>
            <div className="min-h-24 p-3 text-right">
              <div className="text-[11px] font-black">Authorized Signature</div>
              <div className="mt-10 border-t border-black pt-2 text-[9px]">For {company.name}</div>
              <div className="mt-1 text-[9px]">{invoice.signatureName || 'Authorized Signatory'}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
