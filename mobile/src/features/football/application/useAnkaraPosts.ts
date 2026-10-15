import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnkaraPost } from '../domain/models';
import type { FootballService } from './football-service';
import {
  toFootballError,
  useFootballResource,
  type FootballError,
} from './useFootballResource';

// The server serves 50 pages of 20 posts at most.
const lastPage = 50;
type Extra = { items: AnkaraPost[]; page: number; hasMore: boolean };

// The first page loads like any football resource (focus, pull-to-refresh);
// further pages are appended on demand and reset whenever page 1 reloads.
export function useAnkaraPosts(
  service: FootballService,
  token: string,
  enabled = true,
) {
  const load = useCallback(
    () => service.ankaraPosts(token, 1),
    [service, token],
  );
  const first = useFootballResource(load, { keepData: true, enabled });
  const [extra, setExtra] = useState<Extra | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<FootballError | null>(null);
  const ticket = useRef(0);
  useEffect(() => {
    ticket.current += 1;
    setExtra(null);
    setLoadingMore(false);
    setMoreError(null);
  }, [first.data]);
  const items = useMemo(() => {
    const seen = new Set<number>();
    return [...(first.data?.items ?? []), ...(extra?.items ?? [])].filter(
      item => !seen.has(item.id) && !!seen.add(item.id),
    );
  }, [first.data, extra]);
  const page = extra?.page ?? first.data?.page ?? 1;
  const hasMore =
    (extra?.hasMore ?? first.data?.hasMore ?? false) && page < lastPage;
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    const current = ++ticket.current;
    setLoadingMore(true);
    setMoreError(null);
    service
      .ankaraPosts(token, page + 1)
      .then(next => {
        if (current !== ticket.current) return;
        setExtra(previous => ({
          items: [...(previous?.items ?? []), ...next.items],
          page: next.page,
          hasMore: next.hasMore,
        }));
      })
      .catch(failure => {
        if (current === ticket.current) setMoreError(toFootballError(failure));
      })
      .finally(() => {
        if (current === ticket.current) setLoadingMore(false);
      });
  }, [hasMore, loadingMore, service, token, page]);
  return { ...first, items, hasMore, loadingMore, moreError, loadMore };
}
