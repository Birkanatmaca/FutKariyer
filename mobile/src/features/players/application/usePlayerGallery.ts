import { useCallback, useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import type { MediaKind } from '../../../shared/domain/media';
import type { GalleryLimits, PlayerMediaItem } from '../domain/media';
import type { PlayerMediaService } from './media-service';

const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : copy.form.unexpected;

// Loads a player's gallery and, for the owner, adds and removes items.
export function usePlayerGallery(
  service: PlayerMediaService,
  token: string,
  ownerId: string,
) {
  const [items, setItems] = useState<PlayerMediaItem[]>([]);
  const [limits, setLimits] = useState<GalleryLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState<MediaKind | string | ''>('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    service
      .list(token, ownerId)
      .then(gallery => {
        if (!current) return;
        setItems(gallery.items);
        setLimits(gallery.limits);
      })
      .catch(failure => {
        if (current) setError(message(failure));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, token, ownerId, revision]);
  const add = useCallback(
    async (kind: MediaKind) => {
      if (busy) return;
      setBusy(kind);
      setActionError('');
      try {
        const item = await service.add(token, kind);
        if (item) setItems(list => [item, ...list]);
      } catch (failure) {
        setActionError(message(failure));
      } finally {
        setBusy('');
      }
    },
    [busy, service, token],
  );
  const remove = useCallback(
    async (id: string) => {
      if (busy) return false;
      setBusy(id);
      setActionError('');
      try {
        await service.remove(token, id);
        setItems(list => list.filter(item => item.id !== id));
        return true;
      } catch (failure) {
        setActionError(message(failure));
        return false;
      } finally {
        setBusy('');
      }
    },
    [busy, service, token],
  );
  return {
    items,
    limits,
    loading,
    error,
    actionError,
    busy,
    add,
    remove,
    retry: () => setRevision(value => value + 1),
  };
}
