export type DiagnosticEvent = {
  operationId?: string;
  operation: string;
  entityType: string;
  entityId?: string;
  localRevision?: number;
  remoteRevision?: number;
  /** @deprecated Use localRevision or remoteRevision for new events. */
  revision?: number;
  status: string;
  resultCategory?: string;
  errorCategory?: string;
  errorReference?: string;
  queuedAt?: string;
  attemptedAt?: string;
  acknowledgedAt?: string;
  retryCount?: number;
  timestamp: string;
  online: boolean;
  authState: 'signed-in' | 'signed-out' | 'unknown';
};

const events: DiagnosticEvent[] = [];

function anonymousId(value?: string) {
  if (!value) return undefined;
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `h_${(hash >>> 0).toString(16)}`;
}

export function errorReference(prefix = 'ERR') {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix.toUpperCase()}`;
}

export function recordDiagnostic(event: Omit<DiagnosticEvent, 'timestamp' | 'online' | 'authState' | 'entityId'> & { entityId?: string; signedIn?: boolean }) {
  const { signedIn, ...safeEvent } = event;
  events.push({
    ...safeEvent,
    entityId: anonymousId(event.entityId),
    timestamp: new Date().toISOString(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    authState: typeof signedIn === 'boolean' ? (signedIn ? 'signed-in' : 'signed-out') : 'unknown',
  });
  if (events.length > 200) events.splice(0, events.length - 200);
}

export function exportDiagnostics() {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), events }, null, 2);
}
