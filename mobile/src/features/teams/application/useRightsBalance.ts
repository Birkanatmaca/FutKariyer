import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { TeamsService } from './teams-service';

// Remaining team application rights, reloaded whenever the screen gains focus.
// The last value stays visible while reloading; failures hide the badge.
export function useRightsBalance(
  service: Pick<TeamsService, 'rightsBalance'>,
  token: string | null,
  enabled: boolean,
) {
  const [balance, setBalance] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      if (!token || !enabled) {
        setBalance(null);
        return () => {
          current = false;
        };
      }
      service
        .rightsBalance(token)
        .then(value => {
          if (current) setBalance(value);
        })
        .catch(() => {
          if (current) setBalance(null);
        });
      return () => {
        current = false;
      };
    }, [service, token, enabled]),
  );
  return balance;
}
