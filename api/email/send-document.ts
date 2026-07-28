import { randomUUID } from 'node:crypto';
import { verifyAdminRequest } from '../../server/auth/verifyAdminRequest';
import { parseBase64EmailRequest, readJsonRequestBody } from '../../server/delivery/base64DocumentRequest';
import { enforceDeliveryRateLimit, markDeliveryFailed, markDeliverySent, reserveDelivery } from '../../server/delivery/deliverySecurity';
import { parseDocumentMultipart } from '../../server/delivery/parseDocumentMultipart';
import { resolveTrustedDocumentAndCustomer } from '../../server/delivery/trustedApplicationData';
import { HttpError } from '../../server/http/errors';
import { getResendConfiguration, sendEmailWithResend } from '../../server/providers/resendEmailProvider';

export const config = { api: { bodyParser: false } };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailInput(fields: Record<string, string>) {
  const recipientEmail = String(fields.recipientEmail || '').trim().toLowerCase();
  const ccEmail = String(fields.ccEmail || '').trim().toLowerCase();
  const subject = String(fields.subject || '').trim();
  const message = String(fields.message || '').trim();

  if (!EMAIL_PATTERN.test(recipientEmail) || recipientEmail.length > 254
    || (ccEmail && (!EMAIL_PATTERN.test(ccEmail) || ccEmail.length > 254))
    || !subject || subject.length > 200 || /[\r\n]/.test(subject)
    || !message || message.length > 3000) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid email delivery details');
  }
  return { recipientEmail, ccEmail, subject, message };
}

function sendEmailError(response: any, error: unknown) {
  if (error instanceof HttpError) {
    if (error.status === 400) return response.status(400).json({ ok: false, error: 'Invalid request.' });
    if (error.status === 401) return response.status(401).json({ ok: false, error: 'Unauthorized.' });
    if (error.status === 403) return response.status(403).json({ ok: false, error: 'Admin access denied.' });
    if (error.status === 409) return response.status(409).json({ ok: false, error: 'This document is already being sent.' });
    if (error.status === 413) return response.status(413).json({ ok: false, error: 'Attachment is too large.' });
    if (error.status === 429) return response.status(429).json({ ok: false, error: 'Too many requests.' });
    if (error.status === 502) return response.status(502).json({ ok: false, error: 'Email provider is unavailable.' });
    if (error.status === 503) return response.status(503).json({ ok: false, error: 'Email provider is not configured.' });
  }
  return response.status(500).json({ ok: false, error: 'Unable to send the email.' });
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  console.info('[email/send-document] endpoint invoked');
  let deliveryReference: any = null;
  try {
    const { db, uid } = await verifyAdminRequest(request);
    console.info('[email/send-document] authentication succeeded');
    const resendConfiguration = getResendConfiguration();
    console.info('[email/send-document] configuration status', {
      firebaseAdmin: true,
      resend: resendConfiguration.configured,
    });
    if (!resendConfiguration.configured) {
      throw new HttpError(503, 'PROVIDER_NOT_CONFIGURED', 'Email provider is not configured');
    }

    const isMultipart = String(request.headers?.['content-type'] || '').toLowerCase().startsWith('multipart/form-data');
    let email;
    let pdf;
    let documentId;
    let requestedIdempotencyKey;

    if (isMultipart) {
      const parsed = await parseDocumentMultipart(request);
      const fields = parsed.fields;
      email = validateEmailInput(fields);
      pdf = parsed.pdf;
      documentId = fields.documentId;
      requestedIdempotencyKey = fields.idempotencyKey;

      const { customer } = await resolveTrustedDocumentAndCustomer(db, {
        documentId: fields.documentId,
        documentType: fields.documentType,
        documentNumber: fields.documentNumber,
        customerId: fields.customerId,
      });
      const customerEmail = String(customer.email || '').trim().toLowerCase();
      if (email.recipientEmail !== customerEmail && fields.recipientEdited !== 'true') {
        throw new HttpError(400, 'RECIPIENT_MISMATCH', 'Confirm the edited recipient email');
      }
    } else {
      const parsed = parseBase64EmailRequest(await readJsonRequestBody(request));
      email = {
        recipientEmail: parsed.recipientEmail,
        ccEmail: parsed.ccEmail || '',
        subject: parsed.subject,
        message: parsed.message,
      };
      pdf = { buffer: parsed.pdf, filename: parsed.filename };
      documentId = parsed.documentId;
      requestedIdempotencyKey = parsed.idempotencyKey;
    }

    await enforceDeliveryRateLimit(db, uid, 'email');
    const idempotencyKey = String(request.headers?.['idempotency-key'] || requestedIdempotencyKey || randomUUID()).trim();
    const reservation = await reserveDelivery(db, 'email', idempotencyKey, {
      documentId,
      recipient: email.recipientEmail,
    });
    deliveryReference = reservation.reference;

    if (reservation.state === 'already_sent') {
      return response.json({
        ok: true,
        messageId: reservation.data?.providerMessageId || undefined,
        status: 'already_sent',
        sentAt: reservation.data?.timestamp || undefined,
      });
    }
    if (reservation.state === 'in_progress') {
      throw new HttpError(409, 'DELIVERY_IN_PROGRESS', 'This email is already being sent');
    }

    const result = await sendEmailWithResend({
      ...email,
      ccEmail: email.ccEmail || undefined,
      filename: pdf.filename,
      pdf: pdf.buffer,
      idempotencyKey,
    });
    const sentAt = new Date().toISOString();
    await markDeliverySent(deliveryReference, result.messageId, sentAt);
    console.info('[email/send-document] Resend request succeeded', {
      messageIdPresent: Boolean(result.messageId),
    });
    return response.json({
      ok: true,
      status: 'sent',
      messageId: result.messageId || undefined,
      providerMessageId: result.messageId || undefined,
      sentAt,
    });
  } catch (error) {
    if (deliveryReference && !(error instanceof HttpError && error.code === 'DELIVERY_IN_PROGRESS')) {
      await markDeliveryFailed(deliveryReference).catch(() => undefined);
    }
    console.warn('[email/send-document] request failed', {
      status: error instanceof HttpError ? error.status : 500,
      code: error instanceof HttpError ? error.code : 'EMAIL_SEND_FAILED',
    });
    return sendEmailError(response, error);
  }
}
