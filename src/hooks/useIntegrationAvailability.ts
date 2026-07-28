import { useEffect, useState } from 'react';
import { getDeliveryProviderStatus } from '../services/documentDeliveryService';

export type Availability = {
  email: boolean;
  whatsapp: boolean;
  whatsappConnected: boolean;
  postal: boolean;
  signature: true;
  gst: false;
  barcode: false;
  ocr: false;
  ai: false;
};

const disabled: Availability = { email: false, whatsapp: false, whatsappConnected: false, postal: false, signature: true, gst: false, barcode: false, ocr: false, ai: false };
export function useIntegrationAvailability() {
  const [availability, setAvailability] = useState<Availability>(disabled);
  const [status, setStatus] = useState<'loading' | 'configured' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    getDeliveryProviderStatus().then((result) => {
      if (!active) return;
      setAvailability({
        ...disabled,
        email: result.email.configured && result.email.available,
        whatsapp: result.whatsapp.configured && result.whatsapp.available,
        whatsappConnected: result.whatsapp.instanceConnected,
        postal: Boolean(result.postal),
      });
      setStatus('configured');
    }).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, []);
  return { availability, status };
}
