import { useEffect } from 'react';
import { Invoice } from '../lib/types';
import { saveDraft } from '../services/invoiceService';

export function useAutosaveDraft(draft: Partial<Invoice>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!draft.invoiceNumber && !draft.customerId && (!draft.items || draft.items.length === 0)) return;
    const timer = window.setTimeout(() => {
      saveDraft(draft);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, enabled]);
}