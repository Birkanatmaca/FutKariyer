import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { ConnectionAction, ConnectionInbox } from '../domain/models';
import { actionNotices, type ConnectionsService } from './connections-service';

const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : copy.form.unexpected;

export function useConnections(service: ConnectionsService, token: string) {
  const [inbox, setInbox] = useState<ConnectionInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const pending = useRef(false),
    sequence = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const value = await service.list(token);
      if (current !== sequence.current) return;
      setInbox(value);
      setLoadError('');
    } catch (failure) {
      if (current === sequence.current) setLoadError(message(failure));
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [service, token]);

  useFocusEffect(
    useCallback(() => {
      pending.current = false;
      setBusyId('');
      refresh();
      return () => {
        sequence.current++;
        pending.current = false;
      };
    }, [refresh]),
  );

  async function respond(id: string, action: ConnectionAction) {
    if (pending.current) return;
    pending.current = true;
    setBusyId(id);
    setActionError('');
    setNotice('');
    try {
      await service.respond(token, id, action);
      setNotice(actionNotices[action]);
    } catch (failure) {
      setActionError(message(failure));
    } finally {
      pending.current = false;
      setBusyId('');
    }
    // Success moves the item between lists; a 409 means the list is stale.
    await refresh();
  }

  return {
    inbox,
    loading,
    error: actionError || loadError,
    loadFailed: !!loadError && !inbox,
    notice,
    busyId,
    respond,
    retry: () => {
      setLoading(true);
      refresh();
    },
  };
}
