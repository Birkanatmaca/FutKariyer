import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import type {
  HeadToHeadPick,
  HeadToHeadResult,
  HeadToHeadRound,
} from '../domain/head-to-head';
import type { HeadToHeadService } from './head-to-head-service';

// play: waiting for a pick · reveal: correct pick, values on screen ·
// over: wrong pick, final values on screen.
export type HeadToHeadPhase = 'loading' | 'play' | 'reveal' | 'over' | 'failed';

const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : copy.form.unexpected;

// The server picks pairs and keeps the values. This hook sends one pick at a
// time and keeps the reply on screen until the next round is shown.
export function useHeadToHead(service: HeadToHeadService, token: string) {
  const [runId, setRunId] = useState('');
  const [round, setRound] = useState<HeadToHeadRound | null>(null);
  const [result, setResult] = useState<HeadToHeadResult | null>(null);
  const [picked, setPicked] = useState<HeadToHeadPick | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef(false);

  const start = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setStarting(true);
    try {
      const run = await service.start(token);
      setRunId(run.id);
      setRound(run.round);
      setStreak(run.streak);
      setBest(run.best);
      setResult(null);
      setPicked(null);
      setError('');
    } catch (failure) {
      setError(message(failure));
    } finally {
      pending.current = false;
      setBusy(false);
      setStarting(false);
    }
  }, [service, token]);

  useEffect(() => {
    start();
  }, [start]);

  const answer = useCallback(
    async (pick: HeadToHeadPick) => {
      if (pending.current || !round || result) return;
      // After a lost reply only the same pick may be resent; the server
      // returns the saved result for it.
      if (picked && picked !== pick) return;
      pending.current = true;
      setBusy(true);
      setPicked(pick);
      try {
        const reply = await service.answer(token, runId, round.id, pick);
        setResult(reply);
        setStreak(reply.streak);
        setBest(reply.best);
        setError('');
      } catch (failure) {
        setError(message(failure));
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [picked, result, round, runId, service, token],
  );

  const next = useCallback(() => {
    if (!result?.nextRound) return;
    setRound(result.nextRound);
    setResult(null);
    setPicked(null);
  }, [result]);

  const phase: HeadToHeadPhase =
    starting && !round
      ? 'loading'
      : !round
      ? 'failed'
      : result?.gameOver
      ? 'over'
      : result
      ? 'reveal'
      : 'play';

  return {
    phase,
    round,
    result,
    picked,
    streak,
    best,
    busy,
    error,
    start,
    answer,
    next,
  };
}
