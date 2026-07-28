import { verifyAdminRequest } from '../../server/auth/verifyAdminRequest';
import { normalizeWhatsAppNumber } from '../../server/delivery/base64DocumentRequest';
import { enforceDeliveryRateLimit, markDeliveryFailed, markDeliverySent, reserveDelivery } from '../../server/delivery/deliverySecurity';
import { parseDocumentMultipart } from '../../server/delivery/parseDocumentMultipart';
import { resolveTrustedDocumentAndCustomer } from '../../server/delivery/trustedApplicationData';
import { HttpError } from '../../server/http/errors';
import { getEvolutionConfiguration, sendDocumentWithEvolutionGo } from '../../server/providers/evolutionGoProvider';

export const config = { api: { bodyParser: false } };

function sendWhatsAppError(response: any, error: unknown) {
  if (error instanceof HttpError) {
    if (error.status === 400) return response.status(400).json({ ok: false, code: error.code, error: 'Invalid request.' });
    if (error.status === 401) return response.status(401).json({ ok: false, code: error.code, error: 'Unauthorized.' });
    if (error.status === 403) return response.status(403).json({ ok: false, code: error.code, error: 'Admin access denied.' });
    if (error.status === 409) return response.status(409).json({ ok: false, code: error.code, error: 'This document is already being sent.' });
    if (error.status === 413) return response.status(413).json({ ok: false, code: error.code, error: 'Attachment is too large.' });
    if (error.status === 429) return response.status(429).json({ ok: false, code: error.code, error: 'Too many requests.' });
    if (error.status === 502) return response.status(502).json({ ok: false, code: error.code, error: 'WhatsApp provider is unavailable.' });
    if (error.status === 503) return response.status(503).json({ ok: false, code: error.code, error: 'WhatsApp integration is not configured.' });
  }
  return response.status(500).json({ ok: false, code: 'WHATSAPP_SEND_FAILED', error: 'Unable to send the WhatsApp document.' });
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  let deliveryReference: any = null;
  try {
    const { db, uid } = await verifyAdminRequest(request);
    if (!getEvolutionConfiguration().configured) {
      return response.status(503).json({ ok: false, error: 'WhatsApp integration is not configured.' });
    }

    const { fields, pdf } = await parseDocumentMultipart(request);
    const caption = String(fields.caption || '').trim();
    if (!caption || caption.length > 2000) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid WhatsApp caption');
    }

    const { customer } = await resolveTrustedDocumentAndCustomer(db, {
      documentId: fields.documentId,
      documentType: fields.documentType,
      documentNumber: fields.documentNumber,
      customerId: fields.customerId,
    });
    const trustedRecipient = normalizeWhatsAppNumber(customer.whatsapp || customer.phone);
    if (normalizeWhatsAppNumber(fields.recipientNumber) !== trustedRecipient) {
      throw new HttpError(400, 'RECIPIENT_MISMATCH', 'Recipient does not match the selected customer');
    }

    await enforceDeliveryRateLimit(db, uid, 'whatsapp');
    const idempotencyKey = String(request.headers?.['idempotency-key'] || fields.idempotencyKey || '').trim();
    const reservation = await reserveDelivery(db, 'whatsapp', idempotencyKey, {
      documentId: fields.documentId,
      recipient: trustedRecipient,
    });
    deliveryReference = reservation.reference;

    if (reservation.state === 'already_sent') {
      return response.json({
        ok: true,
        status: 'already_sent',
        messageId: reservation.data?.providerMessageId || undefined,
        providerMessageId: reservation.data?.providerMessageId || undefined,
        sentAt: reservation.data?.timestamp || undefined,
      });
    }
    if (reservation.state === 'in_progress') {
      throw new HttpError(409, 'DELIVERY_IN_PROGRESS', 'This WhatsApp document is already being sent');
    }

    const result = await sendDocumentWithEvolutionGo({
      recipientNumber: trustedRecipient,
      caption,
      filename: pdf.filename,
      pdf: pdf.buffer,
      idempotencyKey,
    });
    const sentAt = new Date().toISOString();
    await markDeliverySent(deliveryReference, result.messageId, sentAt);
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
    return sendWhatsAppError(response, error);
  }
}
