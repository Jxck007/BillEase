import { DeliveryNote, BusinessProfile, Customer } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';

type Props = {
  note: DeliveryNote;
  profile?: BusinessProfile;
  customer?: Customer;
};

export default function DeliveryNotePrint({ note, profile, customer }: Props) {
  const seller = profile || {
    name: 'My Business',
    address: '-',
    gst: '-',
    email: '-',
    phone: '-',
    stateCode: '33',
    logo: '',
    bankDetails: `Indian Overseas Bank\nA/C No: 19360200000694\nIFSC Code: IORA0001936`,
  } as BusinessProfile;

  const hasTax = (note.taxTotal || 0) > 0;

  return (
    <div className="dn-print-page">
      <div className="dn-container">
        {/* Header */}
        <header className="dn-header">
          <div className="dn-title">DELIVERY NOTE</div>
          <div className="dn-copy">{note.copyType}</div>
        </header>

        {/* Seller & Delivery Note Details */}
        <section className="dn-seller-section">
          <div className="dn-seller-left">
            <div className="seller-name">{seller.name}</div>
            <div className="seller-contact">{seller.address}</div>
            <div className="seller-contact">Email: {seller.email}</div>
            <div className="seller-contact">Cell: {seller.phone}</div>
            <div className="seller-contact">GSTIN: {seller.gst}</div>
          </div>

          <div className="dn-details-box">
            <table>
              <tbody>
                <tr>
                  <td>DN No</td>
                  <td>:</td>
                  <td>{note.deliveryNoteNumber}</td>
                </tr>
                {note.ewayBillNumber && (
                  <tr>
                    <td>E-Way Bill</td>
                    <td>:</td>
                    <td>{note.ewayBillNumber}</td>
                  </tr>
                )}
                {note.referenceNumber && (
                  <tr>
                    <td>Reference</td>
                    <td>:</td>
                    <td>{note.referenceNumber}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Consignee / Customer */}
        <section className="dn-party-section">
          <div className="dn-sub-title">Consignee/Customer</div>
          <div className="dn-party-details">
            <div><strong>{customer?.name || '-'}</strong></div>
            <div>{customer?.address || '-'}</div>
            {customer?.phone && <div>Phone: {customer.phone}</div>}
            {customer?.email && <div>Email: {customer.email}</div>}
            {customer?.gstNumber && <div>GSTIN: {customer.gstNumber}</div>}
          </div>
        </section>

        {/* Items Table */}
        <section className="dn-table-wrap">
          <table className="dn-table">
            <thead>
              <tr>
                <th>SL No</th>
                <th>Description of Goods</th>
                <th>Purpose</th>
                <th>HSN/SAC</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {note.items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="dn-td-center">{idx + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.purpose || '-'}</td>
                  <td className="dn-td-center">{item.hsnSac || '-'}</td>
                  <td className="dn-td-right">{item.quantity}</td>
                  <td className="dn-td-center">{item.unit}</td>
                  <td className="dn-td-right">{formatCurrency(item.price)}</td>
                  <td className="dn-td-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="dn-td-right dn-bold">Subtotal</td>
                <td className="dn-td-right dn-bold">{formatCurrency(note.subtotal)}</td>
              </tr>
              {hasTax && note.cgstTotal > 0 && (
                <tr>
                  <td colSpan={7} className="dn-td-right">CGST (9%)</td>
                  <td className="dn-td-right">{formatCurrency(note.cgstTotal)}</td>
                </tr>
              )}
              {hasTax && note.sgstTotal > 0 && (
                <tr>
                  <td colSpan={7} className="dn-td-right">SGST (9%)</td>
                  <td className="dn-td-right">{formatCurrency(note.sgstTotal)}</td>
                </tr>
              )}
              {hasTax && note.igstTotal > 0 && (
                <tr>
                  <td colSpan={7} className="dn-td-right">IGST</td>
                  <td className="dn-td-right">{formatCurrency(note.igstTotal)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={7} className="dn-td-right dn-bold dn-total">Total</td>
                <td className="dn-td-right dn-bold dn-total">{formatCurrency(note.total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Footer */}
        <section className="dn-footer-section">
          <div className="dn-left">
            <div className="dn-sub-title">Amount in Words</div>
            <div className="dn-words">{note.amountInWords}</div>
          </div>
          <div className="dn-right">
            <div className="dn-signature">
              <div className="dn-sig-line">Authorized Signatory</div>
              <div className="dn-sig-line">For {seller.name}</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
