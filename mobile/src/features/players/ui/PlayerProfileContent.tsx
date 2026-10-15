import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { PlayerProfile } from '../domain/profile';
import { PlayerProfileHeader } from './PlayerProfileHeader';
import { PlayerMediaGallery, type GalleryProps } from './PlayerMediaGallery';

export function PlayerProfileContent({
  fullName,
  profile,
  avatarSource,
  gallery,
  onEdit,
  isPro = false,
}: {
  fullName: string;
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
        isPro={isPro}
      />
      <PlayerMediaGallery {...gallery} />
    </>
  );
}
