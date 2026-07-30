import { useEffect, useState } from 'react';
import { getDeliveryProviderStatus } from '../services/documentDeliveryService';

export type Availability = {
  email: boolean;
  postal: boolean;
};

const disabled: Availability = { email: false, postal: false };
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
        postal: Boolean(result.postal),
      });
      setStatus('configured');
    }).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, []);
  return { availability, status };
}
