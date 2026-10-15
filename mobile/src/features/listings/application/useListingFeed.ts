import { useCallback, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import type { Listing, ListingFilter, ListingPage } from '../domain/models';
import type { ListingsService } from './listings-service';

type More = { base: ListingPage; pages: ListingPage[] };

// Loads the first page on focus and filter change; further pages are appended.
// Extra pages belong to the first page they were loaded after, so a refetch or
// a filter change drops them.
export function useListingFeed(
  service: ListingsService,
  token: string,
  filter: ListingFilter,
) {
  const first = useFocusedResource(
    useCallback(() => service.open(token, 1, filter), [service, token, filter]),
  );
  const [more, setMore] = useState<More | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<{
    base: ListingPage;
    message: string;
  } | null>(null);
  const base = first.data;
  const pages = base
    ? [base, ...(more && more.base === base ? more.pages : [])]
    : [];
  const last = pages[pages.length - 1];
  const seen = new Set<string>();
  // Listings can shift between pages while paging; keep the first copy only.
  const items: Listing[] = pages
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
      const next = await service.open(token, last.page + 1, filter);
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
