import { createHash } from 'node:crypto';
import type { AppState } from '../../src/lib/types';

export type FirestorePortableValue = unknown;

export type AggregateBackup = {
  backupFormatVersion: 1;
  sourcePath: 'billease/appData';
  projectId: string;
  exportedAt: string;
  checksumAlgorithm: 'sha256';
  checksum: string;
  envelope: Record<string, unknown> & { data: AppState };
};

function portable(value: any): any {
  if (value?.constructor?.name === 'Timestamp' && Number.isFinite(value.seconds)) {
    return { $firestoreType: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value?.constructor?.name === 'GeoPoint') {
    return { $firestoreType: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value?.constructor?.name === 'DocumentReference' && value.path) {
    return { $firestoreType: 'reference', path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $firestoreType: 'bytes', base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, portable(value[key])]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(portable(value));
}

export function sha256(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function createAggregateBackup(projectId: string, envelope: Record<string, unknown> & { data: AppState }, exportedAt = new Date().toISOString()): AggregateBackup {
  const normalizedEnvelope = portable(envelope);
  return {
    backupFormatVersion: 1,
    sourcePath: 'billease/appData',
    projectId,
    exportedAt,
    checksumAlgorithm: 'sha256',
    checksum: sha256(normalizedEnvelope),
    envelope: normalizedEnvelope,
  };
}

export function verifyAggregateBackup(value: unknown): asserts value is AggregateBackup {
  const backup = value as Partial<AggregateBackup>;
  if (backup.backupFormatVersion !== 1 || backup.sourcePath !== 'billease/appData' || backup.checksumAlgorithm !== 'sha256' || !backup.envelope?.data) {
    throw new Error('INVALID_BACKUP_FORMAT');
  }
  if (sha256(backup.envelope) !== backup.checksum) throw new Error('BACKUP_CHECKSUM_MISMATCH');
}

export function revivePortable(value: any, firestore: { Timestamp: { new(seconds: number, nanoseconds: number): unknown }; GeoPoint: { new(latitude: number, longitude: number): unknown } }): any {
  if (Array.isArray(value)) return value.map((entry) => revivePortable(entry, firestore));
  if (value && typeof value === 'object') {
    if (value.$firestoreType === 'timestamp') return new firestore.Timestamp(value.seconds, value.nanoseconds);
    if (value.$firestoreType === 'geopoint') return new firestore.GeoPoint(value.latitude, value.longitude);
    if (value.$firestoreType === 'bytes') return Buffer.from(value.base64, 'base64');
    if (value.$firestoreType === 'reference') throw new Error('REFERENCE_RESTORE_REQUIRES_DATABASE');
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, revivePortable(entry, firestore)]));
  }
  return value;
}
