import { format } from 'date-fns';
import InvoiceAuthorizationAssets from '../components/documents/InvoiceAuthorizationAssets';
import { BusinessProfile, Customer, DeliveryNote } from '../lib/types';
import { formatDeliveryNoteCopyTypeDisplay, getCustomerGstin, normalizeTransportPurpose } from '../lib/deliveryNoteUtils';

type Props = {
  note: DeliveryNote;
  profile?: BusinessProfile;
  customer?: Customer;
};

function extractSerialNumber(note: DeliveryNote) {
  const source = String(note.dnNumber || note.deliveryNoteNumber || '').trim();
  const parts = source.split('/');
  const tail = parts[parts.length - 1] || source;
  const digits = tail.replace(/\D/g, '');
  if (!digits) return source || '-';
  return digits.slice(-3).padStart(3, '0');
}

function formatApproximateValue(value: number) {
  const numberValue = Number(value || 0);
  return `₹${numberValue.toFixed(0)}/-`;
}

function CheckboxLine({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[12px] leading-none">{checked ? '☑' : '☐'}</span>
      <span>{label}</span>
    </div>
  );
}

export default function IndustrialDeliveryNoteTemplate({ note, profile, customer }: Props) {
  const company = profile || ({
    name: 'My Business',
    address: '-',
    gst: '-',
    email: '-',
    phone: '-',
    stateCode: '33',
    logo: '',
    bankDetails: '',
  } as BusinessProfile);

  const serialNumber = extractSerialNumber(note);
  const copyTypeLabel = formatDeliveryNoteCopyTypeDisplay(note.copyType);
  const customerGstin = getCustomerGstin(customer);
  const transportPurpose = normalizeTransportPurpose(note.transportPurpose || '');
  const consigneeBlock = [
    customer?.name || '-',
    customer?.address || '-',
    `GSTIN: ${customerGstin || '-'}`,
  ].join('\n');

  return (
    <div className="dn-export-page mx-auto box-border w-[210mm] max-w-[210mm] bg-white p-[8mm] text-[11px] leading-tight text-black print:w-[210mm] print:max-w-[210mm] print:p-[6mm]" data-export-root="true">
      <div className="border-2 border-black">
        <div className="border-b-2 border-black px-3 py-2 text-center">
          <div className="text-[18px] font-black tracking-[0.24em]">DELIVERY NOTE</div>
          <div className="mt-1 text-[22px] font-black uppercase leading-tight">{company.name}</div>
        </div>

        <div className="grid grid-cols-12 border-b-2 border-black">
          <div className="col-span-8 border-r-2 border-black p-3">
            <div className="text-[11px] font-semibold">GST No: <span className="font-normal">{company.gst || '-'}</span></div>
            <div className="mt-1 text-[11px] font-semibold">Address: <span className="font-normal whitespace-pre-wrap">{company.address || '-'}</span></div>
            <div className="mt-1 text-[11px] font-semibold">Phone: <span className="font-normal">{company.phone || '-'}</span></div>
          </div>
          <div className="col-span-4 flex flex-col p-0">
            <div className="border-b border-black px-2 py-2 text-right">
              <div className="text-[10px] font-black uppercase leading-snug tracking-wide">{copyTypeLabel}</div>
            </div>
            <div className="flex flex-1 flex-col justify-center px-2 py-2 text-right text-[11px] font-bold leading-relaxed">
              <div>SL NO: {serialNumber}</div>
              <div>DATE: {format(new Date(note.date), 'dd-MM-yyyy')}</div>
            </div>
          </div>
        </div>

        <div className="border-b-2 border-black p-3">
          <div className="mb-2 text-[12px] font-black uppercase">Name and Address of the Consignee</div>
          <div className="min-h-20 border border-black p-2 whitespace-pre-wrap">
            {consigneeBlock}
          </div>
        </div>

        <div className="border-b-2 border-black p-3">
          <div className="mb-2 text-[12px] font-black uppercase">Particulars of Place</div>
          <div className="border border-black p-2 text-[11px]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-semibold">(a) From where goods are consigned</div>
                <div className="mt-2 border border-black p-2 min-h-10 whitespace-pre-wrap">{note.fromPlace || '-'}</div>
              </div>
              <div>
                <div className="font-semibold">(b) To which goods are consigned</div>
                <div className="mt-2 border border-black p-2 min-h-10 whitespace-pre-wrap">{note.toPlace || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b-2 border-black">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border-b border-r border-black px-2 py-2 text-left font-black">Sl No</th>
                <th className="border-b border-r border-black px-2 py-2 text-left font-black">Description of Goods / Service</th>
                <th className="border-b border-r border-black px-2 py-2 text-center font-black">HSN / SAC Code</th>
                <th className="border-b border-r border-black px-2 py-2 text-center font-black">Rate of Tax %</th>
                <th className="border-b border-r border-black px-2 py-2 text-center font-black">Quantity</th>
                <th className="border-b border-black px-2 py-2 text-left font-black">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {note.items.length > 0 ? (
                note.items.map((item, index) => (
                  <tr key={item.id || `${index}`}>
                    <td className="border-r border-black px-2 py-2 align-top text-center">{index + 1}</td>
                    <td className="border-r border-black px-2 py-2 align-top">{item.description || item.name || '-'}</td>
                    <td className="border-r border-black px-2 py-2 align-top text-center">{item.hsnSac || '-'}</td>
                    <td className="border-r border-black px-2 py-2 align-top text-center">{typeof item.taxRate === 'number' ? `${item.taxRate}%` : '-'}</td>
                    <td className="border-r border-black px-2 py-2 align-top text-center">{item.quantity || '-'}</td>
                    <td className="px-2 py-2 align-top">{item.remarks || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-2 py-3 text-center" colSpan={6}>No goods added</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-12 border-b-2 border-black">
          <div className="col-span-6 border-r-2 border-black p-3">
            <div className="text-[12px] font-black uppercase">Approximate Value</div>
            <div className="mt-1 text-[15px] font-black">{formatApproximateValue(note.approximateValue || 0)}</div>
          </div>
          <div className="col-span-6 p-3">
            <div className="text-[12px] font-black uppercase">Purpose of Transport</div>
            <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
              {['Sale', 'Purchase', 'Shipment', 'Branch Office', 'Cutting', 'Labour Work', 'Other'].map((purpose) => (
                <CheckboxLine key={purpose} checked={transportPurpose === purpose} label={purpose} />
              ))}
            </div>
          </div>
        </div>

        <div className="border-b-2 border-black p-3">
          <div className="text-[12px] font-black">To Whom Delivered For Transport &amp; Vehicle No</div>
          <div className="mt-2 text-[12px]">Vehicle Number: <span className="font-bold uppercase">{note.vehicleNumber || '-'}</span></div>
        </div>

        <div className="grid grid-cols-2">
          <div className="min-h-24 border-r-2 border-black p-3">
            <div className="text-[11px] font-semibold">Received the above goods in order and condition</div>
            <div className="mt-8 text-[11px]">Name and Signature of the person to whom goods are delivered</div>
          </div>
          <div className="min-h-24 p-3 text-right">
            <div className="text-[12px] font-black">For {company.name}</div>
            <InvoiceAuthorizationAssets documentType="deliveryNote" />
          </div>
        </div>
      </div>
    </div>
  );
}
