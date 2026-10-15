import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { StoreCheckout } from './store-checkout';

// Re-sends unfinished store purchases when a signed-in session starts and
// whenever the app returns to the foreground.
export function useStoreRecovery(
  checkout: StoreCheckout,
  token: string | null,
) {
  useEffect(() => {
    if (!token) return;
    checkout.recover(token).catch(() => {});
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkout.recover(token).catch(() => {});
    });
    return () => subscription.remove();
  }, [checkout, token]);
}
