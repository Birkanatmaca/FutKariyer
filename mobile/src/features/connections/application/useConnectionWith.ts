import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Connection,
  ConnectionAction,
  ConnectionState,
} from '../domain/models';
import { actionNotices, type ConnectionsService } from './connections-service';

type Snapshot = {
  state: ConnectionState;
  connectionId: string;
  connection: Connection | null;
};

const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : copy.form.unexpected;

function stateOf(connection: Connection): ConnectionState {
  if (connection.status === 'accepted') return 'connected';
  if (connection.status === 'pending') return connection.direction;
  return 'none';
}

// Relationship between the signed-in account and one profile.
export function useConnectionWith(
  service: ConnectionsService,
  token: string,
  userId: string,
) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false),
    sequence = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const status = await service.with(token, userId);
      let connection: Connection | null = null;
      if (status.state !== 'none') {
        // The inbox carries the message and, once accepted, the email.
        const inbox = await service.list(token);
        connection =
          [...inbox.incoming, ...inbox.outgoing, ...inbox.accepted].find(
            item => item.id === status.connectionId,
          ) ?? null;
      }
      if (current !== sequence.current) return;
      setSnapshot({
        state: status.state,
        connectionId: status.connectionId,
        connection,
      });
      setLoadError('');
    } catch (failure) {
      if (current === sequence.current) setLoadError(message(failure));
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [service, token, userId]);

  useFocusEffect(
    useCallback(() => {
      pending.current = false;
      setBusy(false);
      setNotice('');
      setActionError('');
      refresh();
      return () => {
        sequence.current++;
        pending.current = false;
      };
    }, [refresh]),
  );

  async function run(task: () => Promise<Connection>, success: string) {
    if (pending.current) return false;
    pending.current = true;
    sequence.current++;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const connection = await task();
      const state = stateOf(connection);
      setSnapshot({
        state,
        connectionId: state === 'none' ? '' : connection.id,
        connection: state === 'none' ? null : connection,
      });
      setNotice(success);
      return true;
    } catch (failure) {
      setActionError(message(failure));
      // already_open / invalid_action / not_found: show the current state.
      if (
        failure instanceof ApiError &&
        (failure.status === 409 || failure.status === 404)
      )
        refresh();
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return {
    state: snapshot?.state ?? null,
    connection: snapshot?.connection ?? null,
    loading,
    loadError,
    actionError,
    notice,
    busy,
    send: (text: string) =>
      run(() => service.send(token, userId, text), copy.connections.sentNotice),
    respond: (action: ConnectionAction) => {
      const id = snapshot?.connectionId;
      if (!id) return Promise.resolve(false);
      return run(
        () => service.respond(token, id, action),
        actionNotices[action],
      );
    },
    retry: () => {
      setLoading(true);
      refresh();
    },
  };
}
