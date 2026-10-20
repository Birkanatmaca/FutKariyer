import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { DiscoveryProfile } from '../domain/models';
import type { DiscoveryService } from './discovery-service';

// The coach's İzleme listesi, reloaded on focus. A star flips at once and
// rolls back if the server refuses it.
export function useWatchlist(service: DiscoveryService, token: string | null) {
  const [items, setItems] = useState<DiscoveryProfile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (!token) return () => undefined;
    let current = true;
    service
      .watchlist(token)
      .then(list => {
        if (!current) return;
        setItems(list);
        setError('');
        setLoaded(true);
      })
      .catch(failure => {
        if (!current) return;
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
        setLoaded(true);
      });
    return () => {
      current = false;
    };
  }, [service, token]);
  useFocusEffect(load);
  const watched = useCallback(
    (id: string) => items.some(item => item.id === id),
    [items],
  );
  const toggle = useCallback(
    async (profile: DiscoveryProfile) => {
      if (!token) return;
      const on = !items.some(item => item.id === profile.id);
      const before = items;
      setItems(
        on ? [profile, ...items] : items.filter(item => item.id !== profile.id),
      );
      setError('');
      try {
        await service.watch(token, profile.id, on);
      } catch (failure) {
        setItems(before);
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
      }
    },
    [items, service, token],
  );
  return { items, loaded, error, watched, toggle, reload: load };
}
