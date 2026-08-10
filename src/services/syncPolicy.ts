export type PendingAcknowledgement = { operationId: string; hash: string } | null;
export type SyncErrorCategory = 'retryable' | 'auth-required' | 'permission-denied' | 'conflict' | 'data-too-large' | 'permanent';

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

export function isCommittedWriteAcknowledgement(input: {
  operationId: string;
  hash: string;
  currentHash: string;
}, pending: PendingAcknowledgement) {
  return Boolean(
    pending
    && input.operationId === pending.operationId
    && input.hash === pending.hash
    && input.hash === input.currentHash,
  );
}

export function classifySyncError(error: unknown): SyncErrorCategory {
  const candidate = error as { code?: string; name?: string } | null;
  const code = String(candidate?.code || '').toLowerCase();
  const name = String(candidate?.name || '');
  if (name === 'RemoteRevisionConflictError') return 'conflict';
  if (name === 'AppDataTooLargeError') return 'data-too-large';
  if (/unauthenticated|auth\//.test(code)) return 'auth-required';
  if (/permission-denied/.test(code)) return 'permission-denied';
  if (/unavailable|deadline-exceeded|aborted|resource-exhausted|network-request-failed/.test(code)) return 'retryable';
  return 'permanent';
}

export function shouldRestartPendingSync(input: {
  wasOnline: boolean;
  online: boolean;
  dirty: boolean;
  signedIn: boolean;
  cloudAvailable: boolean;
}) {
  return !input.wasOnline && input.online && input.dirty && input.signedIn && input.cloudAvailable;
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
