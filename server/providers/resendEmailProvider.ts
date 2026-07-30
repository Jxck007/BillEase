import { HttpError } from '../http/errors.js';

export function getResendConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const validApiKey = Boolean(apiKey && apiKey.length <= 500 && !/[\r\n]/.test(apiKey));
  const validFrom = Boolean(from
    && from.length <= 320
    && /^(?:[^<>\r\n]+\s+<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(from));
  return { configured: validApiKey && validFrom, apiKey, from };
}

type ProviderEvents = {
  request?: (serializedBytes: number) => void;
  response?: (status: number, providerType: string) => void;
};

export async function sendEmailWithResend(input: {
  recipientEmail: string;
  ccEmail?: string;
  subject: string;
  message: string;
  filename: string;
  attachment: Buffer;
  idempotencyKey: string;
}, events: ProviderEvents = {}) {
  const config = getResendConfiguration();
  if (!config.configured) {
    throw new HttpError(503, 'RESEND_NOT_CONFIGURED', 'Email provider is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const body = JSON.stringify({
      from: config.from,
      to: [input.recipientEmail],
      ...(input.ccEmail ? { cc: [input.ccEmail] } : {}),
      subject: input.subject,
      text: input.message,
      attachments: [{ filename: input.filename, content: input.attachment.toString('base64') }],
    });
    events.request?.(Buffer.byteLength(body));
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
        'User-Agent': 'BillEase/1.0',
      },
      body,
    });
    const result = await response.json().catch(() => ({}));
    const providerType = typeof result.name === 'string' ? result.name : 'unknown';
    events.response?.(response.status, providerType);
    if (!response.ok) {
      const providerMessage = typeof result.message === 'string' ? result.message.toLowerCase() : '';
      if (response.status === 429) throw new HttpError(429, 'PROVIDER_RATE_LIMITED', 'Email provider rate limit reached');
      if (response.status === 403 && /domain.+not verified|verify a domain|testing emails/.test(providerMessage)) {
        throw new HttpError(422, 'SENDER_NOT_VERIFIED', 'Email sender is not verified');
      }
      if (response.status === 401 || (response.status === 403 && providerType === 'invalid_api_key')) {
        throw new HttpError(503, 'RESEND_NOT_CONFIGURED', 'Email provider credentials are invalid');
      }
      if (response.status >= 500) throw new HttpError(502, 'PROVIDER_REJECTED', 'Email provider is unavailable');
      throw new HttpError(422, 'PROVIDER_REJECTED', 'Email provider rejected the request');
    }
    return { messageId: typeof result.id === 'string' ? result.id : null };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, 'PROVIDER_TIMEOUT', 'Email provider timed out');
    }
    throw new HttpError(502, 'EMAIL_SEND_FAILED', 'Email provider is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
