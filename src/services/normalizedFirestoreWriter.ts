import { doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { contentHash, sanitizeForFirestore } from './firestoreSerialization';
import type { DurableSyncOutbox, PendingEntityRef } from './localDataStore';
import type { NormalizedCollection } from './normalizedFirestoreModel';

export function normalizedEntityPath(ref: PendingEntityRef, companyId: string) {
  const collectionNames: Partial<Record<PendingEntityRef['entityType'], NormalizedCollection>> = {
    customer: 'customers', product: 'products', invoice: 'invoices', quotation: 'quotations',
    deliveryNote: 'deliveryNotes', payment: 'payments', expense: 'expenses', audit: 'auditLogs',
  };
  if (ref.entityType === 'profile') return `companies/${companyId}`;
  if (ref.entityType === 'settings') return `companies/${companyId}/settings/company`;
  const name = collectionNames[ref.entityType];
  if (!name) throw new Error('UNSUPPORTED_NORMALIZED_ENTITY');
  return `companies/${companyId}/${name}/${ref.entityId}`;
}

function desiredHash(ref: PendingEntityRef) {
  return contentHash(ref.data ?? null);
}

export async function commitNormalizedOperation(database: Firestore, operation: DurableSyncOutbox, sourceDeviceId: string, localRevision: number, companyId: string) {
  if (!operation.entities.length) return;
  if (operation.entities.some((entry) => entry.entityType === 'app' || entry.data === undefined)) {
    const error = new Error('LEGACY_OUTBOX_REQUIRES_REVIEW');
    error.name = 'RemoteRevisionConflictError';
    throw error;
  }
  const batch = writeBatch(database);
  for (const entry of operation.entities) {
    const reference = doc(database, normalizedEntityPath(entry, companyId));
    const data = sanitizeForFirestore(entry.data ?? null);
    const common = {
      revision: localRevision,
      contentHash: desiredHash(entry),
      baseHash: entry.baseHash ?? null,
      clientOperationId: operation.operationId,
      sourceDeviceId,
      updatedAt: serverTimestamp(),
    };
    if (entry.entityType === 'profile') batch.set(reference, { data: { profile: data }, ...common }, { merge: true });
    else if (entry.entityType === 'settings') batch.set(reference, { data, ...common }, { merge: true });
    else batch.set(reference, {
      data,
      position: entry.position ?? Number.MAX_SAFE_INTEGER,
      deleted: entry.operationType === 'delete' || entry.data === null,
      ...common,
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    const snapshots = await Promise.all(operation.entities.map((entry) => getDoc(doc(database, normalizedEntityPath(entry, companyId)))));
    const idempotent = snapshots.every((snapshot, index) => snapshot.exists()
      && snapshot.data()?.clientOperationId === operation.operationId
      && snapshot.data()?.contentHash === desiredHash(operation.entities[index]));
    if (!idempotent) throw error;
  }
}
