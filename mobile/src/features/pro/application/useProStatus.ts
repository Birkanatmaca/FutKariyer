import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { ProService } from './pro-service';
import type { ProStatus } from '../domain/models';

// Pro status refreshed on every focus; the last known value stays visible while
// reloading so badges do not flicker. Failures leave the badge hidden.
export function useProStatus(service: ProService, token: string | null) {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [eligible, setEligible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      if (!token) {
        setStatus(null);
        return () => {
          current = false;
        };
      }
      service
        .status(token)
        .then(value => {
          if (current) {
            setStatus(value.pro);
            setEligible(value.eligible);
          }
        })
        .catch(() => {
          if (current) setStatus(null);
        });
      return () => {
        current = false;
      };
    }, [service, token]),
  );
  const refresh = useCallback(() => {
    if (!token) return;
    service
      .status(token)
      .then(value => setStatus(value.pro))
      .catch(() => setStatus(null));
  }, [service, token]);
  return {
    status,
    eligible,
    isPro: !!status?.active,
    replace: setStatus,
    refresh,
  };
}
