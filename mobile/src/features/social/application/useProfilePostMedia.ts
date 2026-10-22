import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { MediaKind } from '../domain/models';
import type { SocialService } from './social-service';

export type ProfilePostMedia = {
  id: string;
  kind: MediaKind;
  createdAt: string;
};

// The author's latest posts whose photo or video was shared on the profile;
// refreshed whenever the profile gains focus. Failures leave the list empty.
export function useProfilePostMedia(
  service: SocialService,
  token: string | null,
  userId: string,
  // 'all' takes every post with media (clubs and coaches cannot pick
  // profile media); 'media' keeps the player's chosen profile media.
  filter: 'media' | 'all' = 'media',
) {
  const [items, setItems] = useState<ProfilePostMedia[]>([]);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      if (token)
        service
          .userPosts(token, userId, '', filter)
          .then(page => {
            if (current)
              setItems(
                page.items.flatMap(post =>
                  post.media
                    ? [
                        {
                          id: post.id,
                          kind: post.media.kind,
                          createdAt: post.createdAt,
                        },
                      ]
                    : [],
                ),
              );
          })
          .catch(() => current && setItems([]));
      return () => {
        current = false;
      };
    }, [service, token, userId, filter]),
  );
  return items;
}
