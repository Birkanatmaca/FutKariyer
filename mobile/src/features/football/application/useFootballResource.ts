import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';

export type FootballError = { message: string };
export function toFootballError(failure: unknown): FootballError {
  return {
    message: failure instanceof Error ? failure.message : copy.form.unexpected,
  };
}

// initial: clears the screen and shows the loader; refresh: pull-to-refresh
// spinner; poll: silent background refresh that keeps data on failure.
type Mode = 'initial' | 'refresh' | 'poll';
type Options = {
  // Leaves the previous result on screen while a changed query loads.
  keepData?: boolean;
  // A disabled resource does not load (e.g. the data of a hidden tab).
  enabled?: boolean;
};
// Loads on focus like useFocusedResource, but can also refresh in place
// (pull-to-refresh or polling) without clearing what is on screen.
export function useFootballResource<T>(
  load: () => Promise<T>,
  { keepData = false, enabled = true }: Options = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<FootballError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);
  const hasData = useRef(false);
  const run = useCallback(
    (mode: Mode) => {
      const ticket = ++latest.current;
      if (mode === 'initial') {
        setLoading(true);
        if (!keepData) {
          setData(null);
          hasData.current = false;
        }
        setError(null);
        setRefreshing(false);
      }
      if (mode === 'refresh') setRefreshing(true);
      load()
        .then(value => {
          if (ticket !== latest.current) return;
          hasData.current = true;
          setData(value);
          setError(null);
        })
        .catch(failure => {
          if (ticket !== latest.current) return;
          if (mode === 'poll' && hasData.current) return;
          setError(toFootballError(failure));
          setData(null);
          hasData.current = false;
        })
        .finally(() => {
          if (ticket !== latest.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [load, keepData],
  );
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      run('initial');
      return () => {
        latest.current += 1;
      };
    }, [run, enabled]),
  );
  return {
    data,
    error,
    loading,
    refreshing,
    retry: useCallback(() => run('initial'), [run]),
    refresh: useCallback(() => run('refresh'), [run]),
    poll: useCallback(() => run('poll'), [run]),
  };
}

// Calls back every `ms` while the screen is focused and `enabled` is true;
// the timer is cleared on blur, unmount or when `enabled` turns false.
export function useFocusedInterval(
  callback: () => void,
  ms: number,
  enabled: boolean,
) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      const id = setInterval(() => saved.current(), ms);
      return () => clearInterval(id);
    }, [enabled, ms]),
  );
}
