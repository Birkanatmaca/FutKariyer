import { useCallback, useEffect, useState } from 'react';
import type { OnboardingStorage } from '../domain/models';

export function useOnboarding(storage: OnboardingStorage) {
  const [state, setState] = useState<{ ready: boolean; seen: boolean }>({
    ready: false,
    seen: false,
  });
  useEffect(() => {
    let mounted = true;
    storage
      .seen()
      .catch(() => false)
      .then(seen => {
        if (mounted) setState({ ready: true, seen });
      });
    return () => {
      mounted = false;
    };
  }, [storage]);
  const complete = useCallback(() => {
    setState({ ready: true, seen: true });
    storage.markSeen().catch(() => {});
  }, [storage]);
  return { ...state, complete };
}
