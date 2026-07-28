import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, MessageCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { sendDocumentByEmail, sendDocumentByWhatsApp } from '../../services/documentDeliveryService';
import type { DeliveryChannel } from '../../services/documentDeliveryService';

type Props = {
  channel: DeliveryChannel | null;
  onClose: () => void;
  providerReady: boolean;
  providerReason: string;
  documentId: string;
  documentType: 'invoice' | 'quotation' | 'delivery-note';
  documentNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  defaultCcEmail?: string;
  customerNumber: string;
  businessName: string;
  getPdfFile: () => Promise<File>;
  onEmailFallback: (to: string, subject: string, message: string) => Promise<void>;
  onWhatsAppFallback: (number: string, caption: string) => Promise<void>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PDF_BYTES = 3_000_000;

export default function DocumentDeliveryModal(props: Props) {
  const defaults = useMemo(() => ({
    recipientEmail: props.customerEmail,
    ccEmail: props.defaultCcEmail || '',
    subject: `${documentLabel(props.documentType)} ${props.documentNumber} from ${props.businessName}`,
    message: `Dear ${props.customerName || 'Customer'},\n\nPlease find attached ${documentLabel(props.documentType).toLowerCase()} ${props.documentNumber} from ${props.businessName}.\n\nThank you.`,
    recipientNumber: props.customerNumber,
    caption: `Please find the ${documentLabel(props.documentType)} ${props.documentNumber} from ${props.businessName}.`,
  }), [props.businessName, props.customerEmail, props.customerName, props.customerNumber, props.defaultCcEmail, props.documentNumber, props.documentType]);
  const [form, setForm] = useState(defaults);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const idempotencyKey = useRef(createRequestId());

  useEffect(() => {
    if (!props.channel) return;
    setForm(defaults);
    setState('idle');
    setMessage('');
    inFlight.current = false;
    idempotencyKey.current = createRequestId();
  }, [defaults, props.channel, props.documentId]);

  if (!props.channel) return null;
  const isEmail = props.channel === 'email';
  const validationError = isEmail
    ? (!EMAIL_PATTERN.test(form.recipientEmail.trim())
      ? 'Enter a valid recipient email address.'
      : form.ccEmail.trim() && !EMAIL_PATTERN.test(form.ccEmail.trim())
        ? 'Enter a valid CC email address.'
        : !form.subject.trim() || !form.message.trim()
          ? 'Subject and message are required.'
          : '')
    : (!form.recipientNumber.trim() ? 'The selected customer has no WhatsApp or phone number.' : !form.caption.trim() ? 'Caption is required.' : '');

  const send = async () => {
    if (inFlight.current || state === 'sent' || validationError || !props.providerReady) {
      if (validationError) {
        setState('failed');
        setMessage(validationError);
      }
      return;
    }

    inFlight.current = true;
    setState('sending');
    setMessage('');
    try {
      const pdf = await props.getPdfFile();
      if (pdf.size > MAX_PDF_BYTES) {
        setState('failed');
        setMessage('The PDF is larger than the 3 MB delivery limit. Use a fallback or Download PDF.');
        return;
      }
      const shared = {
        documentId: props.documentId,
        documentType: props.documentType,
        documentNumber: props.documentNumber,
        customerId: props.customerId,
        pdf,
        idempotencyKey: idempotencyKey.current,
      };
      const result = isEmail
        ? await sendDocumentByEmail({
          ...shared,
          recipientEmail: form.recipientEmail.trim(),
          recipientEdited: form.recipientEmail.trim().toLowerCase() !== props.customerEmail.trim().toLowerCase(),
          ccEmail: form.ccEmail.trim() || undefined,
          subject: form.subject.trim(),
          message: form.message.trim(),
        })
        : await sendDocumentByWhatsApp({
          ...shared,
          recipientNumber: form.recipientNumber.trim(),
          caption: form.caption.trim(),
        });

      if (result.ok === true) {
        setState('sent');
        setMessage(result.status === 'already_sent' ? 'This document was already sent.' : `${isEmail ? 'Email' : 'WhatsApp document'} sent.`);
      } else {
        setState('failed');
        setMessage(result.message);
      }
    } catch {
      setState('failed');
      setMessage(`Could not send the document. Use the ${isEmail ? 'mail app' : 'WhatsApp'} fallback.`);
    } finally {
      inFlight.current = false;
      setState((current) => current === 'sending' ? 'failed' : current);
    }
  };

  const fallback = () => isEmail
    ? props.onEmailFallback(form.recipientEmail, form.subject, form.message)
    : props.onWhatsAppFallback(form.recipientNumber, form.caption);

  const Icon = isEmail ? Mail : MessageCircle;
  return (
    <>
      <button type="button" className="fixed inset-0 z-[60] bg-black/30" onClick={props.onClose} aria-label="Close delivery composer" />
      <div role="dialog" aria-modal="true" aria-labelledby="delivery-compose-title" className="fixed inset-x-3 top-1/2 z-[70] mx-auto max-h-[90dvh] max-w-xl -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="delivery-compose-title" className="text-lg font-bold">Send document by {isEmail ? 'email' : 'WhatsApp'}</h2>
            <p className="text-xs text-stone-500">Review the recipient and message before sending.</p>
          </div>
          <button type="button" onClick={props.onClose} className="min-h-12 min-w-12 rounded-xl hover:bg-stone-100" aria-label="Close delivery composer"><X className="mx-auto" /></button>
        </div>

        <div className="grid gap-3">
          {isEmail ? (
            <>
              <Field label="To"><input type="email" autoComplete="email" value={form.recipientEmail} onChange={(event) => setForm({ ...form, recipientEmail: event.target.value })} className="delivery-input" /></Field>
              <Field label="CC (optional)"><input type="email" value={form.ccEmail} onChange={(event) => setForm({ ...form, ccEmail: event.target.value })} className="delivery-input" /></Field>
              <Field label="Subject"><input maxLength={200} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="delivery-input" /></Field>
              <Field label="Message"><textarea maxLength={3000} rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-1 w-full rounded-xl border p-3 font-normal" /></Field>
            </>
          ) : (
            <>
              <Field label="Customer WhatsApp number"><input type="tel" readOnly value={form.recipientNumber} className="delivery-input bg-stone-50" /></Field>
              <Field label="Caption"><textarea maxLength={2000} rows={4} value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} className="mt-1 w-full rounded-xl border p-3 font-normal" /></Field>
            </>
          )}

          {!props.providerReady && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{props.providerReason}</p>}
          {message && (
            <p role={state === 'failed' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${state === 'sent' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
              {state === 'sent' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
              {message}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={fallback} disabled={state === 'sending'} className="inline-flex min-h-12 items-center justify-center rounded-xl border px-4 font-semibold disabled:opacity-50">
              Download PDF & open {isEmail ? 'mail app' : 'WhatsApp'}
            </button>
            <button type="button" onClick={send} disabled={!props.providerReady || state === 'sending' || state === 'sent' || Boolean(validationError)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {state === 'sending' ? <Loader2 className="animate-spin" /> : <Icon size={18} />}
              {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : `Send ${isEmail ? 'Email' : 'WhatsApp'}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-sm font-semibold">{label}{children}</label>;
}

function documentLabel(type: Props['documentType']) {
  if (type === 'delivery-note') return 'Delivery Note';
  return type === 'quotation' ? 'Quotation' : 'Invoice';
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `delivery_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
