export const config = { api: { bodyParser: false } };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SafeHttpError = {
  status: number;
  code: string;
};

function isSafeHttpError(error: unknown): error is SafeHttpError {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Partial<SafeHttpError>;
  return Number.isInteger(candidate.status) && typeof candidate.code === 'string';
}

function sendEmailError(response: any, error: unknown) {
  if (isSafeHttpError(error)) {
    if (error.status === 400) return response.status(400).json({ ok: false, code: error.code, error: 'Invalid request.' });
    if (error.status === 401) return response.status(401).json({ ok: false, code: error.code, error: 'Unauthorized.' });
    if (error.status === 403) return response.status(403).json({ ok: false, code: error.code, error: 'Admin access denied.' });
    if (error.status === 409) return response.status(409).json({ ok: false, code: error.code, error: 'This document is already being sent.' });
    if (error.status === 413) return response.status(413).json({ ok: false, code: error.code, error: 'Attachment is too large.' });
    if (error.status === 422) return response.status(422).json({ ok: false, code: error.code, error: error.code === 'SENDER_NOT_VERIFIED' ? 'The email sender is not verified.' : 'Email provider rejected the request.' });
    if (error.status === 429) return response.status(429).json({ ok: false, code: error.code, error: 'Too many requests.' });
    if (error.status === 502) return response.status(502).json({ ok: false, code: error.code, error: 'Email provider is unavailable.' });
    if (error.status === 503) return response.status(503).json({ ok: false, code: error.code, error: 'Email provider is not configured.' });
    if (error.status === 504) return response.status(504).json({ ok: false, code: error.code, error: 'Email provider timed out.' });
  }
  return response.status(500).json({ ok: false, code: 'EMAIL_SEND_FAILED', error: 'Unable to send the email.' });
}

export default async function handler(request: any, response: any) {
  console.info('[email/send-document] endpoint invoked', {
    method: String(request.method || 'UNKNOWN'),
  });

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed.' });
  }

  console.info('[email/send-document] configuration present', {
    firebaseAdmin: Boolean(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim()),
    resend: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()),
    bearerToken: /^Bearer [^\s]+$/i.test(String(request.headers?.authorization || '')),
    contentType: String(request.headers?.['content-type'] || '').split(';', 1)[0].slice(0, 100),
    approximateRequestBytes: Number(request.headers?.['content-length'] || 0) || null,
  });

  let deliveryReference: any = null;
  let markFailed: ((reference: any) => Promise<void>) | null = null;
  let phase: 'startup' | 'authentication' | 'validation' | 'provider' = 'startup';

  try {
    const [
      { randomUUID },
      { verifyAdminRequest },
      { parseBase64EmailRequest, readJsonRequestBody },
      deliverySecurity,
      { parseDocumentMultipart },
      { resolveTrustedDocumentAndCustomer },
      { HttpError },
      { getResendConfiguration, sendEmailWithResend },
    ] = await Promise.all([
      import('node:crypto'),
      import('../../server/auth/verifyAdminRequest.js'),
      import('../../server/delivery/base64DocumentRequest.js'),
      import('../../server/delivery/deliverySecurity.js'),
      import('../../server/delivery/parseDocumentMultipart.js'),
      import('../../server/delivery/trustedApplicationData.js'),
      import('../../server/http/errors.js'),
      import('../../server/providers/resendEmailProvider.js'),
    ]);
    const {
      enforceDeliveryRateLimit,
      markDeliveryFailed,
      markDeliverySent,
      reserveDelivery,
    } = deliverySecurity;
    markFailed = markDeliveryFailed;

    phase = 'authentication';
    let db;
    let uid;
    try {
      ({ db, uid } = await verifyAdminRequest(request, {
        tokenVerified: () => console.info('[email/send-document] Firebase token verified', { verified: true }),
        adminLookupStarted: () => console.info('[email/send-document] admin lookup', { status: 'started' }),
        adminLookupCompleted: (allowed) => console.info('[email/send-document] admin lookup', { status: 'completed', allowed }),
      }));
      console.info('[email/send-document] authentication outcome', { authenticatedAdmin: true });
    } catch (error) {
      console.warn('[email/send-document] authentication outcome', {
        authenticatedAdmin: false,
        status: isSafeHttpError(error) ? error.status : 500,
        code: isSafeHttpError(error) ? error.code : 'AUTHENTICATION_FAILED',
      });
      throw error;
    }

    phase = 'validation';
    const validateEmailInput = (fields: Record<string, string>) => {
      const recipientEmail = String(fields.recipientEmail || '').trim().toLowerCase();
      const ccEmail = String(fields.ccEmail || '').trim().toLowerCase();
      const subject = String(fields.subject || '').trim();
      const message = String(fields.message || '').trim();
      if (!EMAIL_PATTERN.test(recipientEmail) || recipientEmail.length > 254
        || (ccEmail && (!EMAIL_PATTERN.test(ccEmail) || ccEmail.length > 254))) {
        throw new HttpError(400, 'INVALID_RECIPIENT', 'Invalid email recipient');
      }
      if (!subject || subject.length > 200 || /[\r\n]/.test(subject)
        || !message || message.length > 3000) {
        throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid email delivery details');
      }
      return { recipientEmail, ccEmail, subject, message };
    };

    const isMultipart = String(request.headers?.['content-type'] || '').toLowerCase().startsWith('multipart/form-data');
    let email;
    let attachment;
    let documentId;
    let requestedIdempotencyKey;

    if (isMultipart) {
      const parsed = await parseDocumentMultipart(request);
      const fields = parsed.fields;
      email = validateEmailInput(fields);
      attachment = parsed.attachment;
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
      attachment = {
        buffer: parsed.attachment,
        filename: parsed.filename,
        mimeType: parsed.mimeType,
        decodedBytes: parsed.attachment.length,
      };
      documentId = parsed.documentId;
      requestedIdempotencyKey = parsed.idempotencyKey;
    }

    console.info('[email/send-document] attachment validated', {
      type: attachment.mimeType,
      decodedBytes: attachment.decodedBytes,
    });
    const resendConfiguration = getResendConfiguration();
    if (!resendConfiguration.configured) {
      throw new HttpError(503, 'RESEND_NOT_CONFIGURED', 'Email provider is not configured');
    }
    await enforceDeliveryRateLimit(db, uid, 'email');
    const idempotencyKey = String(request.headers?.['idempotency-key'] || requestedIdempotencyKey || randomUUID()).trim();
    const reservation = await reserveDelivery(db, 'email', idempotencyKey, {
      documentId,
      recipient: email.recipientEmail,
    });
    deliveryReference = reservation.reference;

    if (reservation.state === 'already_sent') {
      return response.status(200).json({
        ok: true,
        messageId: reservation.data?.providerMessageId || undefined,
        status: 'already_sent',
        sentAt: reservation.data?.timestamp || undefined,
      });
    }
    if (reservation.state === 'in_progress') {
      throw new HttpError(409, 'DELIVERY_IN_PROGRESS', 'This email is already being sent');
    }

    phase = 'provider';
    console.info('[email/send-document] Resend request', { status: 'started' });
    const result = await sendEmailWithResend({
      ...email,
      ccEmail: email.ccEmail || undefined,
      filename: attachment.filename,
      attachment: attachment.buffer,
      idempotencyKey,
    }, {
      request: (serializedBytes) => console.info('[email/send-document] Resend request', {
        status: 'serialized',
        approximateBytes: serializedBytes,
      }),
      response: (status, providerType) => console.info('[email/send-document] Resend response', {
        status,
        providerType,
      }),
    });
    const sentAt = new Date().toISOString();
    await markDeliverySent(deliveryReference, result.messageId, sentAt);
    console.info('[email/send-document] Resend provider outcome', {
      status: 'sent',
      messageIdPresent: Boolean(result.messageId),
    });
    console.info('[email/send-document] normalized completion', { ok: true, status: 'sent' });
    return response.status(200).json({
      ok: true,
      status: 'sent',
      messageId: result.messageId || undefined,
      providerMessageId: result.messageId || undefined,
      sentAt,
    });
  } catch (error) {
    if (deliveryReference && markFailed && !(isSafeHttpError(error) && error.code === 'DELIVERY_IN_PROGRESS')) {
      await markFailed(deliveryReference).catch(() => undefined);
    }
    console.warn('[email/send-document] request failed', {
      phase,
      status: isSafeHttpError(error) ? error.status : 500,
      code: isSafeHttpError(error) ? error.code : 'EMAIL_SEND_FAILED',
    });
    if (phase === 'provider') {
      console.warn('[email/send-document] Resend provider outcome', {
        status: 'failed',
        code: isSafeHttpError(error) ? error.code : 'EMAIL_SEND_FAILED',
      });
    }
    console.info('[email/send-document] normalized completion', {
      ok: false,
      status: isSafeHttpError(error) ? error.status : 500,
      code: isSafeHttpError(error) ? error.code : 'EMAIL_SEND_FAILED',
    });
    return sendEmailError(response, error);
  }
}
