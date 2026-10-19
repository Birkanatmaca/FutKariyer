import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { AccountProfile, AccountRepository } from '../domain/models';

// The signed-in account's profile, reloaded on focus so a new photo shows up
// on every screen that uses it.
export function useAccountProfile(
  repository: AccountRepository,
  token: string | null,
) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setProfile(await repository.get(token));
      setError('');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setLoading(false);
    }
  }, [repository, token]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return { profile, setProfile, error, loading, reload: load };
}
