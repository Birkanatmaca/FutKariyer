import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { PlayerProfile } from '../domain/profile';
import type { PlayerProfileService } from './profile-service';

export function usePlayerProfile(
  service: PlayerProfileService,
  token: string | null,
) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(-1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      setLoading(true);
      setError(null);
      setProfile(null);
      const pending = token
        ? service.get(token)
        : Promise.reject(new Error(copy.playerProfile.sessionError));
      pending
        .then(value => {
          if (current) {
            setProfile(value);
          }
        })
        .catch(failure => {
          if (current) {
            setError(
              failure instanceof Error ? failure.message : copy.form.unexpected,
            );
          }
        })
        .finally(() => {
          if (current) {
            setLoading(false);
            setLoaded(revision);
          }
        });
      return () => {
        current = false;
      };
    }, [service, token, revision]),
  );
  return {
    profile,
    error,
    loading: loading || loaded !== revision,
    retry: () => setRevision(value => value + 1),
  };
}
