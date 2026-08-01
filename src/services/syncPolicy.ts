export type PendingAcknowledgement = { operationId: string; hash: string } | null;

export function boundedSyncBackoff(attempt: number, jitter = Math.floor(Math.random() * 150)) {
  return Math.min(5_000, 250 * (2 ** Math.max(0, attempt)) + Math.max(0, Math.min(149, jitter)));
}

export function isMatchingServerAcknowledgement(input: {
  fromCache: boolean;
  hasPendingWrites: boolean;
  operationId: string;
  hash: string;
}, pending: PendingAcknowledgement) {
  return Boolean(
    pending
    && !input.fromCache
    && !input.hasPendingWrites
    && input.operationId === pending.operationId
    && input.hash === pending.hash,
  );
}

export function syncPresentationState(input: {
  pendingChanges: number;
  online: boolean;
  signedIn: boolean;
  cloudAvailable: boolean;
  failed?: boolean;
}) {
  if (!input.pendingChanges) return 'saved';
  if (!input.online) return 'offline';
  if (!input.signedIn) return 'sign-in-required';
  if (!input.cloudAvailable) return 'cloud-unavailable';
  if (input.failed) return 'failed';
  return 'syncing';
}
