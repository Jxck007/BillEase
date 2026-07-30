import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { HttpError } from '../server/http/errors.js';
import {
  createGmailMimeMessage,
  getGmailConfiguration,
  sendEmailWithGmail,
} from '../server/providers/gmailEmailProvider.js';

const GMAIL_KEYS = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_SENDER_EMAIL',
] as const;
const originalEnvironment = Object.fromEntries(GMAIL_KEYS.map((key) => [key, process.env[key]]));

function configureGmail() {
  process.env.GMAIL_CLIENT_ID = 'mock-client-id';
  process.env.GMAIL_CLIENT_SECRET = 'mock-client-secret';
  process.env.GMAIL_REFRESH_TOKEN = 'mock-refresh-token';
  process.env.GMAIL_SENDER_EMAIL = 'kimeraveltech@gmail.com';
}

function pdf(pageCount: 1 | 2) {
  return Buffer.from(`%PDF-1.7\n/Type /Pages /Count ${pageCount}\n%%EOF`, 'ascii');
}

function input(overrides: Partial<Parameters<typeof sendEmailWithGmail>[0]> = {}) {
  return {
    recipientEmail: 'customer@example.com',
    subject: 'Invoice INV-1',
    message: 'Dear Customer,\n\nPlease find the document attached.',
    filename: 'Invoice_INV-1.pdf',
    mimeType: 'application/pdf' as const,
    attachment: pdf(1),
    ...overrides,
  };
}

beforeEach(configureGmail);
afterEach(() => {
  for (const key of GMAIL_KEYS) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('validates the fixed server-only Gmail sender configuration', () => {
  assert.equal(getGmailConfiguration().configured, true);
  process.env.GMAIL_SENDER_EMAIL = 'spoofed@example.com';
  assert.equal(getGmailConfiguration().configured, false);
});

test('builds MIME with plain text, HTML, UTF-8 subject and a PDF attachment', () => {
  const mime = createGmailMimeMessage({
    senderEmail: 'kimeraveltech@gmail.com',
    recipientEmail: 'customer@example.com',
    subject: 'விலைப்பட்டியல் INV-1',
    message: 'வணக்கம்,\n\nஆவணம் இணைக்கப்பட்டுள்ளது.',
    filename: 'Invoice_INV-1.pdf',
    mimeType: 'application/pdf',
    attachment: pdf(2),
  }, 'fixed');

  assert.match(mime, /^From: kimeraveltech@gmail\.com\r\nTo: customer@example\.com/m);
  assert.match(mime, /Subject: =\?UTF-8\?B\?.+\?=/);
  assert.match(mime, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(mime, /Content-Type: text\/html; charset=UTF-8/);
  assert.match(mime, /Content-Type: application\/pdf; name="Invoice_INV-1\.pdf"/);
  assert.match(mime, /Content-Disposition: attachment; filename="Invoice_INV-1\.pdf"/);
  assert.ok(mime.includes(pdf(2).toString('base64')));
});

test('sends invoice, quotation and delivery-note PDFs in English and Tamil through mocked Gmail', async () => {
  const cases = [
    ['Invoice_INV-1.pdf', 'Invoice INV-1', 'Please find the invoice.', 1],
    ['Quotation_Q-1.pdf', 'Quotation Q-1', 'Please find the quotation.', 2],
    ['Delivery_Note_DN-1.pdf', 'Delivery Note DN-1', 'Please find the delivery note.', 1],
    ['Invoice_INV-2.pdf', 'விலைப்பட்டியல் INV-2', 'விலைப்பட்டியல் இணைக்கப்பட்டுள்ளது.', 2],
    ['Quotation_Q-2.pdf', 'விலைமதிப்பீடு Q-2', 'விலைமதிப்பீடு இணைக்கப்பட்டுள்ளது.', 1],
    ['Delivery_Note_DN-2.pdf', 'விநியோகக் குறிப்பு DN-2', 'விநியோகக் குறிப்பு இணைக்கப்பட்டுள்ளது.', 2],
  ] as const;

  for (const [filename, subject, message, pages] of cases) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'mock-access-token' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: `gmail-${filename}` }), { status: 200 });
    }) as typeof fetch;

    const result = await sendEmailWithGmail(input({
      filename,
      subject,
      message,
      attachment: pdf(pages),
    }), {}, mockFetch);

    assert.equal(result.messageId, `gmail-${filename}`);
    assert.equal(calls.length, 2);
    assert.equal(new Headers(calls[1].init?.headers).get('Authorization'), 'Bearer mock-access-token');
    const requestBody = JSON.parse(String(calls[1].init?.body));
    const mime = Buffer.from(requestBody.raw, 'base64url').toString('utf8');
    assert.match(mime, /From: kimeraveltech@gmail\.com/);
    assert.match(mime, new RegExp(`filename="${filename.replace('.', '\\.')}"`));
    assert.ok(mime.includes(pdf(pages).toString('base64')));
  }
});

test('returns safe configuration, recipient, revoked-token, API and size errors', async (t) => {
  await t.test('missing configuration', async () => {
    delete process.env.GMAIL_CLIENT_SECRET;
    await assert.rejects(
      sendEmailWithGmail(input(), {}, (async () => new Response()) as typeof fetch),
      (error: unknown) => error instanceof HttpError && error.status === 503 && error.code === 'GMAIL_NOT_CONFIGURED',
    );
  });

  await t.test('invalid recipient', async () => {
    configureGmail();
    await assert.rejects(
      sendEmailWithGmail(input({ recipientEmail: 'invalid' }), {}, (async () => new Response()) as typeof fetch),
      (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === 'INVALID_RECIPIENT',
    );
  });

  await t.test('revoked refresh token', async () => {
    configureGmail();
    const mockFetch = (async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as typeof fetch;
    await assert.rejects(
      sendEmailWithGmail(input(), {}, mockFetch),
      (error: unknown) => error instanceof HttpError && error.status === 503 && error.code === 'GMAIL_AUTH_REVOKED',
    );
  });

  await t.test('Gmail API rejection', async () => {
    configureGmail();
    let call = 0;
    const mockFetch = (async () => {
      call += 1;
      return call === 1
        ? new Response(JSON.stringify({ access_token: 'mock-access-token' }), { status: 200 })
        : new Response(JSON.stringify({ error: { message: 'rejected' } }), { status: 400 });
    }) as typeof fetch;
    await assert.rejects(
      sendEmailWithGmail(input(), {}, mockFetch),
      (error: unknown) => error instanceof HttpError && error.status === 422 && error.code === 'GMAIL_API_REJECTED',
    );
  });

  await t.test('oversized attachment', async () => {
    configureGmail();
    await assert.rejects(
      sendEmailWithGmail(input({ attachment: Buffer.alloc(2_000_001) }), {}, (async () => new Response()) as typeof fetch),
      (error: unknown) => error instanceof HttpError && error.status === 413 && error.code === 'ATTACHMENT_TOO_LARGE',
    );
  });
});
