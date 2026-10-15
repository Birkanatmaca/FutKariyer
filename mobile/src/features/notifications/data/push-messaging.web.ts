import type { PushMessaging } from '../domain/push';

// The browser preview does not receive push notifications.
export const pushMessaging: PushMessaging = {
  platform: null,
  requestToken: async () => null,
  onTokenRefresh: () => () => {},
  onOpened: () => () => {},
  openedFromPush: async () => false,
};
