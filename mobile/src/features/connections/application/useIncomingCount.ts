import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { ConnectionsService } from './connections-service';

// Incoming requests waiting for an answer, reloaded on focus; a failure only
// hides the badge. `loadedAt` changes on every successful load, so a screen
// can react to each fresh count (e.g. a short hint) even when it is unchanged.
export function useIncomingCount(service: ConnectionsService, token: string) {
  const [state, setState] = useState({ count: 0, loadedAt: 0 });
  useFocusEffect(
    useCallback(() => {
      let current = true;
      service.list(token).then(
        inbox =>
          current &&
          setState({ count: inbox.incoming.length, loadedAt: Date.now() }),
        () => current && setState(value => ({ ...value, count: 0 })),
      );
      return () => {
        current = false;
      };
    }, [service, token]),
  );
  return state;
}
