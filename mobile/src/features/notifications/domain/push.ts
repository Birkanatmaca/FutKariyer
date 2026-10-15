// Push notifications through Firebase Cloud Messaging. The device token is
// registered with the signed-in session; the server forwards each new in-app
// notification to it. Opening a push leads to the notification centre.
export type PushPlatform = 'ios' | 'android';

export interface PushMessaging {
  // null where push is unavailable (browser preview, Firebase not configured).
  readonly platform: PushPlatform | null;
  // Asks for permission when needed; null if refused or unavailable.
  requestToken(): Promise<string | null>;
  onTokenRefresh(listener: (token: string) => void): () => void;
  // Called when the person opens the app from a push.
  onOpened(listener: () => void): () => void;
  openedFromPush(): Promise<boolean>;
}

export interface PushRepository {
  register(
    token: string,
    device: { token: string; platform: PushPlatform },
  ): Promise<void>;
}
