import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { HttpError } from '../server/http/errors.js';
import {
  getGmailSmtpConfiguration,
  sendEmailWithGmailSmtp,
} from '../server/providers/gmailSmtpProvider.js';

const GMAIL_KEYS = [
  'GMAIL_SMTP_USER',
  'GMAIL_SMTP_APP_PASSWORD',
  'GMAIL_FROM_NAME',
] as const;
const originalEnvironment = Object.fromEntries(GMAIL_KEYS.map((key) => [key, process.env[key]]));

function configureGmailSmtp() {
  process.env.GMAIL_SMTP_USER = 'kimeraveltech@gmail.com';
  process.env.GMAIL_SMTP_APP_PASSWORD = 'mock-app-password';
  process.env.GMAIL_FROM_NAME = 'Kimera Vel Tech';
}

function pdf(pageCount: 1 | 2) {
  return Buffer.from(`%PDF-1.7\n/Type /Pages /Count ${pageCount}\n%%EOF`, 'ascii');
}

function input(overrides: Partial<Parameters<typeof sendEmailWithGmailSmtp>[0]> = {}) {
  return {
    recipientEmail: 'customer@example.com',
    subject: 'Invoice INV-1',
    message: 'Dear Customer,\n\nPlease find the document attached.',
    filename: 'Invoice-INV-1.pdf',
    mimeType: 'application/pdf' as const,
    attachment: pdf(1),
    ...overrides,
  };
}

function successfulTransport(
  captured: { configuration?: Record<string, unknown>; mail?: Record<string, unknown> },
  messageId = '<mock-message@gmail.com>',
) {
  return (configuration: Record<string, unknown>) => {
    captured.configuration = configuration;
    return {
      sendMail: async (mail: Record<string, unknown>) => {
        captured.mail = mail;
        return { messageId, response: '250 2.0.0 OK' };
      },
    };
  };
}

beforeEach(configureGmailSmtp);
afterEach(() => {
  for (const key of GMAIL_KEYS) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('sends through Gmail SMTP 465 with a server-owned sender and App Password', async () => {
  const captured: { configuration?: Record<string, unknown>; mail?: Record<string, unknown> } = {};
  const result = await sendEmailWithGmailSmtp(input(), {}, successfulTransport(captured));

  assert.equal(result.messageId, '<mock-message@gmail.com>');
  assert.equal(captured.configuration?.host, 'smtp.gmail.com');
  assert.equal(captured.configuration?.port, 465);
  assert.equal(captured.configuration?.secure, true);
  assert.deepEqual(captured.configuration?.auth, {
    user: 'kimeraveltech@gmail.com',
    pass: 'mock-app-password',
  });
  assert.deepEqual(captured.mail?.from, {
    name: 'Kimera Vel Tech',
    address: 'kimeraveltech@gmail.com',
  });
  assert.equal(captured.mail?.to, 'customer@example.com');
  assert.equal(captured.mail?.text, input().message);
  assert.match(String(captured.mail?.html), /Dear Customer/);
  const attachments = captured.mail?.attachments as Array<Record<string, unknown>>;
  assert.equal(attachments[0].filename, 'Invoice-INV-1.pdf');
  assert.equal(attachments[0].contentType, 'application/pdf');
  assert.deepEqual(attachments[0].content, pdf(1));
});

test('handles invoice, quotation and delivery-note PDF attachments, Tamil, and page counts', async () => {
  const cases = [
    ['Invoice-INV-1.pdf', 'Invoice INV-1', 'Please find the invoice.', 1],
    ['Quotation-QT-1.pdf', 'Quotation QT-1', 'Please find the quotation.', 2],
    ['Delivery-Note-DN-1.pdf', 'Delivery Note DN-1', 'Please find the delivery note.', 1],
    ['விலைப்பட்டியல்-INV-2.pdf', 'விலைப்பட்டியல் INV-2', 'விலைப்பட்டியல் இணைக்கப்பட்டுள்ளது.', 2],
  ] as const;

  for (const [filename, subject, message, pages] of cases) {
    const captured: { mail?: Record<string, unknown> } = {};
    const result = await sendEmailWithGmailSmtp(input({
      filename,
      subject,
      message,
      attachment: pdf(pages),
    }), {}, successfulTransport(captured, `<${filename}@gmail.com>`));
    const attachment = (captured.mail?.attachments as Array<Record<string, unknown>>)[0];

    assert.equal(result.messageId, `<${filename}@gmail.com>`);
    assert.equal(attachment.filename, filename);
    assert.equal(attachment.contentType, 'application/pdf');
    assert.deepEqual(attachment.content, pdf(pages));
    assert.equal(captured.mail?.text, message);
    assert.match(String(captured.mail?.html), /<!doctype html>/);
  }
});

test('returns safe SMTP configuration, recipient, authentication, connection, rejection, and size errors', async (t) => {
  await t.test('missing SMTP username', async () => {
    delete process.env.GMAIL_SMTP_USER;
    assert.equal(getGmailSmtpConfiguration().configured, false);
    await assert.rejects(
      sendEmailWithGmailSmtp(input()),
      (error: unknown) => error instanceof HttpError && error.status === 503 && error.code === 'GMAIL_SMTP_NOT_CONFIGURED',
    );
  });

  await t.test('missing App Password', async () => {
    configureGmailSmtp();
    delete process.env.GMAIL_SMTP_APP_PASSWORD;
    assert.equal(getGmailSmtpConfiguration().configured, false);
    await assert.rejects(
      sendEmailWithGmailSmtp(input()),
      (error: unknown) => error instanceof HttpError && error.status === 503 && error.code === 'GMAIL_SMTP_NOT_CONFIGURED',
    );
  });

  await t.test('invalid customer email', async () => {
    configureGmailSmtp();
    await assert.rejects(
      sendEmailWithGmailSmtp(input({ recipientEmail: 'invalid' })),
      (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === 'INVALID_RECIPIENT',
    );
  });

  await t.test('invalid or revoked App Password', async () => {
    configureGmailSmtp();
    const factory = () => ({
      sendMail: async () => { throw Object.assign(new Error('Authentication rejected'), { code: 'EAUTH', responseCode: 535 }); },
    });
    await assert.rejects(
      sendEmailWithGmailSmtp(input(), {}, factory),
      (error: unknown) => error instanceof HttpError && error.status === 503 && error.code === 'GMAIL_SMTP_AUTH_FAILED',
    );
  });

  await t.test('SMTP connection failure', async () => {
    configureGmailSmtp();
    const factory = () => ({
      sendMail: async () => { throw Object.assign(new Error('Connection failed'), { code: 'ECONNECTION', command: 'CONN' }); },
    });
    await assert.rejects(
      sendEmailWithGmailSmtp(input(), {}, factory),
      (error: unknown) => error instanceof HttpError && error.status === 502 && error.code === 'GMAIL_SMTP_CONNECTION_FAILED',
    );
  });

  await t.test('Gmail message rejection', async () => {
    configureGmailSmtp();
    const factory = () => ({
      sendMail: async () => { throw Object.assign(new Error('Rejected'), { code: 'EMESSAGE', responseCode: 550 }); },
    });
    await assert.rejects(
      sendEmailWithGmailSmtp(input(), {}, factory),
      (error: unknown) => error instanceof HttpError && error.status === 422 && error.code === 'GMAIL_SMTP_REJECTED',
    );
  });

  await t.test('oversized PDF', async () => {
    configureGmailSmtp();
    await assert.rejects(
      sendEmailWithGmailSmtp(input({ attachment: Buffer.alloc(2_000_001) })),
      (error: unknown) => error instanceof HttpError && error.status === 413 && error.code === 'ATTACHMENT_TOO_LARGE',
    );
  });
});
