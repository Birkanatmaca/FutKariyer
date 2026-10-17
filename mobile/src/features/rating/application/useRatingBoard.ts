import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { RatingBoard, RatingRepository, TaskKind } from '../domain/models';
import { countdownTarget } from '../domain/models';

// Loads the board on focus and keeps a server-anchored countdown ticking.
export function useRatingBoard(repository: RatingRepository, token: string) {
  const [board, setBoard] = useState<RatingBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState<TaskKind | null>(null);
  const [clock, setClock] = useState(Date.now());
  const anchor = useRef({ server: 0, local: 0 });
  const accept = useCallback((value: RatingBoard) => {
    anchor.current = {
      server: Date.parse(value.serverTime),
      local: Date.now(),
    };
    setBoard(value);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      accept(await repository.board(token));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setLoading(false);
    }
  }, [repository, token, accept]);
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => setClock(Date.now()), 1000);
      return () => clearInterval(timer);
    }, [load]),
  );
  const remaining = board?.season
    ? Math.max(
        0,
        Math.floor(
          (Date.parse(countdownTarget(board.season)) -
            anchor.current.server -
            (clock - anchor.current.local)) /
            1000,
        ),
      )
    : 0;
  // When a countdown reaches zero the season changed state; reload once.
  const reloaded = useRef('');
  useEffect(() => {
    const key = board?.season ? board.season.id + board.season.status : '';
    if (board?.season && remaining === 0 && reloaded.current !== key) {
      reloaded.current = key;
      load();
    }
  }, [board, remaining, load]);
  const claim = useCallback(
    async (kind: TaskKind) => {
      if (claiming) return;
      setClaiming(kind);
      setError('');
      try {
        accept(await repository.claim(token, kind));
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
      } finally {
        setClaiming(null);
      }
    },
    [claiming, repository, token, accept],
  );
  return { board, loading, error, remaining, claim, claiming, reload: load };
}
