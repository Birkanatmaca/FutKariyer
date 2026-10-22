import { useCallback, useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import type {
  AccountPage,
  AccountQuery,
  AccountStats,
  AdminSection,
} from '../domain/models';
import type { AdminService } from './admin-service';
export function useAccountPage(
  service: AdminService,
  section: AdminSection,
  query: AccountQuery,
) {
  const [data, setData] = useState<AccountPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const { page, search, role, status } = query;
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .list(section, { page, search, role, status })
      .then(value => {
        if (current) {
          setData(value);
        }
      })
      .catch(failure => {
        if (current) {
          setData(null);
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
        }
      })
      .finally(() => {
        if (current) {
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [service, section, page, search, role, status, revision]);
  return { data, loading, error, reload, revision };
}

// The counts above the table; they follow the table's reloads.
export function useAccountStats(
  service: AdminService,
  section: AdminSection,
  revision: number,
) {
  const [stats, setStats] = useState<AccountStats | null>(null);
  useEffect(() => {
    let current = true;
    service
      .stats(section)
      .then(value => {
        if (current) setStats(value);
      })
      .catch(() => {
        if (current) setStats(null);
      });
    return () => {
      current = false;
    };
  }, [service, section, revision]);
  return stats;
}
