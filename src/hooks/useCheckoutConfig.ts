import { useEffect, useState } from 'react';
import { DEFAULT_CHECKOUT_CONFIG } from '../config/store';
import { checkoutSettingsService } from '../services/hostinger/checkoutSettingsService';

export function useCheckoutConfig() {
  const [config, setConfig] = useState(DEFAULT_CHECKOUT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    checkoutSettingsService.getPublicConfig()
      .then(value => { if (active) setConfig(value); })
      .catch(error => { console.warn('[Store] Using default checkout settings:', error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { config, loading };
}
