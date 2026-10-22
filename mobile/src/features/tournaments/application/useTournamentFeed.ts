import { useCallback, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import type {
  Tournament,
  TournamentFeedView,
  TournamentPage,
} from '../domain/models';
import type { TournamentsService } from './tournaments-service';

type More = { base: TournamentPage; pages: TournamentPage[] };

// Loads the first page on focus; further pages are appended. Extra pages
// belong to the first page they were loaded after, so a refetch drops them.
export function useTournamentFeed(
  service: TournamentsService,
  token: string,
  view: TournamentFeedView = 'open',
) {
  const load = useCallback(
    (page: number) =>
      view === 'halisaha'
        ? service.halisaha(token, page)
        : service.open(token, page),
    [service, token, view],
  );
  const first = useFocusedResource(useCallback(() => load(1), [load]));
  const [more, setMore] = useState<More | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<{
    base: TournamentPage;
    message: string;
  } | null>(null);
  const base = first.data;
  const pages = base
    ? [base, ...(more && more.base === base ? more.pages : [])]
    : [];
  const last = pages[pages.length - 1];
  const seen = new Set<string>();
  // Tournaments can shift between pages while paging; keep the first copy.
  const items: Tournament[] = pages
    .flatMap(page => page.items)
    .filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  const hasMore = !!last && last.page < last.totalPages;

  async function loadMore() {
    if (!base || !last || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await load(last.page + 1);
      setMore(current => ({
        base,
        pages: [
          ...(current && current.base === base ? current.pages : []),
          next,
        ],
      }));
    } catch (failure) {
      setMoreError({
        base,
        message:
          failure instanceof Error ? failure.message : copy.form.unexpected,
      });
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    items,
    total: base?.total ?? 0,
    loading: first.loading,
    error: first.error,
    retry: first.retry,
    hasMore,
    loadingMore,
    moreError: moreError && moreError.base === base ? moreError.message : '',
    loadMore,
  };
}
