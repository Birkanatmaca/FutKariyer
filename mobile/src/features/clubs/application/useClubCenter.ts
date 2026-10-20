import { useCallback, useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import type { ClubCenter } from '../domain/models';
import type { ClubService } from './club-service';

export type ClubCenterState = {
  center: ClubCenter | null;
  loading: boolean;
  error: string | null;
  retry(): void;
};

// One club center read feeds the Merhaba card, the league card and the quick
// action counts. Coming back to the tab reloads it; the last summary stays on
// screen meanwhile so the cards do not collapse and jump.
export function useClubCenter(
  service: ClubService,
  token: string | null,
): ClubCenterState {
  const state = useFocusedResource(
    useCallback(
      () =>
        token
          ? service.center(token)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [service, token],
    ),
  );
  const [last, setLast] = useState<ClubCenter | null>(null);
  useEffect(() => {
    if (state.data) setLast(state.data);
  }, [state.data]);
  return {
    center: state.data ?? (state.loading ? last : null),
    loading: state.loading,
    error: state.error,
    retry: state.retry,
  };
}
