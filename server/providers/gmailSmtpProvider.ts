import nodemailer from 'nodemailer';
import { HttpError } from '../http/errors.js';

const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const SAFE_FILENAME_PATTERN = /^[^/\\\u0000-\u001f\u007f]{1,150}\.(?:pdf|png)$/iu;
const MAX_ATTACHMENT_BYTES = 2_000_000;

type SmtpTransport = {
  sendMail: (options: Record<string, unknown>) => Promise<{ messageId?: string; response?: string }>;
};

type TransportFactory = (configuration: {
  host: 'smtp.gmail.com';
  port: 465;
  secure: true;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}) => SmtpTransport;

type ProviderEvents = {
  response?: (status: 'sent' | 'rejected', providerType: string) => void;
};

export function getGmailSmtpConfiguration() {
  const user = process.env.GMAIL_SMTP_USER?.trim().toLowerCase();
  const appPassword = process.env.GMAIL_SMTP_APP_PASSWORD?.trim();
  const fromNameCandidate = process.env.GMAIL_FROM_NAME?.trim();
  const validUser = Boolean(
    user
    && user.length <= 254
    && EMAIL_ADDRESS_PATTERN.test(user)
    && !/[\r\n]/.test(user),
  );
  const validPassword = Boolean(
    appPassword
    && appPassword.length >= 8
    && appPassword.length <= 200
    && !/[\r\n]/.test(appPassword),
  );
  const validFromName = Boolean(
    !fromNameCandidate
    || (fromNameCandidate.length <= 100 && !/[\r\n<>]/.test(fromNameCandidate)),
  );

  return {
    configured: validUser && validPassword && validFromName,
    user,
    appPassword,
    fromName: validFromName && fromNameCandidate ? fromNameCandidate : 'Kimera Vel Tech',
  };
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

function smtpError(error: unknown) {
  const candidate = error && typeof error === 'object'
    ? error as { code?: unknown; responseCode?: unknown; command?: unknown }
    : {};
  return {
    code: typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '',
    responseCode: Number(candidate.responseCode || 0),
    command: typeof candidate.command === 'string' ? candidate.command.toUpperCase() : '',
  };
}

function normalizeSmtpError(error: unknown): HttpError {
  const details = smtpError(error);
  if (details.code === 'EAUTH' || details.responseCode === 534 || details.responseCode === 535) {
    return new HttpError(503, 'GMAIL_SMTP_AUTH_FAILED', 'Gmail SMTP authentication failed');
  }
  if (['ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(details.code)
    || details.command === 'CONN') {
    return new HttpError(502, 'GMAIL_SMTP_CONNECTION_FAILED', 'Gmail SMTP connection failed');
  }
  if (details.responseCode >= 400 || details.code === 'EENVELOPE' || details.code === 'EMESSAGE') {
    return new HttpError(422, 'GMAIL_SMTP_REJECTED', 'Gmail rejected the message');
  }
  return new HttpError(502, 'GMAIL_SMTP_CONNECTION_FAILED', 'Gmail SMTP delivery failed');
}

const defaultTransportFactory: TransportFactory = (configuration) => (
  nodemailer.createTransport(configuration) as SmtpTransport
);

export async function sendEmailWithGmailSmtp(input: {
  recipientEmail: string;
  ccEmail?: string;
  subject: string;
  message: string;
  filename: string;
  mimeType: 'application/pdf' | 'image/png';
  attachment: Buffer;
}, events: ProviderEvents = {}, transportFactory: TransportFactory = defaultTransportFactory) {
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
    || !SAFE_FILENAME_PATTERN.test(input.filename)
    || (input.mimeType === 'application/pdf') !== input.filename.toLowerCase().endsWith('.pdf')) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid email delivery details');
  }
  if (!input.attachment.length || input.attachment.length > MAX_ATTACHMENT_BYTES) {
    throw new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'Attachment is too large');
  }

  const configuration = getGmailSmtpConfiguration();
  if (!configuration.configured) {
    throw new HttpError(503, 'GMAIL_SMTP_NOT_CONFIGURED', 'Email provider is not configured');
  }

  try {
    const transporter = transportFactory({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: configuration.user!,
        pass: configuration.appPassword!,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const result = await transporter.sendMail({
      from: {
        name: configuration.fromName,
        address: configuration.user!,
      },
      to: input.recipientEmail,
      ...(input.ccEmail ? { cc: input.ccEmail } : {}),
      subject: input.subject,
      text: input.message,
      html: htmlFromPlainText(input.message),
      attachments: [{
        filename: input.filename,
        content: input.attachment,
        contentType: input.mimeType,
      }],
    });
    const messageId = typeof result.messageId === 'string' ? result.messageId : '';
    if (!messageId) throw new HttpError(422, 'GMAIL_SMTP_REJECTED', 'Gmail returned an invalid response');
    events.response?.('sent', 'gmail-smtp');
    return { messageId };
  } catch (error) {
    events.response?.('rejected', 'gmail-smtp');
    if (error instanceof HttpError) throw error;
    throw normalizeSmtpError(error);
  }
}
