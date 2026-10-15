import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { PlayerProfile } from '../domain/profile';
import { PlayerProfileHeader } from './PlayerProfileHeader';
import {
  PlayerMediaGallery,
  type GalleryThumbnail,
} from './PlayerMediaGallery';

export function PlayerProfileContent({
  fullName,
  profile,
  avatarSource,
  photos,
  videos,
  onEdit,
  isPro = false,
}: {
  fullName: string;
  isPro?: boolean;
  profile: PlayerProfile;
  avatarSource?: ImageSourcePropType;
  photos?: readonly GalleryThumbnail[];
  videos?: readonly GalleryThumbnail[];
  onEdit?(): void;
}) {
  return (
    <>
      <PlayerProfileHeader
        fullName={fullName}
        profile={profile}
        avatarSource={avatarSource}
        onEdit={onEdit}
        isPro={isPro}
      />
      <PlayerMediaGallery photos={photos} videos={videos} />
    </>
  );
}
