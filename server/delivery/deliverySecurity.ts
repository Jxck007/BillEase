import { HttpError } from '../http/errors';

const SENDING_LOCK_MS = 2 * 60 * 1000;
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60 * 1000;

export async function enforceDeliveryRateLimit(db: any, uid: string, channel: 'email' | 'whatsapp') {
  const windowId = Math.floor(Date.now() / RATE_WINDOW_MS);
  const reference = db.doc(`billeaseDeliveryRateLimits/${uid}_${channel}_${windowId}`);

  await db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.get(reference);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= RATE_LIMIT) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many delivery requests. Please wait a minute.');
    }
    transaction.set(reference, {
      count: count + 1,
      expiresAt: new Date((windowId + 2) * RATE_WINDOW_MS).toISOString(),
    }, { merge: true });
  });
}

export async function reserveDelivery(
  db: any,
  channel: 'email' | 'whatsapp',
  idempotencyKey: string,
  metadata: { documentId: string; recipient: string },
) {
  if (!/^[a-zA-Z0-9_-]{12,120}$/.test(idempotencyKey)) {
    throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid idempotency key is required');
  }

  const reference = db.doc(`billeaseDeliveries/${channel}_${idempotencyKey}`);
  const reservation = await db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data() || {};
    if (snapshot.exists && current.status === 'sent') {
      return { state: 'already_sent', data: current };
    }

    const startedAt = Date.parse(String(current.startedAt || ''));
    if (snapshot.exists && current.status === 'sending' && Number.isFinite(startedAt) && Date.now() - startedAt < SENDING_LOCK_MS) {
      return { state: 'in_progress', data: current };
    }

    transaction.set(reference, {
      channel,
      documentId: metadata.documentId,
      recipient: metadata.recipient,
      status: 'sending',
      startedAt: new Date().toISOString(),
    });
    return { state: 'reserved', data: null };
  });

  return { reference, ...reservation };
}

export async function markDeliverySent(reference: any, messageId: string | null, sentAt: string) {
  await reference.set({
    providerMessageId: messageId,
    status: 'sent',
    timestamp: sentAt,
  }, { merge: true });
}

export async function markDeliveryFailed(reference: any) {
  await reference.set({
    status: 'failed',
    timestamp: new Date().toISOString(),
  }, { merge: true });
}
