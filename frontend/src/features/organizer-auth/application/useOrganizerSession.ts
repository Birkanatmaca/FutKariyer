import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import {
  organizerSessionExpiredEvent,
  organizerToken,
} from '../../../shared/api/organizer-session';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import {
  isOrganizer,
  type OrganizerAccount,
  type OrganizerAuthRepository,
  type OrganizerLoginInput,
} from '../domain/models';

const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : organizerCopy.form.unexpected;

export function useOrganizerSession(repository: OrganizerAuthRepository) {
  const [account, setAccount] = useState<OrganizerAccount | null>(null);
  const [loading, setLoading] = useState(() => !!organizerToken.get());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  // A stored token (after a reload) is checked once against /auth/me.
  useEffect(() => {
    if (!organizerToken.get()) {
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    setError(null);
    repository
      .me()
      .then(async user => {
        if (!current) return;
        if (isOrganizer(user)) {
          setAccount(user);
          return;
        }
        await repository.logout().catch(() => undefined);
        if (current) setNotice(organizerCopy.login.onlyOrganizers);
      })
      .catch(failure => {
        if (current && !(failure instanceof ApiError && failure.status === 401))
          setError(message(failure));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [repository, revision]);

  useEffect(() => {
    // Fired only when a request with a token answered 401.
    const expire = () => {
      setAccount(null);
      setNotice(organizerCopy.login.expired);
    };
    window.addEventListener(organizerSessionExpiredEvent, expire);
    return () =>
      window.removeEventListener(organizerSessionExpiredEvent, expire);
  }, []);

  const login = useCallback(
    async (input: OrganizerLoginInput) => {
      setNotice(null);
      setError(null);
      await repository.login(input);
      const user = await repository.me();
      if (!isOrganizer(user)) {
        await repository.logout().catch(() => undefined);
        throw new Error(organizerCopy.login.onlyOrganizers);
      }
      setAccount(user);
    },
    [repository],
  );

  const logout = useCallback(async () => {
    try {
      await repository.logout();
    } finally {
      setAccount(null);
      setNotice(null);
    }
  }, [repository]);

  return { account, loading, error, notice, retry, login, logout };
}
