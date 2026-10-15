import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { ClubOverview } from '../domain/models';
import type { AdminService } from './admin-service';

export function useClubOverview(service: AdminService, id: string) {
  const [data, setData] = useState<ClubOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    service
      .clubOverview(id)
      .then(value => {
        if (current) {
          setData(value);
        }
      })
      .catch(failure => {
        if (!current) {
          return;
        }
        setData(null);
        if (failure instanceof ApiError && failure.status === 404) {
          setNotFound(true);
          return;
        }
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
      })
      .finally(() => {
        if (current) {
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [service, id, revision]);
  return { data, loading, error, notFound, reload };
}
