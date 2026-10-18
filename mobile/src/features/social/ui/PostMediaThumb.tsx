import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { ImageOff, Play } from 'lucide-react-native';
import { colors, radius } from '../../../styles/tokens';
import type { MediaKind } from '../domain/models';
import type { SocialService } from '../application/social-service';
import { usePostMedia } from '../application/usePostMedia';

// Square thumbnail of a post's photo, or a play mark for a video, for the
// profile Fotoğraflar/Videolar grids. Videos are not prefetched.
export function PostMediaThumb({
  id,
  kind,
  token,
  service,
}: {
  id: string;
  kind: MediaKind;
  token: string;
  service: SocialService;
}) {
  const media = usePostMedia(service, token, id, kind === 'image');
  return (
    <View style={styles.thumbnail}>
      {kind === 'video' ? (
        <View style={styles.play}>
          <Play size={18} color={colors.brandInk} fill={colors.brandInk} />
        </View>
      ) : media.error ? (
        <ImageOff color={colors.muted} size={24} />
      ) : media.source ? (
        <Image
          source={media.source}
          onError={media.fail}
          resizeMode="cover"
          style={styles.image}
        />
      ) : (
        <ActivityIndicator color={colors.muted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  play: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
