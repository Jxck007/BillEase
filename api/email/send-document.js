import { requireAdmin, fail } from '../_auth.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOCUMENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,160}$/;
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9_-]{12,120}$/;
const PDF_NAME_PATTERN = /^[^/\\\u0000-\u001f]{1,150}\.pdf$/i;
// Base64 expands the payload by roughly one third. Keep the decoded PDF below
// 3 MB so the complete JSON request remains under Vercel's 4.5 MB body limit.
const MAX_PDF_BYTES = 3_000_000;
const SENDING_LOCK_MS = 2 * 60 * 1000;

function parseRequest(body = {}) {
  const documentId = String(body.documentId || '').trim();
  const recipient = String(body.recipient || '').trim();
  const cc = String(body.cc || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const filename = String(body.filename || '').trim();
  const pdfBase64 = String(body.pdfBase64 || '');
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  const pdfBytes = Buffer.byteLength(pdfBase64, 'base64');

  const valid = DOCUMENT_ID_PATTERN.test(documentId)
    && EMAIL_PATTERN.test(recipient)
    && recipient.length <= 254
    && (!cc || (EMAIL_PATTERN.test(cc) && cc.length <= 254))
    && subject.length > 0
    && subject.length <= 200
    && message.length > 0
    && message.length <= 3000
    && PDF_NAME_PATTERN.test(filename)
    && IDEMPOTENCY_PATTERN.test(idempotencyKey)
    && /^[a-zA-Z0-9+/]+={0,2}$/.test(pdfBase64)
    && pdfBytes > 0
    && pdfBytes <= MAX_PDF_BYTES;

  if (!valid) throw Object.assign(new Error('Invalid email request'), { status: 400 });
  return { documentId, recipient, cc, subject, message, filename, pdfBase64, idempotencyKey };
}

async function reserveDelivery(db, delivery, metadata) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(delivery);
    if (snapshot.exists) {
      const existing = snapshot.data() || {};
      if (existing.status === 'sent') return 'already_sent';

      const startedAt = Date.parse(String(existing.startedAt || ''));
      if (existing.status === 'sending' && Number.isFinite(startedAt) && Date.now() - startedAt < SENDING_LOCK_MS) {
        return 'in_progress';
      }
    }

    transaction.set(delivery, {
      ...metadata,
      status: 'sending',
      startedAt: new Date().toISOString(),
    });
    return 'reserved';
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { db } = await requireAdmin(req);
    const input = parseRequest(req.body);
    if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
      return res.status(503).json({ error: 'Server email is not configured' });
    }

    const delivery = db.doc(`billeaseEmailDeliveries/${input.idempotencyKey}`);
    const reservation = await reserveDelivery(db, delivery, {
      documentId: input.documentId,
      recipient: input.recipient,
    });

    if (reservation === 'already_sent') return res.json({ status: 'already_sent' });
    if (reservation === 'in_progress') return res.status(409).json({ error: 'This email is already being sent' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9_000);
    let response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [input.recipient],
          ...(input.cc ? { cc: [input.cc] } : {}),
          subject: input.subject,
          text: input.message,
          attachments: [{ filename: input.filename, content: input.pdfBase64 }],
        }),
      });
    } catch {
      await delivery.set({ status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
      throw Object.assign(new Error('Email provider unavailable'), { status: 504 });
    } finally {
      clearTimeout(timeout);
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await delivery.set({
        status: 'failed',
        failedAt: new Date().toISOString(),
      }, { merge: true });
      return res.status(502).json({ error: 'Email provider rejected the request' });
    }

    await delivery.set({
      documentId: input.documentId,
      recipient: input.recipient,
      providerMessageId: result.id || null,
      status: 'sent',
      sentAt: new Date().toISOString(),
    }, { merge: true });

    return res.json({ messageId: result.id || undefined, status: 'sent' });
  } catch (error) {
    return fail(res, error);
  }
}
