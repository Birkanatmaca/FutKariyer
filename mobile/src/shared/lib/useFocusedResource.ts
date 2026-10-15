import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from './copy';
export function useFocusedResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [loaded, setLoaded] = useState(-1);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      setLoading(true);
      setData(null);
      setError(null);
      load()
        .then(value => {
          if (current) setData(value);
        })
        .catch(failure => {
          if (current)
            setError(
              failure instanceof Error ? failure.message : copy.form.unexpected,
            );
        })
        .finally(() => {
          if (current) {
            setLoading(false);
            setLoaded(revision);
          }
        });
      return () => {
        current = false;
      };
    }, [load, revision]),
  );
  return {
    data,
    error,
    loading: loading || loaded !== revision,
    retry: () => setRevision(v => v + 1),
  };
}
