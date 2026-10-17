import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import {
  playsLeft,
  type GameState,
  type PenaltyKick,
  type PenaltyMatch,
  type Side,
} from '../domain/models';
import type { GamesService } from './games-service';

export type PenaltyPhase = 'choose' | 'reveal' | 'over';

// The server owns every kick and outcome; this hook only sends choices and
// keeps the last server reply on screen until the user moves on.
export function usePenaltyShootout(service: GamesService, token: string) {
  const [data, setData] = useState<GameState | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setData(await service.state(token));
      setError('');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setLoading(false);
    }
  }, [service, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const match: PenaltyMatch | null = data?.penalty ?? null;
  const phase: PenaltyPhase = revealing
    ? 'reveal'
    : match?.status === 'finished'
    ? 'over'
    : 'choose';
  const lastKick: PenaltyKick | undefined =
    match?.kicks[match.kicks.length - 1];
  const canStart =
    !busy &&
    (match?.status === 'active' ||
      (!!data && playsLeft(data.plays.penalty) > 0));

  // Runs one server call at a time; a failed call resyncs from the server.
  const run = useCallback(
    async (call: () => Promise<GameState>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      try {
        setData(await call());
        setError('');
        return true;
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
        await refresh();
        return false;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );

  const start = useCallback(async () => {
    setRevealing(false);
    await run(() => service.penaltyStart(token));
  }, [run, service, token]);

  const kick = useCallback(
    async (side: Side) => {
      if (!match || match.status !== 'active' || revealing) return;
      const index = match.kicks.length;
      const ok = await run(() =>
        service.penaltyKick(token, match.id, index, side),
      );
      if (ok) setRevealing(true);
    },
    [match, revealing, run, service, token],
  );

  const next = useCallback(() => setRevealing(false), []);

  return {
    loading,
    busy,
    error,
    phase,
    match,
    lastKick,
    plays: data?.plays.penalty ?? null,
    nextResetAt: data?.nextResetAt ?? null,
    ratingActive: data?.ratingActive ?? false,
    serverTime: data?.serverTime ?? null,
    canStart,
    start,
    kick,
    next,
    refresh,
  };
}
