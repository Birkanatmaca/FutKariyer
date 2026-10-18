import React from 'react';
import {
  PostMediaThumb,
  ProfilePosts,
  useProfilePostMedia,
  type SocialService,
} from '../features/social';
import type { ProfilePostsSlot } from '../features/players';

// Composes the social posts of a player into the profile's Gönderiler tab and
// its Fotoğraflar/Videolar grids; the players feature stays unaware of social.
export function useProfilePostsSlot({
  service,
  token,
  userId,
  onOpen,
  onCompose,
}: {
  service: SocialService;
  token: string | null;
  userId: string;
  onOpen(id: string): void;
  onCompose?(): void;
}): ProfilePostsSlot | undefined {
  const media = useProfilePostMedia(service, token, userId);
  if (!token) return undefined;
  return {
    postsTab: (
      <ProfilePosts
        token={token}
        userId={userId}
        service={service}
        onOpen={onOpen}
        onCompose={onCompose}
      />
    ),
    media,
    renderMedia: item => (
      <PostMediaThumb
        id={item.id}
        kind={item.kind}
        token={token}
        service={service}
      />
    ),
    onOpenMedia: onOpen,
  };
}
