import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { SocialPost } from '../domain/models';
import type { SocialService } from './social-service';

export function useSocialPost(
  service: SocialService,
  token: string,
  id: string,
) {
  const [data, setData] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(-1);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      setLoading(true);
      setError('');
      service
        .post(token, id)
        .then(value => {
          if (current) setData(value);
        })
        .catch(failure => {
          if (current)
            setError(
              failure instanceof Error ? failure.message : copy.form.unexpected,
            );
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
    }, [service, token, id, revision]),
  );
  return {
    data,
    loading: loading || loaded !== revision,
    error,
    update: setData,
    retry: () => setRevision(value => value + 1),
  };
}
