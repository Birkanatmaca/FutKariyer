import { useCallback, useEffect, useState } from 'react';
import { ApiError, sessionExpiredEvent } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { AdminUser, LoginInput } from '../domain/models';
import type { AuthService } from './auth-service';

export function useAdminAuth(service: AuthService) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .me()
      .then(account => {
        if (current) {
          setUser(account);
        }
      })
      .catch(failure => {
        if (
          current &&
          !(failure instanceof ApiError && failure.status === 401)
        ) {
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
  }, [service, revision]);
  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener(sessionExpiredEvent, expire);
    return () => window.removeEventListener(sessionExpiredEvent, expire);
  }, []);
  async function login(input: LoginInput) {
    setUser(await service.login(input));
    setError(null);
  }
  async function logout() {
    await service.logout();
    setUser(null);
    setError(null);
  }
  return { user, loading, error, retry, login, logout };
}
