import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { AppState } from '../lib/types';
import { db, getAppDataEnvelope } from '../lib/firebase';
import { getNormalizedAppState } from '../lib/normalizedFirebase';
import { generateId } from '../lib/utils';
import { errorReference, recordDiagnostic } from '../services/diagnostics';
import { type DurableSyncOutbox, type LocalAppRecord, loadLocalAppState, saveRecoverySnapshot } from '../services/localDataStore';
import { restoreLegacyOutbox } from '../services/normalizedOutbox';
import { mergeRemoteWithPendingEntities } from '../services/persistencePolicy';
import type { SyncDetails, SyncStatus } from '../context/dataContextTypes';
import { hydrateAppState } from './hydrateAppState';

type DataHydrationDependencies = {
  firebaseConfigured: boolean;
  firestoreDataMode: string;
  normalizedMode: boolean;
  signedIn: boolean;
  stateRef: MutableRefObject<AppState>;
  dirtyRef: MutableRefObject<boolean>;
  localRevision: MutableRefObject<number>;
  remoteRevision: MutableRefObject<number>;
  latestOperationId: MutableRefObject<string>;
  pendingSync: MutableRefObject<DurableSyncOutbox | null>;
  normalizedOutbox: MutableRefObject<DurableSyncOutbox[]>;
  setState: Dispatch<SetStateAction<AppState>>;
  setIsLoaded: Dispatch<SetStateAction<boolean>>;
  setCloudSyncEnabled: Dispatch<SetStateAction<boolean>>;
  setHasDirtyChanges: Dispatch<SetStateAction<boolean>>;
  setSyncBlocked: Dispatch<SetStateAction<boolean>>;
  setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
  setSyncNotice: Dispatch<SetStateAction<string | null>>;
  setSyncDetails: Dispatch<SetStateAction<SyncDetails>>;
  setLastSavedAt: Dispatch<SetStateAction<string | null>>;
  persistLocal: (next: AppState, dirty: boolean, revision?: number) => Promise<void>;
};

export function useDataHydration({
  firebaseConfigured, firestoreDataMode, normalizedMode, signedIn, stateRef, dirtyRef,
  localRevision, remoteRevision, latestOperationId, pendingSync, normalizedOutbox,
  setState, setIsLoaded, setCloudSyncEnabled, setHasDirtyChanges, setSyncBlocked,
  setSyncStatus, setSyncNotice, setSyncDetails, setLastSavedAt, persistLocal,
}: DataHydrationDependencies) {
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setSyncStatus('loading');
      let local: LocalAppRecord | null = null;
      let localValid = true;
      try {
        local = await loadLocalAppState();
        if (local && active) {
          const effectiveDirty = local.dirty && firebaseConfigured;
          const hydrated = hydrateAppState(local.data);
          stateRef.current = hydrated.value;
          setState(hydrated.value);
          localRevision.current = local.localRevision;
          remoteRevision.current = local.remoteRevision;
          pendingSync.current = effectiveDirty
            ? local.pendingSync || local.pendingOperations?.[0] || {
              operationId: generateId(), operationType: 'update', entities: [{ entityType: 'app', entityId: 'aggregate' }],
              queuedAt: local.updatedAt, retryCount: 0,
            }
            : null;
          normalizedOutbox.current = effectiveDirty && normalizedMode
            ? (local.pendingOperations?.length
              ? local.pendingOperations
              : pendingSync.current ? [restoreLegacyOutbox(pendingSync.current, hydrated.value)] : [])
            : [];
          latestOperationId.current = pendingSync.current?.operationId || '';
          setHasDirtyChanges(effectiveDirty);
          dirtyRef.current = effectiveDirty;
          setSyncDetails((current) => ({ ...current, pendingChanges: effectiveDirty ? 1 : 0, pendingSince: effectiveDirty ? local!.updatedAt : null }));
          setSyncStatus(effectiveDirty ? 'local' : 'online');
          setLastSavedAt(local.updatedAt);
          if (local.dirty && !effectiveDirty) {
            pendingSync.current = null;
            await persistLocal(hydrated.value, false, local.localRevision);
          } else if (effectiveDirty && !local.pendingSync) {
            await persistLocal(hydrated.value, true, local.localRevision);
          }
          if (hydrated.errors.length) {
            localValid = false;
            setSyncBlocked(true);
            await saveRecoverySnapshot(local, 'validation-warning');
            setSyncNotice('Some stored records need attention. The original data was preserved in recovery storage.');
          }
        }
      } catch {
        const reference = errorReference('LOAD');
        setSyncNotice(`Local recovery storage is unavailable. Keep this tab open while editing. Error reference: ${reference}`);
        recordDiagnostic({ operation: 'read', entityType: 'app', status: 'failed', errorCategory: 'local-storage', errorReference: reference });
      }
      if (signedIn && db) {
        try {
          const normalized = normalizedMode ? await getNormalizedAppState() : null;
          const envelope = normalized ? null : (firestoreDataMode === 'normalized' ? null : await getAppDataEnvelope());
          const remoteData = normalized || envelope?.data;
          if (remoteData && active) {
            remoteRevision.current = envelope?.revision || remoteRevision.current + 1;
            const hydrated = hydrateAppState(remoteData);
            if (hydrated.errors.length) {
              if (local) await saveRecoverySnapshot({ ...local, data: hydrated.value }, 'malformed-cloud-data');
              setSyncNotice('Cloud data contains records that need attention. Nothing was deleted or overwritten.');
            } else if (!local?.dirty || !localValid) {
              stateRef.current = hydrated.value;
              setState(hydrated.value);
              dirtyRef.current = false;
              setHasDirtyChanges(false);
              setSyncBlocked(false);
              await persistLocal(hydrated.value, false, localRevision.current);
            } else {
              const pendingEntities = normalizedMode ? normalizedOutbox.current.flatMap((entry) => entry.entities) : pendingSync.current?.entities || [];
              const merged = mergeRemoteWithPendingEntities(stateRef.current, hydrated.value, pendingEntities);
              stateRef.current = merged.value;
              setState(merged.value);
              if (merged.conflicts.length) {
                setSyncBlocked(true);
                setSyncStatus('action-required');
                setSyncNotice('Another device changed the same record. Cloud overwrite is blocked; both versions were preserved in recovery storage.');
                await saveRecoverySnapshot({ ...local, data: hydrated.value, dirty: false, pendingSync: undefined }, 'incoming-cloud-conflict');
              }
              await persistLocal(merged.value, true, localRevision.current);
            }
          }
          setCloudSyncEnabled(true);
        } catch {
          const reference = errorReference('CLOUD');
          setSyncStatus(local ? (local.dirty ? 'offline' : 'local') : 'offline');
          setSyncNotice(`Cloud sync is unavailable. Your work remains saved on this device. Error reference: ${reference}`);
          recordDiagnostic({ operation: 'read', entityType: 'app', status: 'failed', errorCategory: 'network-or-auth', errorReference: reference });
        }
      } else {
        setCloudSyncEnabled(false);
        setSyncStatus(local ? (local.dirty ? 'offline' : 'local') : 'offline');
      }
      if (active) setIsLoaded(true);
    };
    void initialize();
    return () => { active = false; };
  }, [firebaseConfigured, firestoreDataMode, normalizedMode, persistLocal, signedIn]);
}
