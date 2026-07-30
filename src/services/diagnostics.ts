export type DiagnosticEvent = {
  operation: string;
  entityType: string;
  entityId?: string;
  revision?: number;
  status: string;
  errorCategory?: string;
  errorReference?: string;
  timestamp: string;
  online: boolean;
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

export function recordDiagnostic(event: Omit<DiagnosticEvent, 'timestamp' | 'online' | 'entityId'> & { entityId?: string }) {
  events.push({
    ...event,
    entityId: anonymousId(event.entityId),
    timestamp: new Date().toISOString(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  });
  if (events.length > 200) events.splice(0, events.length - 200);
}

export function exportDiagnostics() {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), events }, null, 2);
}
