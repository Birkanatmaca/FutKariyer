import { useEffect, useRef } from 'react';
import type { PushMessaging, PushRepository } from '../domain/push';

// Registers this device for the signed-in session and opens the notification
// centre when the app is opened from a push. Failures leave push off silently;
// the in-app centre still has every notification.
export function usePushRegistration(
  messaging: PushMessaging,
  repository: PushRepository,
  token: string | null,
  onOpenNotifications: () => void,
) {
  const open = useRef(onOpenNotifications);
  open.current = onOpenNotifications;
  useEffect(() => {
    const platform = messaging.platform;
    if (!token || !platform) return;
    let active = true;
    const register = (device: string | null) => {
      if (active && device)
        repository.register(token, { token: device, platform }).catch(() => {});
    };
    messaging.requestToken().then(register, () => {});
    messaging.openedFromPush().then(
      opened => active && opened && open.current(),
      () => {},
    );
    const stopRefresh = messaging.onTokenRefresh(register);
    const stopOpened = messaging.onOpened(() => open.current());
    return () => {
      active = false;
      stopRefresh();
      stopOpened();
    };
  }, [messaging, repository, token]);
}
