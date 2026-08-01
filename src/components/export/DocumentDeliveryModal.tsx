import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2, Mail, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { sendDocumentByEmail } from '../../services/documentDeliveryService';
import { useAccessibleOverlay } from '../../hooks/useAccessibleOverlay';

type Props = {
  open: boolean;
  onClose: () => void;
  providerReady: boolean;
  providerReason: string;
  documentId: string;
  documentType: 'invoice' | 'quotation' | 'delivery-note' | 'payment-receipt';
  documentNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  defaultCcEmail?: string;
  businessName: string;
  getAttachmentFile: (format: 'pdf') => Promise<File>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTACHMENT_BYTES = 2_000_000;

export default function DocumentDeliveryModal(props: Props) {
  const { language, t } = useLanguage();
  const label = documentLabel(props.documentType, language);
  const defaults = useMemo(() => ({
    recipientEmail: props.customerEmail,
    ccEmail: props.defaultCcEmail || '',
    subject: language === 'ta'
      ? `${label} ${props.documentNumber} - ${props.businessName}`
      : `${label} ${props.documentNumber} from ${props.businessName}`,
    message: language === 'ta'
      ? `வணக்கம் ${props.customerName || 'வாடிக்கையாளரே'},\n\n${props.businessName} நிறுவனத்தின் ${label} ${props.documentNumber} இணைக்கப்பட்டுள்ளது.\n\nநன்றி.`
      : `Dear ${props.customerName || 'Customer'},\n\nPlease find attached ${label.toLowerCase()} ${props.documentNumber} from ${props.businessName}.\n\nThank you.`,
  }), [label, language, props.businessName, props.customerEmail, props.customerName, props.defaultCcEmail, props.documentNumber]);
  const [form, setForm] = useState(defaults);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [preparingAttachment, setPreparingAttachment] = useState(false);
  const inFlight = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const idempotencyKey = useRef(createRequestId());

  useEffect(() => {
    if (!props.open) return;
    setForm(defaults);
    setState('idle');
    setMessage('');
    setAttachment(null);
    inFlight.current = false;
    idempotencyKey.current = createRequestId();
  }, [defaults, props.documentId, props.open]);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setPreparingAttachment(true);
    setAttachment(null);
    props.getAttachmentFile('pdf')
      .then((file) => {
        if (!cancelled) setAttachment(file);
      })
      .catch(() => {
        if (!cancelled) {
          setState('failed');
          setMessage(t('attachmentPreparationFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setPreparingAttachment(false);
      });
    return () => { cancelled = true; };
  }, [props.getAttachmentFile, props.open, t]);

  useAccessibleOverlay({
    open: props.open,
    containerRef: overlayRef,
    initialFocusRef: closeButtonRef,
    onClose: props.onClose,
  });

  if (!props.open) return null;
  const validationError = !EMAIL_PATTERN.test(form.recipientEmail.trim())
    ? t('validRecipientEmail')
    : form.ccEmail.trim() && !EMAIL_PATTERN.test(form.ccEmail.trim())
      ? t('validCcEmail')
      : !form.subject.trim() || !form.message.trim()
        ? t('subjectMessageRequired')
        : '';

  const send = async () => {
    if (inFlight.current || state === 'sent' || validationError || !props.providerReady || !attachment) {
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
      if (attachment.size > MAX_ATTACHMENT_BYTES) {
        setState('failed');
        setMessage(t('attachmentTooLarge'));
        return;
      }
      const result = await sendDocumentByEmail({
        documentId: props.documentId,
        documentType: props.documentType,
        documentNumber: props.documentNumber,
        customerId: props.customerId,
        attachment,
        idempotencyKey: idempotencyKey.current,
        recipientEmail: form.recipientEmail.trim(),
        ccEmail: form.ccEmail.trim() || undefined,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });

      if (result.ok === true) {
        setState('sent');
        setMessage(result.status === 'already_sent' ? t('alreadySent') : t('emailSent'));
      } else {
        setState('failed');
        setMessage(result.message);
      }
    } catch {
      setState('failed');
      setMessage(t('emailSendFallback'));
    } finally {
      inFlight.current = false;
      setState((current) => current === 'sending' ? 'failed' : current);
    }
  };

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-3" onMouseDown={(event) => { if (event.currentTarget === event.target) props.onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="delivery-compose-title" aria-describedby="delivery-compose-description" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="delivery-compose-title" className="text-lg font-bold">{t('sendDocumentByEmail')}</h2>
            <p id="delivery-compose-description" className="text-xs text-stone-500">{t('reviewRecipientMessage')}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={props.onClose} className="min-h-12 min-w-12 rounded-xl hover:bg-stone-100" aria-label={t('closeDeliveryComposer')}><X className="mx-auto" /></button>
        </div>

        <div className="grid gap-3">
          <Field label={t('to')}><input type="email" autoComplete="email" value={form.recipientEmail} readOnly className="delivery-input bg-stone-50" /></Field>
          <Field label={t('ccOptional')}><input type="email" value={form.ccEmail} onChange={(event) => setForm({ ...form, ccEmail: event.target.value })} className="delivery-input" /></Field>
          <Field label={t('subject')}><input maxLength={200} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="delivery-input" /></Field>
          <Field label={t('message')}><textarea maxLength={3000} rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-1 w-full rounded-xl border p-3 font-normal" /></Field>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
            <p className="font-semibold">{preparingAttachment ? t('preparingDocument') : attachment?.name || t('preparingDocument')}</p>
            {attachment && <p className="mt-1 text-xs text-stone-500">{formatBytes(attachment.size)} · {attachment.type}</p>}
          </div>

          {!props.providerReady && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{props.providerReason}</p>}
          {message && (
            <p role={state === 'failed' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${state === 'sent' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
              {state === 'sent' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
              {message}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={send} disabled={!props.providerReady || preparingAttachment || !attachment || state === 'sending' || state === 'sent' || Boolean(validationError)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {state === 'sending' ? <Loader2 className="animate-spin" /> : <Mail size={18} />}
              {state === 'sending' ? t('sending') : state === 'sent' ? t('sent') : t('sendEmail')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-sm font-semibold">{label}{children}</label>;
}

function documentLabel(type: Props['documentType'], language: 'en' | 'ta') {
  if (type === 'payment-receipt') return language === 'ta' ? 'கட்டண ரசீது' : 'Payment Receipt';
  if (language === 'ta') {
    if (type === 'delivery-note') return 'விநியோகக் குறிப்பு';
    return type === 'quotation' ? 'விலைமதிப்பீடு' : 'விலைப்பட்டியல்';
  }
  if (type === 'delivery-note') return 'Delivery Note';
  return type === 'quotation' ? 'Quotation' : 'Invoice';
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `delivery_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
