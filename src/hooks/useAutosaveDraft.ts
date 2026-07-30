import { useCallback, useEffect, useRef, useState } from 'react';
import { DeliveryNote, Invoice } from '../lib/types';
import { DurableDraft, saveLocalDraft } from '../services/localDataStore';

export type DraftSaveStatus = 'unchanged' | 'unsaved' | 'saving' | 'saved-locally' | 'failed';

type DraftDocument = Partial<Invoice> | Partial<DeliveryNote>;

export function useAutosaveDraft<T extends DraftDocument>(draft: T, enabled: boolean, key: string, documentType: 'invoice' | 'quotation' | 'delivery-note') {
  const current = useRef(draft);
  const revision = useRef(0);
  const createdAt = useRef(new Date().toISOString());
  const lastSaved = useRef('');
  const [status, setStatus] = useState<DraftSaveStatus>('unchanged');
  current.current = draft;
  const serialized = JSON.stringify(draft);

  const flush = useCallback(async () => {
    const value = current.current;
    const nextSerialized = JSON.stringify(value);
    if (nextSerialized === lastSaved.current) return true;
    if (!value.id) return false;
    setStatus('saving');
    revision.current += 1;
    const record: DurableDraft<T> = {
      version: 1,
      documentId: value.id,
      documentType,
      value,
      createdAt: createdAt.current,
      updatedAt: new Date().toISOString(),
      localRevision: revision.current,
      syncStatus: 'local',
    };
    try {
      await saveLocalDraft(key, record);
      lastSaved.current = nextSerialized;
      setStatus('saved-locally');
      return true;
    } catch {
      setStatus('failed');
      return false;
    }
  }, [documentType, key]);

  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return;
    setStatus('unsaved');
    const timer = window.setTimeout(() => { void flush(); }, 1000);
    return () => window.clearTimeout(timer);
  }, [enabled, flush, serialized]);

  useEffect(() => {
    if (!enabled) return;
    const visibility = () => { if (document.visibilityState === 'hidden') void flush(); };
    const pagehide = () => { void flush(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [enabled, flush]);

  return { flushDraft: flush, draftSaveStatus: status, hasUnsavedDraft: status === 'unsaved' || status === 'saving' || status === 'failed' };
}
