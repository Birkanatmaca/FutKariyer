import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import type { MediaSource } from '../domain/models';
import type { SocialService } from './social-service';

export function usePostMedia(
  service: SocialService,
  token: string,
  id: string,
  enabled: boolean,
) {
  const [source, setSource] = useState<MediaSource | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    let loaded: MediaSource | undefined;
    setSource(null);
    setError('');
    if (enabled) {
      service
        .mediaSource(token, id)
        .then(value => {
          if (!current) {
            value.dispose?.();
            return;
          }
          loaded = value;
          setSource(value);
        })
        .catch(failure => {
          if (current)
            setError(
              failure instanceof Error
                ? failure.message
                : copy.social.mediaFailed,
            );
        });
    }
    return () => {
      current = false;
      loaded?.dispose?.();
    };
  }, [service, token, id, enabled, retry]);
  return {
    source,
    error,
    fail: () => setError(copy.social.mediaFailed),
    retry: () => setRetry(value => value + 1),
  };
}
