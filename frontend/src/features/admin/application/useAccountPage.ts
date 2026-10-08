import { useCallback, useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import type { AccountPage, AdminSection } from '../domain/models';
import type { AdminService } from './admin-service';
export function useAccountPage(
  service: AdminService,
  section: AdminSection,
  page: number,
  search: string,
) {
  const [data, setData] = useState<AccountPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .list(section, page, search)
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
  }, [service, section, page, search, revision]);
  return { data, loading, error, reload };
}
