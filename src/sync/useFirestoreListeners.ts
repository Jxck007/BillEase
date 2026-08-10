import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { AppState } from '../lib/types';
import { type AppDataEnvelope, contentHash, db } from '../lib/firebase';
import { subscribeNormalizedAppState } from '../lib/normalizedFirebase';
import { hydrateAppState } from '../persistence/hydrateAppState';
import { errorReference, recordDiagnostic } from '../services/diagnostics';
import { type DurableSyncOutbox, LOCAL_DATA_VERSION, type LocalAppRecord, saveRecoverySnapshot } from '../services/localDataStore';
import { decideRemoteSnapshot, mergeRemoteWithPendingEntities } from '../services/persistencePolicy';
import { isMatchingServerAcknowledgement } from '../services/syncPolicy';
import type { SyncDetails, SyncStatus } from '../context/dataContextTypes';

type PersistLocal = (next: AppState, dirty: boolean, revision?: number) => Promise<void>;

type ListenerDependencies = {
  normalizedMode: boolean;
  cloudSyncEnabled: boolean;
  signedIn: boolean;
  stateRef: MutableRefObject<AppState>;
  dirtyRef: MutableRefObject<boolean>;
  localRevision: MutableRefObject<number>;
  remoteRevision: MutableRefObject<number>;
  latestOperationId: MutableRefObject<string>;
  deviceId: MutableRefObject<string>;
  pendingSync: MutableRefObject<DurableSyncOutbox | null>;
  normalizedOutbox: MutableRefObject<DurableSyncOutbox[]>;
  pendingAcknowledgement: MutableRefObject<{ operationId: string; hash: string; revision?: number } | null>;
  setState: Dispatch<SetStateAction<AppState>>;
  setSyncBlocked: Dispatch<SetStateAction<boolean>>;
  setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
  setSyncNotice: Dispatch<SetStateAction<string | null>>;
  setSyncDetails: Dispatch<SetStateAction<SyncDetails>>;
  persistLocal: PersistLocal;
  acknowledgeCommittedState: (operationId: string, revision: number, resultCategory: string) => Promise<void>;
};

export function useFirestoreListeners({
  normalizedMode, cloudSyncEnabled, signedIn, stateRef, dirtyRef, localRevision,
  remoteRevision, latestOperationId, deviceId, pendingSync, normalizedOutbox,
  pendingAcknowledgement, setState, setSyncBlocked, setSyncStatus, setSyncNotice,
  setSyncDetails, persistLocal, acknowledgeCommittedState,
}: ListenerDependencies) {
  useEffect(() => {
    if (normalizedMode || !cloudSyncEnabled || !signedIn || !db) return;
    return onSnapshot(doc(db, 'billease', 'appData'), { includeMetadataChanges: true }, async (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache || !snapshot.exists()) return;
      const payload = snapshot.data() as AppDataEnvelope;
      const incomingRevision = Number(payload.revision || 0);
      const pending = pendingAcknowledgement.current;
      if (isMatchingServerAcknowledgement({ fromCache: snapshot.metadata.fromCache, hasPendingWrites: snapshot.metadata.hasPendingWrites, operationId: payload.clientOperationId, hash: contentHash(payload.data) }, pending)) {
        await acknowledgeCommittedState(payload.clientOperationId, incomingRevision, 'server-snapshot');
        return;
      }
      if (pending && payload.sourceDeviceId === deviceId.current) {
        remoteRevision.current = Math.max(remoteRevision.current, incomingRevision);
        return;
      }
      if (payload.clientOperationId === latestOperationId.current) return;
      const decision = decideRemoteSnapshot(remoteRevision.current, incomingRevision, dirtyRef.current);
      if (decision === 'ignore-stale') return;
      const hydrated = hydrateAppState(payload.data);
      if (hydrated.errors.length) {
        setSyncBlocked(true);
        setSyncStatus('action-required');
        setSyncNotice('A cloud version contains invalid records. It was not applied; your local data is safe.');
        return;
      }
      if (decision === 'merge-and-preserve') {
        const currentRecord: LocalAppRecord = {
          version: LOCAL_DATA_VERSION, data: stateRef.current, localRevision: localRevision.current,
          remoteRevision: remoteRevision.current, updatedAt: new Date().toISOString(), dirty: true,
        };
        await saveRecoverySnapshot(currentRecord, 'concurrent-cloud-version');
        const merged = mergeRemoteWithPendingEntities(stateRef.current, hydrated.value, pendingSync.current?.entities || []);
        remoteRevision.current = incomingRevision;
        stateRef.current = merged.value;
        setState(merged.value);
        if (merged.conflicts.length) {
          setSyncBlocked(true);
          await saveRecoverySnapshot({ ...currentRecord, data: hydrated.value, remoteRevision: incomingRevision, dirty: false, pendingSync: undefined }, 'incoming-cloud-conflict');
          await persistLocal(merged.value, true);
          setSyncStatus('action-required');
          setSyncNotice('Another device changed the same record. Cloud overwrite is blocked; both versions were preserved in recovery storage.');
          recordDiagnostic({ operationId: pendingSync.current?.operationId, operation: 'merge', entityType: 'app', localRevision: localRevision.current, remoteRevision: incomingRevision, status: 'blocked', resultCategory: 'same-entity-conflict', signedIn });
          return;
        }
        await persistLocal(merged.value, true);
        setSyncNotice('Changes from another device were merged with your pending work.');
        recordDiagnostic({ operationId: pendingSync.current?.operationId, operation: 'merge', entityType: 'app', localRevision: localRevision.current, remoteRevision: incomingRevision, status: 'merged', resultCategory: 'different-entity-merge', signedIn });
        return;
      }
      remoteRevision.current = incomingRevision;
      stateRef.current = hydrated.value;
      setState(hydrated.value);
      await persistLocal(hydrated.value, false);
    }, () => {
      const reference = errorReference('SYNC');
      setSyncStatus('failed');
      setSyncNotice(`Your document could not be synced yet. It is saved safely on this device and will retry when you choose Retry. Error reference: ${reference}`);
      setSyncDetails((current) => ({ ...current, errorReference: reference }));
      recordDiagnostic({ operation: 'listen', entityType: 'app', status: 'failed', errorCategory: 'network-or-auth', errorReference: reference });
    });
  }, [acknowledgeCommittedState, cloudSyncEnabled, normalizedMode, persistLocal, signedIn]);

  useEffect(() => {
    if (!normalizedMode || !cloudSyncEnabled || !signedIn || !db) return;
    return subscribeNormalizedAppState(async (remoteState, metadata) => {
      if (metadata.hasPendingWrites || metadata.fromCache) return;
      const hydrated = hydrateAppState(remoteState);
      if (hydrated.errors.length) {
        setSyncBlocked(true);
        setSyncStatus('action-required');
        setSyncNotice('A normalized cloud record is invalid. It was not applied; your local data is safe.');
        return;
      }
      if (dirtyRef.current) {
        const pendingEntities = normalizedOutbox.current.flatMap((entry) => entry.entities);
        const merged = mergeRemoteWithPendingEntities(stateRef.current, hydrated.value, pendingEntities);
        stateRef.current = merged.value;
        setState(merged.value);
        if (merged.conflicts.length) {
          setSyncBlocked(true);
          setSyncStatus('action-required');
          setSyncNotice('Another device changed the same record. Cloud overwrite is blocked; your pending operation remains saved locally.');
          await persistLocal(merged.value, true);
          return;
        }
        await persistLocal(merged.value, true);
        return;
      }
      remoteRevision.current += 1;
      stateRef.current = hydrated.value;
      setState(hydrated.value);
      await persistLocal(hydrated.value, false);
    });
  }, [cloudSyncEnabled, normalizedMode, persistLocal, signedIn]);
}
