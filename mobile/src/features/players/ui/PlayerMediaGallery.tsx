import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  Pressable,
  type ImageSourcePropType,
} from 'react-native';
import { Grid3X3, Film, Camera, ImageOff } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';

// A view projection, independent of the eventual media storage/API model.
export type GalleryThumbnail = {
  id: string;
  source: ImageSourcePropType;
  label: string;
};
type Tab = 'photos' | 'videos';
const emptyMedia: readonly GalleryThumbnail[] = [];

export function PlayerMediaGallery({
  photos = emptyMedia,
  videos = emptyMedia,
}: {
  photos?: readonly GalleryThumbnail[];
  videos?: readonly GalleryThumbnail[];
}) {
  const [selected, setSelected] = useState<Tab>('photos');
  const items = selected === 'photos' ? photos : videos;
  const EmptyIcon = selected === 'photos' ? Camera : Film;
  return (
    <View style={styles.gallery}>
      <View style={styles.tabs}>
        {(['photos', 'videos'] as const).map(tab => {
          const Icon = tab === 'photos' ? Grid3X3 : Film;
          const active = selected === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(tab)}
              style={[styles.tab, active && styles.activeTab]}
            >
              <Icon size={20} color={active ? colors.text : colors.muted} />
              <Text style={[styles.tabLabel, active && styles.activeLabel]}>
                {copy.playerOverview[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {items.length ? (
        <View style={styles.grid}>
          {items.map(item => (
            <Thumbnail
              key={item.id}
              item={item}
              video={selected === 'videos'}
            />
          ))}
        </View>
      ) : (
        <View accessibilityLiveRegion="polite" style={styles.empty}>
          <View style={styles.emptyIcon}>
            <EmptyIcon size={29} color={colors.secondary} />
          </View>
          <Text style={styles.emptyTitle}>
            {selected === 'photos'
              ? copy.playerOverview.noPhotos
              : copy.playerOverview.noVideos}
          </Text>
          <Text style={styles.emptyBody}>
            {selected === 'photos'
              ? copy.playerOverview.photosHint
              : copy.playerOverview.videosHint}
          </Text>
        </View>
      )}
    </View>
  );
}
function Thumbnail({
  item,
  video,
}: {
  item: GalleryThumbnail;
  video: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={styles.tile}
      accessibilityRole="image"
      accessibilityLabel={item.label}
    >
      <View style={styles.thumbnail}>
        {failed ? (
          <ImageOff color={colors.muted} size={24} />
        ) : (
          <Image
            source={item.source}
            onError={() => setFailed(true)}
            resizeMode="cover"
            style={styles.image}
          />
        )}
        {video && (
          <View style={styles.videoBadge}>
            <Film color={colors.text} size={16} />
          </View>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  gallery: { marginHorizontal: -space.xl },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.transparent,
  },
  activeTab: { borderBottomColor: colors.brand },
  tabLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  activeLabel: { color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 2 },
  tile: { width: '33.333333%', aspectRatio: 1, padding: 1 },
  thumbnail: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    backgroundColor: colors.surface,
    padding: space.xs,
  },
  empty: {
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxxl,
    alignItems: 'center',
    gap: space.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
  },
});
