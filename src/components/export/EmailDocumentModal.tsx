import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { emailProvider } from '../../services/integrations';

type Props = {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentLabel: string;
  documentNumber: string;
  businessName: string;
  businessEmail: string;
  ccBusiness: boolean;
  customerName: string;
  customerEmail: string;
  exportRoot: HTMLElement | null;
};

type FormState = { to: string; cc: string; subject: string; message: string; filename: string };
type SendStatus = { tone: 'success' | 'error'; text: string } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_PDF_BYTES = 3_000_000;

export default function EmailDocumentModal(props: Props) {
  const defaults = useMemo<FormState>(() => ({
    to: props.customerEmail,
    cc: props.ccBusiness ? props.businessEmail : '',
    subject: `${props.documentLabel} ${props.documentNumber} from ${props.businessName}`,
    message: `Dear ${props.customerName || 'Customer'},\n\nPlease find attached ${props.documentLabel.toLowerCase()} ${props.documentNumber} from ${props.businessName}.\n\nThank you.`,
    filename: `${props.documentLabel}_${props.documentNumber}`.replace(/[^a-z0-9_-]+/gi, '_') + '.pdf',
  }), [props.businessEmail, props.businessName, props.ccBusiness, props.customerEmail, props.customerName, props.documentLabel, props.documentNumber]);

  const [form, setForm] = useState(defaults);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<SendStatus>(null);
  const inFlight = useRef(false);
  const idempotencyKey = useRef(createRequestId());

  useEffect(() => {
    if (!props.open) return;
    setForm(defaults);
    setSending(false);
    setSent(false);
    setStatus(null);
    inFlight.current = false;
    idempotencyKey.current = createRequestId();
  }, [defaults, props.documentId, props.open]);

  if (!props.open) return null;

  const validationError = (() => {
    if (!EMAIL_PATTERN.test(form.to.trim())) return 'Enter a valid recipient email address.';
    if (form.cc.trim() && !EMAIL_PATTERN.test(form.cc.trim())) return 'Enter a valid CC email address.';
    if (!form.subject.trim()) return 'Enter an email subject.';
    if (!form.message.trim()) return 'Enter a short email message.';
    if (!/^[^/\\]{1,150}\.pdf$/i.test(form.filename.trim())) return 'Use a safe PDF filename ending in .pdf.';
    if (!props.exportRoot) return 'The document preview is not ready.';
    return '';
  })();

  const send = async () => {
    if (inFlight.current || sent || validationError) {
      if (validationError) setStatus({ tone: 'error', text: validationError });
      return;
    }

    const user = auth?.currentUser;
    if (!user) {
      setStatus({ tone: 'error', text: 'Your login has expired. Sign in again before sending.' });
      return;
    }

    inFlight.current = true;
    setSending(true);
    setStatus(null);

    try {
      const { createPdfBlobFromElement } = await import('../../services/exportService');
      const blob = await createPdfBlobFromElement(props.exportRoot as HTMLElement, 190);
      if (!blob.size) throw new Error('The generated PDF is empty.');
      if (blob.size > MAX_EMAIL_PDF_BYTES) throw new Error('The PDF is larger than the 3 MB email limit. Use Download PDF instead.');

      const token = await user.getIdToken();
      const result = await emailProvider.send({
        token,
        documentId: props.documentId,
        recipient: form.to,
        cc: form.cc,
        subject: form.subject,
        message: form.message,
        file: new File([blob], form.filename.trim(), { type: 'application/pdf' }),
        idempotencyKey: idempotencyKey.current,
      });

      if (result.ok) {
        setSent(true);
        setStatus({
          tone: 'success',
          text: result.value.status === 'already_sent'
            ? 'This document email was already sent.'
            : 'Email sent with the PDF attached.',
        });
      } else {
        setStatus({ tone: 'error', text: 'message' in result ? result.message : 'Email could not be sent.' });
      }
    } catch (error) {
      const detail = error instanceof Error && error.message.includes('3 MB email limit')
        ? error.message
        : 'Email could not be sent. Use the mail-app fallback below.';
      setStatus({ tone: 'error', text: detail });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const mailto = `mailto:${form.to.trim()}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(form.message)}`;

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/30" onClick={props.onClose} aria-label="Close email composer" />
      <div role="dialog" aria-modal="true" aria-labelledby="email-compose-title" className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[90dvh] max-w-xl -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="email-compose-title" className="text-lg font-bold">Send document by email</h2>
            <p className="text-xs text-stone-500">The current PDF will be attached securely.</p>
          </div>
          <button type="button" onClick={props.onClose} className="min-h-12 min-w-12 rounded-xl hover:bg-stone-100" aria-label="Close email composer"><X className="mx-auto" /></button>
        </div>

        <div className="grid gap-3">
          <EmailField label="To">
            <input type="email" autoComplete="email" value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border px-3 font-normal" />
          </EmailField>
          <EmailField label="CC">
            <input type="email" value={form.cc} onChange={(event) => setForm({ ...form, cc: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border px-3 font-normal" />
          </EmailField>
          <EmailField label="Subject">
            <input maxLength={200} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border px-3 font-normal" />
          </EmailField>
          <EmailField label="Message">
            <textarea maxLength={3000} rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-1 w-full rounded-xl border p-3 font-normal" />
          </EmailField>
          <EmailField label="PDF filename">
            <input maxLength={150} value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border px-3 font-normal" />
          </EmailField>

          {status && (
            <p role={status.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${status.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
              {status.tone === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
              {status.text}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <a href={mailto} className="inline-flex min-h-12 items-center justify-center rounded-xl border px-4 font-semibold">Open mail app</a>
            <button type="button" onClick={send} disabled={sending || sent || Boolean(validationError)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? <Loader2 className="animate-spin" /> : <Mail size={18} />}
              {sending ? 'Sending PDF…' : sent ? 'Email Sent' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function EmailField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-sm font-semibold">{label}{children}</label>;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `mail_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
