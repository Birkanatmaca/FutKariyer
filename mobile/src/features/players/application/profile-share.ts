import type { RefObject } from 'react';
import type { View } from 'react-native';

// Where the profile card goes: Instagram's story editor, WhatsApp, or the
// system share sheet for every other app.
export type ShareTarget = 'instagramStory' | 'whatsapp' | 'more';
export type ShareOutcome = 'shared' | 'dismissed' | 'unavailable';

// Platform adapter: turns the rendered card into an image and hands it to the
// chosen app together with a short message.
export interface ProfileSharer {
  readonly targets: readonly ShareTarget[];
  share(
    card: RefObject<View | null>,
    target: ShareTarget,
    message: string,
    background: string,
  ): Promise<ShareOutcome>;
}
