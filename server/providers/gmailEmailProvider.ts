import { randomBytes } from 'node:crypto';
import { HttpError } from '../http/errors.js';

const GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const EXPECTED_SENDER = 'kimeraveltech@gmail.com';
const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const MAX_ATTACHMENT_BYTES = 2_000_000;

type FetchImplementation = typeof fetch;
type ProviderEvents = {
  request?: (serializedBytes: number) => void;
  response?: (status: number, providerType: string) => void;
};

export function getGmailConfiguration() {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();
  const senderEmail = process.env.GMAIL_SENDER_EMAIL?.trim().toLowerCase();
  const safeValue = (value: string | undefined, maximum: number) => Boolean(
    value && value.length <= maximum && !/[\r\n]/.test(value),
  );
  const validSender = senderEmail === EXPECTED_SENDER && EMAIL_ADDRESS_PATTERN.test(senderEmail);

  return {
    configured: safeValue(clientId, 500)
      && safeValue(clientSecret, 500)
      && safeValue(refreshToken, 2_000)
      && validSender,
    clientId,
    clientSecret,
    refreshToken,
    senderEmail,
  };
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function encodeBase64Lines(value: Buffer | string) {
  return Buffer.from(value).toString('base64').replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

function htmlFromPlainText(message: string) {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<!doctype html><html><body><p style="white-space:pre-wrap">${escaped}</p></body></html>`;
}

export function createGmailMimeMessage(input: {
  senderEmail: string;
  recipientEmail: string;
  ccEmail?: string;
  subject: string;
  message: string;
  filename: string;
  mimeType: 'application/pdf' | 'image/png';
  attachment: Buffer;
}, boundarySeed = randomBytes(18).toString('hex')) {
  const mixedBoundary = `billease_mixed_${boundarySeed}`;
  const alternativeBoundary = `billease_alternative_${boundarySeed}`;
  const headers = [
    `From: ${input.senderEmail}`,
    `To: ${input.recipientEmail}`,
    ...(input.ccEmail ? [`Cc: ${input.ccEmail}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ];
  const parts = [
    ...headers,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Lines(input.message),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Lines(htmlFromPlainText(input.message)),
    `--${alternativeBoundary}--`,
    `--${mixedBoundary}`,
    `Content-Type: ${input.mimeType}; name="${input.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${input.filename}"`,
    '',
    encodeBase64Lines(input.attachment),
    `--${mixedBoundary}--`,
    '',
  ];
  return parts.join('\r\n');
}

async function responseJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

async function refreshAccessToken(fetchImplementation: FetchImplementation, signal: AbortSignal) {
  const config = getGmailConfiguration();
  if (!config.configured) {
    throw new HttpError(503, 'GMAIL_NOT_CONFIGURED', 'Email provider is not configured');
  }

  const response = await fetchImplementation(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      refresh_token: config.refreshToken!,
      grant_type: 'refresh_token',
    }),
  });
  const result = await responseJson(response);
  if (!response.ok) {
    const oauthError = typeof result.error === 'string' ? result.error : '';
    if (oauthError === 'invalid_grant') {
      throw new HttpError(503, 'GMAIL_AUTH_REVOKED', 'Gmail authorization must be renewed');
    }
    throw new HttpError(503, 'GMAIL_AUTH_FAILED', 'Gmail authentication failed');
  }
  const accessToken = typeof result.access_token === 'string' ? result.access_token : '';
  if (!accessToken || accessToken.length > 4_000 || /[\r\n]/.test(accessToken)) {
    throw new HttpError(503, 'GMAIL_AUTH_FAILED', 'Gmail authentication failed');
  }
  return { accessToken, senderEmail: config.senderEmail! };
}

export async function sendEmailWithGmail(input: {
  recipientEmail: string;
  ccEmail?: string;
  subject: string;
  message: string;
  filename: string;
  mimeType: 'application/pdf' | 'image/png';
  attachment: Buffer;
}, events: ProviderEvents = {}, fetchImplementation: FetchImplementation = fetch) {
  if (!EMAIL_ADDRESS_PATTERN.test(input.recipientEmail)
    || input.recipientEmail.length > 254
    || /[\r\n]/.test(input.recipientEmail)
    || (input.ccEmail && (
      !EMAIL_ADDRESS_PATTERN.test(input.ccEmail)
      || input.ccEmail.length > 254
      || /[\r\n]/.test(input.ccEmail)
    ))) {
    throw new HttpError(400, 'INVALID_RECIPIENT', 'Invalid email recipient');
  }
  if (!input.subject
    || input.subject.length > 200
    || /[\r\n]/.test(input.subject)
    || !input.message
    || input.message.length > 3_000
    || !/^[a-zA-Z0-9._-]{1,125}\.(?:pdf|png)$/i.test(input.filename)
    || (input.mimeType === 'application/pdf') !== input.filename.toLowerCase().endsWith('.pdf')) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid email delivery details');
  }
  if (!input.attachment.length || input.attachment.length > MAX_ATTACHMENT_BYTES) {
    throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const { accessToken, senderEmail } = await refreshAccessToken(fetchImplementation, controller.signal);
    const mimeMessage = createGmailMimeMessage({ ...input, senderEmail });
    const body = JSON.stringify({
      raw: Buffer.from(mimeMessage, 'utf8').toString('base64url'),
    });
    events.request?.(Buffer.byteLength(body));
    const response = await fetchImplementation(GMAIL_SEND_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BillEase/1.0',
      },
      body,
    });
    const result = await responseJson(response);
    const providerType = typeof result.error === 'object' ? 'gmail_api_error' : 'gmail';
    events.response?.(response.status, providerType);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new HttpError(503, 'GMAIL_AUTH_FAILED', 'Gmail authentication failed');
      }
      if (response.status === 429) {
        throw new HttpError(429, 'PROVIDER_RATE_LIMITED', 'Email provider rate limit reached');
      }
      if (response.status >= 500) {
        throw new HttpError(502, 'GMAIL_API_REJECTED', 'Gmail API is unavailable');
      }
      throw new HttpError(422, 'GMAIL_API_REJECTED', 'Gmail API rejected the request');
    }
    const messageId = typeof result.id === 'string' ? result.id : '';
    if (!messageId) throw new HttpError(502, 'GMAIL_API_REJECTED', 'Gmail API returned an invalid response');
    return { messageId };
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
