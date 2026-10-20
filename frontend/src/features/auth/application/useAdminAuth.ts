import { useCallback, useEffect, useState } from 'react';
import { ApiError, sessionExpiredEvent } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  AdminUser,
  LoginInput,
  TwoFactorChallenge,
} from '../domain/models';
import type { AuthService } from './auth-service';

export function useAdminAuth(service: AuthService) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Second sign-in step, and the recovery codes shown once after setup.
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
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
    const outcome = await service.login(input);
    setError(null);
    if (outcome.kind === 'twoFactor') {
      setChallenge(outcome.challenge);
      return;
    }
    setUser(outcome.user);
  }
  async function verify(code: string) {
    if (!challenge) return;
    try {
      const result = await service.verify(challenge.challenge, code);
      setChallenge(null);
      setRecoveryCodes(result.recoveryCodes);
      setUser(result.user);
    } catch (failure) {
      // An expired or used-up step starts over from the password.
      if (failure instanceof ApiError && failure.status === 401) {
        setChallenge(null);
      }
      throw failure;
    }
  }
  const cancelChallenge = useCallback(() => setChallenge(null), []);
  const acknowledgeRecoveryCodes = useCallback(() => setRecoveryCodes([]), []);
  async function logout() {
    await service.logout();
    setUser(null);
    setError(null);
  }
  return {
    user,
    loading,
    error,
    retry,
    login,
    logout,
    challenge,
    verify,
    cancelChallenge,
    recoveryCodes,
    acknowledgeRecoveryCodes,
  };
}
