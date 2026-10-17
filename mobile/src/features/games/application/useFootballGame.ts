import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import { ApiError } from '../../../shared/api/client';
import type { GameFeedback, GameQuestion, GameState } from '../domain/models';
import type { GamesService } from './games-service';

export function useFootballGame(service: GamesService, token: string) {
  const [data, setData] = useState<GameState | null>(null);
  const [mode, setMode] = useState<'lobby' | 'play' | 'result'>('lobby');
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [question, setQuestion] = useState<GameQuestion | null>(null);
  const [feedback, setFeedback] = useState<GameFeedback | null>(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false),
    sequence = useRef(0);
  const [clock, setClock] = useState(Date.now());
  const received = useRef({ local: Date.now(), server: Date.now() });
  const accept = useCallback((value: GameState) => {
    received.current = {
      local: Date.now(),
      server: Date.parse(value.serverTime),
    };
    setData(value);
    setClock(Date.now());
  }, []);
  const refresh = useCallback(
    async (recover = false) => {
      if (pending.current) return;
      const current = ++sequence.current;
      try {
        const value = await service.state(token);
        if (current !== sequence.current) return;
        accept(value);
        if (recover || modeRef.current === 'lobby') setError('');
        if (recover) {
          setSelected('');
          setFeedback(null);
          setQuestion(value.run?.question ?? null);
          setQuestionNumber((value.run?.answered ?? 0) + 1);
          setMode(
            value.run?.status === 'finished'
              ? 'result'
              : value.run
              ? 'play'
              : 'lobby',
          );
        }
      } catch (failure) {
        if (current === sequence.current)
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      } finally {
        if (current === sequence.current) setLoading(false);
      }
    },
    [service, token, accept],
  );
  useFocusEffect(
    useCallback(() => {
      pending.current = false;
      setBusy(false);
      refresh(modeRef.current !== 'lobby');
      const timer = setInterval(() => setClock(Date.now()), 1000);
      const subscription = AppState.addEventListener('change', value => {
        if (value === 'active') refresh();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
        sequence.current++;
        pending.current = false;
      };
    }, [refresh]),
  );
  // Seconds until today's plays reset (midnight, Istanbul).
  const remaining = data?.nextResetAt
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(data.nextResetAt) -
            received.current.server -
            (clock - received.current.local)) /
            1000,
        ),
      )
    : 0;
  const attemptedRefill = useRef({ at: '', local: 0 });
  useEffect(() => {
    if (
      data?.nextResetAt &&
      remaining === 0 &&
      !busy &&
      (attemptedRefill.current.at !== data.nextResetAt ||
        clock - attemptedRefill.current.local >= 30000)
    ) {
      attemptedRefill.current = { at: data.nextResetAt, local: clock };
      refresh();
    }
  }, [data?.nextResetAt, remaining, busy, clock, refresh]);
  async function start() {
    if (pending.current) return;
    pending.current = true;
    const current = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const value = await service.start(token);
      if (current !== sequence.current) return;
      accept(value);
      setQuestion(value.run?.question ?? null);
      setQuestionNumber((value.run?.answered ?? 0) + 1);
      setFeedback(null);
      setSelected('');
      setMode('play');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        try {
          const value = await service.state(token);
          if (current === sequence.current) accept(value);
        } catch {
          /* Retain the original start error for a manual retry. */
        }
      }
      if (current === sequence.current)
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
    } finally {
      if (current === sequence.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  async function answer(optionId: string) {
    if (
      pending.current ||
      feedback ||
      !question ||
      !data?.run ||
      (selected && selected !== optionId)
    )
      return;
    pending.current = true;
    const current = ++sequence.current;
    setBusy(true);
    setError('');
    setSelected(optionId);
    try {
      const value = await service.answer(
        token,
        data.run.id,
        question.id,
        optionId,
      );
      if (current !== sequence.current) return;
      accept(value);
      if (value.run?.feedback?.questionId === question.id)
        setFeedback(value.run.feedback);
      else {
        setQuestion(value.run?.question ?? null);
        setQuestionNumber((value.run?.answered ?? 0) + 1);
        setSelected('');
        if (value.run?.status === 'finished') setMode('result');
      }
    } catch (failure) {
      if (current === sequence.current)
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
    } finally {
      if (current === sequence.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  function next() {
    setFeedback(null);
    setSelected('');
    setError('');
    if (data?.run?.status === 'finished') setMode('result');
    else {
      setQuestion(data?.run?.question ?? null);
      setQuestionNumber((data?.run?.answered ?? 0) + 1);
    }
  }
  return {
    data,
    mode,
    question,
    questionNumber,
    feedback,
    selected,
    loading,
    busy,
    error,
    remaining,
    start,
    answer,
    next,
    refresh: () => refresh(),
    recover: () => refresh(true),
    lobby: () => {
      if (!pending.current) {
        setMode('lobby');
        setError('');
      }
    },
  };
}
