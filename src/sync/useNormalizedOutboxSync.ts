import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { AppState } from '../lib/types';
import { db } from '../lib/firebase';
import { writeNormalizedOperation } from '../lib/normalizedFirebase';
import { errorReference, recordDiagnostic } from '../services/diagnostics';
import type { DurableSyncOutbox } from '../services/localDataStore';
import { classifySyncError } from '../services/syncPolicy';
import type { SyncDetails, SyncStatus } from '../context/dataContextTypes';

type NormalizedOutboxDependencies = {
  enabled: boolean;
  hasDirtyChanges: boolean;
  syncBlocked: boolean;
  signedIn: boolean;
  retryTrigger: number;
  stateRef: MutableRefObject<AppState>;
  localRevision: MutableRefObject<number>;
  deviceId: MutableRefObject<string>;
  dirtyRef: MutableRefObject<boolean>;
  pendingSync: MutableRefObject<DurableSyncOutbox | null>;
  normalizedOutbox: MutableRefObject<DurableSyncOutbox[]>;
  setHasDirtyChanges: Dispatch<SetStateAction<boolean>>;
  setSyncBlocked: Dispatch<SetStateAction<boolean>>;
  setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
  setSyncNotice: Dispatch<SetStateAction<string | null>>;
  setSyncDetails: Dispatch<SetStateAction<SyncDetails>>;
  persistLocal: (next: AppState, dirty: boolean, revision?: number) => Promise<void>;
};

export function useNormalizedOutboxSync({
  enabled, hasDirtyChanges, syncBlocked, signedIn, retryTrigger, stateRef,
  localRevision, deviceId, dirtyRef, pendingSync, normalizedOutbox,
  setHasDirtyChanges, setSyncBlocked, setSyncStatus, setSyncNotice,
  setSyncDetails, persistLocal,
}: NormalizedOutboxDependencies) {
  useEffect(() => {
    if (!enabled || !hasDirtyChanges || syncBlocked || !signedIn || !db) return;
    let cancelled = false;
    const flush = async () => {
      while (!cancelled && normalizedOutbox.current.length) {
        const operation = normalizedOutbox.current[0];
        operation.retryCount += 1;
        pendingSync.current = operation;
        setSyncStatus('saving');
        setSyncDetails((current) => ({
          ...current,
          pendingChanges: normalizedOutbox.current.length,
          pendingSince: current.pendingSince || operation.queuedAt,
          lastAttemptAt: new Date().toISOString(),
          errorReference: null,
        }));
        await persistLocal(stateRef.current, true);
        try {
          await writeNormalizedOperation(operation, deviceId.current, localRevision.current);
          if (cancelled) return;
          normalizedOutbox.current = normalizedOutbox.current.filter((entry) => entry.operationId !== operation.operationId);
          pendingSync.current = normalizedOutbox.current[0] || null;
          const stillDirty = normalizedOutbox.current.length > 0;
          dirtyRef.current = stillDirty;
          setHasDirtyChanges(stillDirty);
          setSyncBlocked(false);
          setSyncStatus(stillDirty ? 'saving' : 'online');
          setSyncNotice(null);
          setSyncDetails((current) => ({ ...current, pendingChanges: normalizedOutbox.current.length, pendingSince: stillDirty ? current.pendingSince : null, errorReference: null }));
          await persistLocal(stateRef.current, stillDirty);
          recordDiagnostic({ operationId: operation.operationId, operation: 'acknowledge', entityType: 'app', localRevision: localRevision.current, acknowledgedAt: new Date().toISOString(), status: 'synced', resultCategory: 'normalized-batch-commit', signedIn: true });
        } catch (error) {
          if (cancelled) return;
          const category = classifySyncError(error);
          const reference = errorReference(category === 'conflict' ? 'CONFLICT' : 'SYNC');
          const actionRequired = category === 'conflict' || category === 'permission-denied' || category === 'auth-required' || category === 'permanent';
          setSyncBlocked(actionRequired);
          setSyncStatus(actionRequired ? 'action-required' : (navigator.onLine ? 'failed' : 'offline'));
          setSyncNotice(category === 'conflict'
            ? `Another device changed the same record. Your pending operation remains saved locally. Error reference: ${reference}`
            : `Cloud sync is pending. Your work remains saved on this device. Error reference: ${reference}`);
          setSyncDetails((current) => ({ ...current, errorReference: reference }));
          await persistLocal(stateRef.current, true);
          return;
        }
      }
    };
    void flush();
    return () => { cancelled = true; };
  }, [enabled, hasDirtyChanges, persistLocal, retryTrigger, signedIn, syncBlocked]);
}
