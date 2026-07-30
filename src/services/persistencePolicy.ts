import { AppState } from '../lib/types';

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
