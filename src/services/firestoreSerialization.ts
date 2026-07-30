export function sanitizeForFirestore(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => sanitizeForFirestore(entry, seen));
  if (typeof value === 'object') {
    if (seen.has(value as object)) return null;
    seen.add(value as object);
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) output[key] = sanitizeForFirestore(entry, seen);
    }
    return output;
  }
  return value;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

export function contentHash(value: unknown) {
  const serialized = JSON.stringify(stableValue(sanitizeForFirestore(value)));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}
