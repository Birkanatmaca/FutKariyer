import { useCallback } from 'react';
import type { FootballService } from './football-service';
import { useFootballResource } from './useFootballResource';

// This week's bulletin; the server caches it for 15 minutes.
export function useAnkaraBulletin(
  service: FootballService,
  token: string,
  enabled = true,
) {
  const load = useCallback(
    () => service.ankaraBulletin(token),
    [service, token],
  );
  return useFootballResource(load, { keepData: true, enabled });
}
