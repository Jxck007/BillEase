import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, generateId } from '../../lib/utils';
import type { Invoice, PaymentMethod } from '../../lib/types';
import { derivePaymentStatus, fromPaise, toPaise } from '../../services/paymentService';

type Props = {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const METHODS: { value: PaymentMethod; en: string; ta: string }[] = [
  { value: 'cash', en: 'Cash', ta: 'ரொக்கம்' },
  { value: 'UPI', en: 'UPI', ta: 'UPI' },
  { value: 'bank_transfer', en: 'Bank transfer', ta: 'வங்கி பரிமாற்றம்' },
  { value: 'cheque', en: 'Cheque', ta: 'காசோலை' },
  { value: 'card', en: 'Card', ta: 'அட்டை' },
  { value: 'other', en: 'Other', ta: 'மற்றவை' },
];

export default function RecordPaymentModal({ invoice, isOpen, onClose, onSaved }: Props) {
  const { addPayment } = useData();
  const { language } = useLanguage();
  const text = (en: string, ta: string) => language === 'ta' ? ta : en;
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [operationId, setOperationId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !invoice) return;
    setAmount(invoice.balanceDue.toFixed(2));
    setPaidAt(new Date().toISOString().slice(0, 10));
    setMethod('cash');
    setReference('');
    setNotes('');
    setOperationId(generateId());
    setConfirming(false);
    setSubmitting(false);
    setError('');
  }, [invoice, isOpen]);

  const amountNumber = Number(amount);
  const remaining = invoice ? fromPaise(Math.max(0, toPaise(invoice.balanceDue) - toPaise(amountNumber))) : 0;
  const newStatus = useMemo(() => invoice
    ? derivePaymentStatus(invoice.total, fromPaise(toPaise(invoice.amountPaid) + toPaise(amountNumber)), invoice.dueDate)
    : 'unpaid', [amountNumber, invoice]);

  if (!invoice) return null;

  const validate = () => {
    if (!Number.isFinite(amountNumber) || toPaise(amountNumber) <= 0) return text('Enter an amount greater than zero.', 'பூஜ்ஜியத்தை விட அதிகமான தொகையை உள்ளிடவும்.');
    if (toPaise(amountNumber) > toPaise(invoice.balanceDue)) return text('Amount cannot exceed the outstanding balance.', 'தொகை நிலுவையை விட அதிகமாக இருக்கக்கூடாது.');
    if (!paidAt || Number.isNaN(new Date(paidAt).getTime())) return text('Enter a valid payment date.', 'சரியான கட்டண தேதியை உள்ளிடவும்.');
    return '';
  };

  const continueToConfirmation = (event: React.FormEvent) => {
    event.preventDefault();
    const message = validate();
    setError(message);
    if (!message) setConfirming(true);
  };

  const save = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const result = await addPayment({ invoiceId: invoice.id, amount: amountNumber, paidAt, method, reference, notes, operationId });
    if (!result.ok) {
      setError(result.errors?.[0]?.message || text('Payment could not be saved.', 'கட்டணத்தைச் சேமிக்க முடியவில்லை.'));
      setSubmitting(false);
      return;
    }
    onSaved?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => undefined : onClose} title={text('Record Payment', 'கட்டணத்தைப் பதிவு செய்')}>
      {!confirming ? (
        <form onSubmit={continueToConfirmation} className="space-y-4">
          <div className="rounded-xl bg-stone-50 p-3 text-sm">
            <div className="font-bold text-stone-900">#{invoice.invoiceNumber}</div>
            <div className="mt-1 text-stone-600">{text('Outstanding', 'நிலுவை')}: {formatCurrency(invoice.balanceDue)}</div>
          </div>
          <label className="block text-sm font-semibold text-stone-700">{text('Amount', 'தொகை')} *
            <input autoFocus required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border p-3" />
          </label>
          <label className="block text-sm font-semibold text-stone-700">{text('Payment date', 'கட்டண தேதி')} *
            <input required type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="mt-1 w-full rounded-xl border p-3" />
          </label>
          <label className="block text-sm font-semibold text-stone-700">{text('Payment method', 'கட்டண முறை')}
            <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="mt-1 w-full rounded-xl border p-3">
              {METHODS.map((entry) => <option key={entry.value} value={entry.value}>{language === 'ta' ? entry.ta : entry.en}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-stone-700">{text('Transaction / reference number', 'பரிவர்த்தனை / குறிப்பு எண்')}
            <input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border p-3" />
          </label>
          <label className="block text-sm font-semibold text-stone-700">{text('Notes', 'குறிப்புகள்')}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="mt-1 w-full rounded-xl border p-3" rows={3} />
          </label>
          {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 font-semibold">{text('Cancel', 'ரத்து செய்')}</button><button type="submit" className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{text('Review payment', 'கட்டணத்தைச் சரிபார்')}</button></div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">{text('Confirm these amounts before saving.', 'சேமிப்பதற்கு முன் இந்தத் தொகைகளை உறுதிப்படுத்தவும்.')}</p>
          <dl className="divide-y rounded-xl border text-sm">
            {[
              [text('Invoice total', 'விலைப்பட்டியல் மொத்தம்'), formatCurrency(invoice.total)],
              [text('Previously paid', 'முன்பு செலுத்தியது'), formatCurrency(invoice.amountPaid)],
              [text('New payment', 'புதிய கட்டணம்'), formatCurrency(amountNumber)],
              [text('Remaining balance', 'மீதமுள்ள நிலுவை'), formatCurrency(remaining)],
              [text('New status', 'புதிய நிலை'), text(newStatus === 'partially_paid' ? 'Partially Paid' : newStatus[0].toUpperCase() + newStatus.slice(1), newStatus === 'paid' ? 'செலுத்தப்பட்டது' : newStatus === 'partially_paid' ? 'பகுதி செலுத்தப்பட்டது' : 'செலுத்தப்படவில்லை')],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 p-3"><dt className="text-stone-500">{label}</dt><dd className="font-bold text-stone-900">{value}</dd></div>)}
          </dl>
          {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2"><button type="button" disabled={submitting} onClick={() => setConfirming(false)} className="rounded-xl px-4 py-3 font-semibold">{text('Back', 'பின்செல்')}</button><button type="button" disabled={submitting} onClick={save} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">{submitting ? text('Saving…', 'சேமிக்கிறது…') : text('Confirm & save', 'உறுதிசெய்து சேமி')}</button></div>
        </div>
      )}
    </Modal>
  );
}
