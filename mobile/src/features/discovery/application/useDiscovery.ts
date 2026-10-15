import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { DiscoveryPage, DiscoveryQuery } from '../domain/models';
import type { DiscoveryService } from './discovery-service';
type Result = {
  revision: number;
  query: DiscoveryQuery;
  page: DiscoveryPage | null;
  error: string | null;
  forbidden: boolean;
  loading: boolean;
};
export function useDiscovery(
  service: DiscoveryService,
  token: string | null,
  query: DiscoveryQuery,
) {
  const [result, setResult] = useState<Result | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      setResult({
        revision,
        query,
        page: null,
        error: null,
        forbidden: false,
        loading: true,
      });
      const pending = token
        ? service.list(token, query)
        : Promise.reject(new Error(copy.playerProfile.sessionError));
      pending
        .then(page => {
          if (current) {
            setResult({
              revision,
              query,
              page,
              error: null,
              forbidden: false,
              loading: false,
            });
          }
        })
        .catch(failure => {
          if (current) {
            setResult({
              revision,
              query,
              page: null,
              error:
                failure instanceof Error
                  ? failure.message
                  : copy.form.unexpected,
              forbidden: failure instanceof ApiError && failure.status === 403,
              loading: false,
            });
          }
        });
      return () => {
        current = false;
      };
    }, [service, token, query, revision]),
  );
  // Keep a previous query's response out of the new query's render, including before effects run.
  return {
    page:
      result?.query === query && result.revision === revision
        ? result.page
        : null,
    error:
      result?.query === query && result.revision === revision
        ? result.error
        : null,
    forbidden:
      result?.query === query &&
      result.revision === revision &&
      result.forbidden,
    loading:
      result?.query !== query || result.revision !== revision || result.loading,
    refresh: () => setRevision(value => value + 1),
  };
}
