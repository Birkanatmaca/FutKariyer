import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import type { Page } from '../domain/models';

export function errorMessage(failure: unknown) {
  return failure instanceof Error ? failure.message : copy.form.unexpected;
}

// One request whose result can be refreshed (pull to refresh) or retried.
// A new `load` function (for example a new filter) starts over.
export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const run = useCallback(
    async (mode: 'load' | 'refresh') => {
      const id = ++request.current;
      if (mode === 'load') {
        setLoading(true);
        setData(null);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const value = await load();
        if (id === request.current) setData(value);
      } catch (failure) {
        if (id === request.current) setError(errorMessage(failure));
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [load],
  );
  useEffect(() => {
    run('load');
    // Invalidate answers that arrive after unmount or a new load.
    const counter = request;
    return () => {
      counter.current++;
    };
  }, [run]);
  return {
    data,
    error,
    loading,
    refreshing,
    setData,
    retry: () => run('load'),
    refresh: () => run('refresh'),
  };
}

// Server-paged list that grows with "load more". A new `load` function (new
// search or filter) starts again from the first page.
export function usePagedList<P extends Page<unknown>>(
  load: (page: number) => Promise<P>,
) {
  type T = P['items'][number];
  const [items, setItems] = useState<T[]>([]);
  const [last, setLast] = useState<P | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);
  const first = useCallback(
    async (mode: 'load' | 'refresh') => {
      const id = ++request.current;
      if (mode === 'load') {
        setLoading(true);
        setItems([]);
        setLast(null);
      } else {
        setRefreshing(true);
      }
      setError(null);
      setMoreError(null);
      setLoadingMore(false);
      try {
        const page = await load(1);
        if (id !== request.current) return;
        setItems(page.items as T[]);
        setLast(page);
      } catch (failure) {
        if (id === request.current) setError(errorMessage(failure));
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [load],
  );
  useEffect(() => {
    first('load');
    // Invalidate answers that arrive after unmount or a new load.
    const counter = request;
    return () => {
      counter.current++;
    };
  }, [first]);
  const hasMore = !!last && last.page < last.totalPages;
  async function loadMore() {
    if (!last || !hasMore || loadingMore || loading || refreshing) return;
    const id = request.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await load(last.page + 1);
      if (id !== request.current) return;
      setItems(current => {
        const seen = new Set(current.map(item => key(item)));
        return [
          ...current,
          ...(page.items as T[]).filter(item => !seen.has(key(item))),
        ];
      });
      setLast(page);
    } catch (failure) {
      if (id === request.current) setMoreError(errorMessage(failure));
    } finally {
      if (id === request.current) setLoadingMore(false);
    }
  }
  return {
    items,
    last,
    total: last?.total ?? null,
    error,
    moreError,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    loadMore,
    retry: () => first('load'),
    refresh: () => first('refresh'),
  };
}
// Rows shift between pages when records are added; ids keep them unique.
function key(item: unknown) {
  const record = item as { id?: string; userId?: string };
  return record.id ?? record.userId ?? item;
}
