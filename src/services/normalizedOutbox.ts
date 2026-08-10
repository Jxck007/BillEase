import type { AppState } from '../lib/types';
import { contentHash } from './firestoreSerialization';
import type { DurableSyncOutbox, PendingEntityRef } from './localDataStore';

type EntityType = PendingEntityRef['entityType'];

function collection(state: AppState, type: EntityType): Array<{ id: string }> {
  if (type === 'customer') return state.customers;
  if (type === 'product') return state.products;
  if (type === 'invoice') return state.invoices.filter((entry) => entry.type !== 'estimate');
  if (type === 'quotation') return state.invoices.filter((entry) => entry.type === 'estimate');
  if (type === 'deliveryNote') return state.deliveryNotes;
  if (type === 'payment') return state.payments;
  if (type === 'expense') return state.expenses;
  if (type === 'audit') return state.auditLogs;
  return [];
}

const ENTITY_TYPES: EntityType[] = ['customer', 'product', 'invoice', 'quotation', 'deliveryNote', 'payment', 'expense', 'audit'];

export function deriveNormalizedMutations(before: AppState, after: AppState): PendingEntityRef[] {
  const changes: PendingEntityRef[] = [];
  for (const entityType of ENTITY_TYPES) {
    const previous = collection(before, entityType);
    const next = collection(after, entityType);
    const previousById = new Map(previous.map((entry) => [entry.id, entry]));
    const nextById = new Map(next.map((entry) => [entry.id, entry]));
    for (const id of new Set([...previousById.keys(), ...nextById.keys()])) {
      const oldValue = previousById.get(id);
      const newValue = nextById.get(id);
      if (contentHash(oldValue ?? null) === contentHash(newValue ?? null)) continue;
      changes.push({
        entityType,
        entityId: id,
        baseHash: oldValue ? contentHash(oldValue) : null,
        data: newValue ?? null,
        position: newValue
          ? (entityType === 'invoice' || entityType === 'quotation'
            ? after.invoices.findIndex((entry) => entry.id === id)
            : next.findIndex((entry) => entry.id === id))
          : undefined,
        operationType: !oldValue ? 'create' : !newValue ? 'delete' : 'update',
      });
    }
  }
  if (contentHash(before.profile) !== contentHash(after.profile)) {
    changes.push({ entityType: 'profile', entityId: 'business', baseHash: contentHash(before.profile), data: after.profile, operationType: 'update' });
  }
  if (contentHash(before.settings) !== contentHash(after.settings)) {
    changes.push({ entityType: 'settings', entityId: 'company', baseHash: contentHash(before.settings), data: after.settings, operationType: 'update' });
  }
  return changes;
}

export function createNormalizedOutboxOperation(input: {
  operationId: string;
  operationType: DurableSyncOutbox['operationType'];
  before: AppState;
  after: AppState;
  queuedAt?: string;
}): DurableSyncOutbox {
  return {
    operationId: input.operationId,
    operationType: input.operationType,
    entities: deriveNormalizedMutations(input.before, input.after),
    queuedAt: input.queuedAt || new Date().toISOString(),
    retryCount: 0,
  };
}

export function restoreLegacyOutbox(operation: DurableSyncOutbox, state: AppState): DurableSyncOutbox {
  if (operation.entities.some((entry) => entry.entityType === 'app')) return operation;
  return {
    ...operation,
    entities: operation.entities.map((entry) => {
      if (entry.data !== undefined) return entry;
      if (entry.entityType === 'profile') return { ...entry, data: state.profile, operationType: 'update' as const };
      if (entry.entityType === 'settings') return { ...entry, data: state.settings, operationType: 'update' as const };
      const entries = collection(state, entry.entityType);
      const value = entries.find((candidate) => candidate.id === entry.entityId);
      return { ...entry, data: value ?? null, position: value ? entries.findIndex((candidate) => candidate.id === entry.entityId) : undefined, operationType: value ? operation.operationType : 'delete' };
    }),
  };
}
