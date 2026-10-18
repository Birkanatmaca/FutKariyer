import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { PlayerProfile } from '../domain/profile';
import { PlayerProfileHeader, type ProfileCounts } from './PlayerProfileHeader';
import {
  PlayerMediaGallery,
  type GalleryProps,
  type ProfilePostsSlot,
} from './PlayerMediaGallery';

export function PlayerProfileContent({
  fullName,
  profile,
  avatarSource,
  gallery,
  onEdit,
  counts,
  posts,
  isPro = false,
}: {
  // Gönderiler tab and shared post media, composed by the app shell.
  posts?: ProfilePostsSlot;
  fullName: string;
  counts?: ProfileCounts | null;
  isPro?: boolean;
  profile: PlayerProfile;
  avatarSource?: ImageSourcePropType;
  // Signed-in viewer's access to this player's gallery.
  gallery?: GalleryProps;
  onEdit?(): void;
}) {
  return (
    <>
      <PlayerProfileHeader
        fullName={fullName}
        profile={profile}
        avatarSource={avatarSource}
        onEdit={onEdit}
        counts={counts}
        isPro={isPro}
      />
      <PlayerMediaGallery {...gallery} posts={posts} />
    </>
  );
}
