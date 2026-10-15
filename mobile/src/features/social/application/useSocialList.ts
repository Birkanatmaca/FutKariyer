import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { SocialPage } from '../domain/models';

export function useSocialList<T extends { id: string }>(
  load: (cursor: string) => Promise<SocialPage<T>>,
  enabled = true,
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const paging = useRef(false);

  const fetchPage = useCallback(
    async (after = '') => {
      const current = ++sequence.current;
      paging.current = true;
      setError('');
      if (after) setLoadingMore(true);
      else setRefreshing(true);
      try {
        const result = await load(after);
        if (sequence.current !== current) return;
        setItems(previous =>
          after
            ? Array.from(
                new Map(
                  [...previous, ...result.items].map(item => [item.id, item]),
                ).values(),
              )
            : result.items,
        );
        setCursor(result.nextCursor);
      } catch (failure) {
        if (sequence.current === current)
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      } finally {
        if (sequence.current === current) {
          paging.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setItems([]);
      setCursor('');
      fetchPage();
      return () => {
        sequence.current++;
        paging.current = false;
      };
    }, [fetchPage, enabled]),
  );

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: !!cursor,
    refresh: () => fetchPage(),
    loadMore: () => {
      if (cursor && !paging.current) fetchPage(cursor);
    },
    update: (transform: (item: T) => T) =>
      setItems(previous => previous.map(transform)),
    replace: (item: T) =>
      setItems(previous =>
        previous.map(value => (value.id === item.id ? item : value)),
      ),
    prepend: (item: T) =>
      setItems(previous => [
        item,
        ...previous.filter(value => value.id !== item.id),
      ]),
    remove: (id: string) =>
      setItems(previous => previous.filter(item => item.id !== id)),
  };
}
