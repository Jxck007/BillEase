import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler, { gmailSmtpSuccessPayload } from '../api/email/send-document.js';

function responseRecorder() {
  const record: { status?: number; body?: Record<string, unknown>; headers: Record<string, string> } = { headers: {} };
  const response = {
    setHeader: (name: string, value: string) => { record.headers[name] = value; },
    status: (status: number) => {
      record.status = status;
      return response;
    },
    json: (body: Record<string, unknown>) => {
      record.body = body;
      return body;
    },
  };
  return { record, response };
}

async function withoutRouteLogs(work: () => Promise<void>) {
  const info = console.info;
  const warn = console.warn;
  console.info = () => undefined;
  console.warn = () => undefined;
  try {
    await work();
  } finally {
    console.info = info;
    console.warn = warn;
  }
}

test('preserves POST /api/email/send-document and rejects other methods', async () => {
  const { record, response } = responseRecorder();
  await handler({ method: 'GET', headers: {} }, response);
  assert.equal(record.status, 405);
  assert.equal(record.headers.Allow, 'POST');
  assert.equal(record.body?.code, 'METHOD_NOT_ALLOWED');
});

test('email endpoint cannot be used anonymously', async () => {
  await withoutRouteLogs(async () => {
    const { record, response } = responseRecorder();
    await handler({ method: 'POST', headers: {} }, response);
    assert.equal(record.status, 401);
    assert.equal(record.body?.ok, false);
    assert.equal(record.body?.code, 'AUTH_REQUIRED');
  });
});

test('successful route payload has the stable Gmail SMTP provider and message ID', () => {
  const payload = gmailSmtpSuccessPayload('sent', '<message@gmail.com>', '2026-07-30T00:00:00.000Z');
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, 'gmail-smtp');
  assert.equal(payload.messageId, '<message@gmail.com>');
  assert.equal(payload.status, 'sent');
});
