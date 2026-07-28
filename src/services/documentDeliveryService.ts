import { auth } from '../lib/firebase';

export type DeliveryChannel = 'email' | 'whatsapp';
export type DeliveryErrorCode =
  | 'VALIDATION_FAILED'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'ADMIN_REQUIRED'
  | 'ATTACHMENT_TOO_LARGE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'DELIVERY_IN_PROGRESS'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export type DeliveryResult =
  | { ok: true; status: 'sent' | 'already_sent'; providerMessageId?: string; sentAt?: string }
  | { ok: false; status: number; code: DeliveryErrorCode; message: string };

export type DeliveryProviderStatus = {
  email: { configured: boolean; available: boolean };
  whatsapp: { configured: boolean; available: boolean; instanceConnected: boolean };
  postal?: boolean;
  signature?: boolean;
};

type SharedDocumentInput = {
  documentId: string;
  documentType: 'invoice' | 'quotation' | 'delivery-note';
  documentNumber: string;
  customerId: string;
  pdf: File;
  idempotencyKey: string;
};

type EmailInput = SharedDocumentInput & {
  recipientEmail: string;
  recipientEdited?: boolean;
  ccEmail?: string;
  subject: string;
  message: string;
};

type WhatsAppInput = SharedDocumentInput & {
  recipientNumber: string;
  caption: string;
};

let statusCache: { expiresAt: number; value: DeliveryProviderStatus } | null = null;

function friendlyCode(status: number, serverCode: string): DeliveryErrorCode {
  if (status === 400) return 'VALIDATION_FAILED';
  if (status === 401) return serverCode === 'AUTH_INVALID' ? 'AUTH_INVALID' : 'AUTH_REQUIRED';
  if (status === 403) return 'ADMIN_REQUIRED';
  if (status === 409) return 'DELIVERY_IN_PROGRESS';
  if (status === 413) return 'ATTACHMENT_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (serverCode === 'PROVIDER_NOT_CONFIGURED') return 'PROVIDER_NOT_CONFIGURED';
  if (status >= 500) return 'PROVIDER_UNAVAILABLE';
  return 'UNKNOWN';
}

function friendlyMessage(status: number, fallback: string) {
  if (status === 400) return 'Check the recipient and document details, then try again.';
  if (status === 401) return 'Your login has expired. Sign in again before sending.';
  if (status === 403) return 'Admin access is required to send documents.';
  if (status === 413) return 'The PDF is larger than the 3 MB attachment limit.';
  if (status === 429) return 'Too many send attempts. Please wait a minute.';
  return fallback || 'Delivery provider is unavailable.';
}

async function currentToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  return user.getIdToken();
}

async function authenticatedFetch(url: string, init: RequestInit, timeoutMs: number) {
  const token = await currentToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function appendShared(form: FormData, input: SharedDocumentInput) {
  form.set('documentId', input.documentId);
  form.set('documentType', input.documentType);
  form.set('documentNumber', input.documentNumber);
  form.set('customerId', input.customerId);
  form.set('idempotencyKey', input.idempotencyKey);
  form.set('pdf', input.pdf, input.pdf.name);
}

async function send(url: string, form: FormData, idempotencyKey: string): Promise<DeliveryResult> {
  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: form,
    }, 20_000);
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      return {
        ok: true,
        status: payload.status === 'already_sent' ? 'already_sent' : 'sent',
        providerMessageId: payload.messageId || payload.providerMessageId,
        sentAt: payload.sentAt,
      };
    }
    return {
      ok: false,
      status: response.status,
      code: friendlyCode(response.status, String(payload.code || '')),
      message: friendlyMessage(response.status, String(payload.error || 'Delivery provider is unavailable')),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      return { ok: false, status: 401, code: 'AUTH_REQUIRED', message: 'Your login has expired. Sign in again.' };
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, status: 0, code: 'TIMEOUT', message: 'The delivery request timed out.' };
    }
    return { ok: false, status: 0, code: 'PROVIDER_UNAVAILABLE', message: 'Delivery provider is unavailable.' };
  }
}

export async function sendDocumentByEmail(input: EmailInput): Promise<DeliveryResult> {
  const form = new FormData();
  appendShared(form, input);
  form.set('recipientEmail', input.recipientEmail);
  form.set('recipientEdited', input.recipientEdited ? 'true' : 'false');
  if (input.ccEmail) form.set('ccEmail', input.ccEmail);
  form.set('subject', input.subject);
  form.set('message', input.message);
  return send('/api/email/send-document', form, input.idempotencyKey);
}

export async function sendDocumentByWhatsApp(input: WhatsAppInput): Promise<DeliveryResult> {
  const form = new FormData();
  appendShared(form, input);
  form.set('recipientNumber', input.recipientNumber);
  form.set('caption', input.caption);
  return send('/api/whatsapp/send-document', form, input.idempotencyKey);
}

export async function getDeliveryProviderStatus(force = false): Promise<DeliveryProviderStatus> {
  if (!force && statusCache && statusCache.expiresAt > Date.now()) return statusCache.value;
  const response = await authenticatedFetch('/api/integrations/status', { method: 'GET' }, 6_000);
  if (!response.ok) throw new Error('STATUS_UNAVAILABLE');
  const value = await response.json() as DeliveryProviderStatus;
  statusCache = { expiresAt: Date.now() + 30_000, value };
  return value;
}
