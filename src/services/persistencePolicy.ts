import { AppState } from '../lib/types';
import { contentHash } from './firestoreSerialization';
import { PendingEntityRef } from './localDataStore';

export type RemoteSnapshotDecision = 'ignore-stale' | 'apply' | 'merge-and-preserve';

export function decideRemoteSnapshot(currentRemoteRevision: number, incomingRevision: number, localDirty: boolean): RemoteSnapshotDecision {
  if (incomingRevision <= currentRemoteRevision) return 'ignore-stale';
  return localDirty ? 'merge-and-preserve' : 'apply';
}

export function mergeRemoteWithoutLosingLocal(local: AppState, remote: AppState): AppState {
  const mergeById = <T extends { id: string }>(localItems: T[], remoteItems: T[]) => {
    const merged = new Map(remoteItems.map((entry) => [entry.id, entry]));
    localItems.forEach((entry) => merged.set(entry.id, entry));
    return [...merged.values()];
  };
  return {
    ...remote,
    ...local,
    customers: mergeById(local.customers, remote.customers),
    products: mergeById(local.products, remote.products),
    invoices: mergeById(local.invoices, remote.invoices),
    payments: mergeById(local.payments, remote.payments),
    expenses: mergeById(local.expenses, remote.expenses),
    deliveryNotes: mergeById(local.deliveryNotes, remote.deliveryNotes),
    auditLogs: mergeById(local.auditLogs, remote.auditLogs).slice(0, 200),
  };
}

export type RemoteMergeResult = {
  value: AppState;
  conflicts: PendingEntityRef[];
};

export function entityContentHash(state: AppState, ref: Pick<PendingEntityRef, 'entityType' | 'entityId'>): string | null {
  if (ref.entityType === 'profile') return contentHash(state.profile);
  if (ref.entityType === 'settings') return contentHash(state.settings);
  if (ref.entityType === 'app') return contentHash(state);
  const collections: Partial<Record<PendingEntityRef['entityType'], Array<{ id: string }>>> = {
    customer: state.customers,
    product: state.products,
    invoice: state.invoices,
    quotation: state.invoices,
    deliveryNote: state.deliveryNotes,
    payment: state.payments,
    expense: state.expenses,
    audit: state.auditLogs,
  };
  const entry = collections[ref.entityType]?.find((item) => item.id === ref.entityId);
  return entry ? contentHash(entry) : null;
}

function uniqueEntityRefs(entries: PendingEntityRef[]) {
  return Array.from(new Map(entries.map((entry) => [`${entry.entityType}:${entry.entityId}`, entry])).values());
}

/**
 * Three-way intent merge for the aggregate Firestore document.
 *
 * The durable outbox records which entities changed locally since the last
 * acknowledged remote revision. Remote values own every untouched entity;
 * local values own newly-created/touched entities. A touched entity that also
 * changed remotely is reported as a conflict so callers can block an unsafe
 * financial overwrite and retain both recovery snapshots.
 */
export function mergeRemoteWithPendingEntities(
  local: AppState,
  remote: AppState,
  pendingEntities: PendingEntityRef[],
): RemoteMergeResult {
  if (!pendingEntities.length || pendingEntities.some((entry) => entry.entityType === 'app')) {
    return {
      value: local,
      conflicts: contentHash(local) === contentHash(remote)
        ? []
        : [{ entityType: 'app', entityId: 'aggregate' }],
    };
  }

  const conflicts: PendingEntityRef[] = [];
  const touchedRefs = (types: PendingEntityRef['entityType'][]) => new Map(
    pendingEntities.filter((entry) => types.includes(entry.entityType)).map((entry) => [entry.entityId, entry]),
  );
  const mergeCollection = <T extends { id: string }>(
    localItems: T[],
    remoteItems: T[],
    touched: Map<string, PendingEntityRef>,
    conflictType: PendingEntityRef['entityType'],
  ) => {
    const localById = new Map(localItems.map((entry) => [entry.id, entry]));
    const remoteById = new Map(remoteItems.map((entry) => [entry.id, entry]));
    const merged = new Map(remoteById);
    touched.forEach((pending, id) => {
      const localEntry = localById.get(id);
      const remoteEntry = remoteById.get(id);
      const remoteHash = remoteEntry ? contentHash(remoteEntry) : null;
      const localHash = localEntry ? contentHash(localEntry) : null;
      if ((pending.baseHash === undefined || remoteHash !== pending.baseHash) && localHash !== remoteHash) {
        conflicts.push({ entityType: conflictType, entityId: id });
      }
      if (localEntry) merged.set(id, localEntry);
      else merged.delete(id);
    });
    return [...merged.values()];
  };

  const profilePending = pendingEntities.find((entry) => entry.entityType === 'profile');
  const settingsPending = pendingEntities.find((entry) => entry.entityType === 'settings');
  const profileTouched = Boolean(profilePending);
  const settingsTouched = Boolean(settingsPending);
  if (profilePending && (profilePending.baseHash === undefined || contentHash(remote.profile) !== profilePending.baseHash) && contentHash(local.profile) !== contentHash(remote.profile)) conflicts.push({ entityType: 'profile', entityId: 'business' });
  if (settingsPending && (settingsPending.baseHash === undefined || contentHash(remote.settings) !== settingsPending.baseHash) && contentHash(local.settings) !== contentHash(remote.settings)) conflicts.push({ entityType: 'settings', entityId: 'app' });

  const auditLogs = new Map(remote.auditLogs.map((entry) => [entry.id, entry]));
  local.auditLogs.forEach((entry) => auditLogs.set(entry.id, entry));

  return {
    value: {
      ...remote,
      customers: mergeCollection(local.customers, remote.customers, touchedRefs(['customer']), 'customer'),
      products: mergeCollection(local.products, remote.products, touchedRefs(['product']), 'product'),
      invoices: mergeCollection(local.invoices, remote.invoices, touchedRefs(['invoice', 'quotation']), 'invoice'),
      payments: mergeCollection(local.payments, remote.payments, touchedRefs(['payment']), 'payment'),
      expenses: mergeCollection(local.expenses, remote.expenses, touchedRefs(['expense']), 'expense'),
      deliveryNotes: mergeCollection(local.deliveryNotes, remote.deliveryNotes, touchedRefs(['deliveryNote']), 'deliveryNote'),
      profile: profileTouched ? local.profile : remote.profile,
      settings: settingsTouched ? local.settings : remote.settings,
      auditLogs: [...auditLogs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200),
    },
    conflicts: uniqueEntityRefs(conflicts),
  };
}
