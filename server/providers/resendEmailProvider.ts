import { HttpError } from '../http/errors';

export function getResendConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const validApiKey = Boolean(apiKey && apiKey.length <= 500 && !/[\r\n]/.test(apiKey));
  const validFrom = Boolean(from && from.length <= 320 && !/[\r\n]/.test(from));
  return { configured: validApiKey && validFrom, apiKey, from };
}

export async function sendEmailWithResend(input: {
  recipientEmail: string;
  ccEmail?: string;
  subject: string;
  message: string;
  filename: string;
  pdf: Buffer;
  idempotencyKey: string;
}) {
  const config = getResendConfiguration();
  if (!config.configured) {
    throw new HttpError(503, 'PROVIDER_NOT_CONFIGURED', 'Email provider is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.recipientEmail],
        ...(input.ccEmail ? { cc: [input.ccEmail] } : {}),
        subject: input.subject,
        text: input.message,
        attachments: [{ filename: input.filename, content: input.pdf.toString('base64') }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new HttpError(502, 'EMAIL_PROVIDER_REJECTED', 'Email provider rejected the request');
    return { messageId: typeof result.id === 'string' ? result.id : null };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'EMAIL_PROVIDER_UNAVAILABLE', 'Email provider is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
