import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { Availability, getAvailability } from '../services/integrations';

const disabled: Availability = { email: false, postal: false, signature: true, gst: false, barcode: false, ocr: false, ai: false };
export function useIntegrationAvailability() {
  const [availability, setAvailability] = useState<Availability>(disabled);
  const [status, setStatus] = useState<'loading' | 'configured' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    auth?.currentUser?.getIdToken().then((token) => getAvailability(token)).then((result) => {
      if (!active) return;
      if (result?.ok) { setAvailability(result.value); setStatus('configured'); } else setStatus('error');
    }).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, []);
  return { availability, status };
}
