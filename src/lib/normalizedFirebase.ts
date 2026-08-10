import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import type { AppState } from './types';
import { db } from './firebase';
import type { DurableSyncOutbox } from '../services/localDataStore';
import { commitNormalizedOperation } from '../services/normalizedFirestoreWriter';
import {
  DEFAULT_COMPANY_ID,
  NORMALIZED_COLLECTIONS,
  type NormalizedCollection,
  type NormalizedEntityDocument,
  type NormalizedMigrationPlan,
  assembleAppState,
} from '../services/normalizedFirestoreModel';

export type FirestoreDataMode = 'aggregate' | 'dual-read' | 'normalized';

export function getFirestoreDataMode(): FirestoreDataMode {
  const value = String(import.meta.env.VITE_FIRESTORE_DATA_MODE || 'aggregate');
  return value === 'normalized' || value === 'dual-read' ? value : 'aggregate';
}

export function getCompanyId() {
  const value = String(import.meta.env.VITE_BILLEASE_COMPANY_ID || DEFAULT_COMPANY_ID);
  return /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(value) ? value : DEFAULT_COMPANY_ID;
}

export async function writeNormalizedOperation(operation: DurableSyncOutbox, sourceDeviceId: string, localRevision: number, companyId = getCompanyId()) {
  if (!db) throw new Error('Firebase not enabled');
  await commitNormalizedOperation(db as any, operation, sourceDeviceId, localRevision, companyId);
}

async function getCollectionPlan(companyId: string, name: NormalizedCollection) {
  const snapshot = await getDocs(collection(db as any, `companies/${companyId}/${name}`));
  return snapshot.docs.map((entry) => entry.data() as NormalizedEntityDocument).filter((entry) => !entry.deleted);
}

export async function getNormalizedAppState(companyId = getCompanyId()): Promise<AppState | null> {
  if (!db) return null;
  const [companySnapshot, settingsSnapshot, ...collections] = await Promise.all([
    getDoc(doc(db as any, `companies/${companyId}`)),
    getDoc(doc(db as any, `companies/${companyId}/settings/company`)),
    ...NORMALIZED_COLLECTIONS.map((name) => getCollectionPlan(companyId, name)),
  ]);
  if (!companySnapshot.exists() || !settingsSnapshot.exists() || companySnapshot.data()?.migrationState !== 'prepared') return null;
  const mapped = Object.fromEntries(NORMALIZED_COLLECTIONS.map((name, index) => [name, collections[index]])) as NormalizedMigrationPlan['collections'];
  return assembleAppState({
    company: companySnapshot.data() as NormalizedMigrationPlan['company'],
    settings: settingsSnapshot.data() as NormalizedMigrationPlan['settings'],
    collections: mapped,
  });
}

export function subscribeNormalizedAppState(callback: (state: AppState, metadata: { fromCache: boolean; hasPendingWrites: boolean }) => void, companyId = getCompanyId()) {
  if (!db) return () => undefined;
  const values = new Map<string, NormalizedEntityDocument[]>();
  let profile: NormalizedMigrationPlan['company'] | null = null;
  let settings: NormalizedMigrationPlan['settings'] | null = null;
  const ready = new Set<string>();
  let fromCache = false;
  let hasPendingWrites = false;
  const emit = () => {
    if (ready.size !== NORMALIZED_COLLECTIONS.length + 2 || !profile || !settings) return;
    const collections = Object.fromEntries(NORMALIZED_COLLECTIONS.map((name) => [name, (values.get(name) || []).filter((entry) => !entry.deleted)])) as NormalizedMigrationPlan['collections'];
    callback(assembleAppState({ company: profile, settings, collections }), { fromCache, hasPendingWrites });
    fromCache = false;
    hasPendingWrites = false;
  };
  const unsubscribers = NORMALIZED_COLLECTIONS.map((name) => onSnapshot(
    collection(db as any, `companies/${companyId}/${name}`),
    { includeMetadataChanges: true },
    (snapshot) => {
      values.set(name, snapshot.docs.map((entry) => entry.data() as NormalizedEntityDocument));
      ready.add(name);
      fromCache ||= snapshot.metadata.fromCache;
      hasPendingWrites ||= snapshot.metadata.hasPendingWrites;
      emit();
    },
  ));
  unsubscribers.push(onSnapshot(doc(db as any, `companies/${companyId}`), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.exists()) profile = snapshot.data() as NormalizedMigrationPlan['company'];
    ready.add('company');
    fromCache ||= snapshot.metadata.fromCache;
    hasPendingWrites ||= snapshot.metadata.hasPendingWrites;
    emit();
  }));
  unsubscribers.push(onSnapshot(doc(db as any, `companies/${companyId}/settings/company`), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.exists()) settings = snapshot.data() as NormalizedMigrationPlan['settings'];
    ready.add('settings');
    fromCache ||= snapshot.metadata.fromCache;
    hasPendingWrites ||= snapshot.metadata.hasPendingWrites;
    emit();
  }));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
