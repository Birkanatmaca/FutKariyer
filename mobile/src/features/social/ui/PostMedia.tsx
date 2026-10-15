import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Play } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { SocialMedia } from '../domain/models';
import type { SocialService } from '../application/social-service';
import { usePostMedia } from '../application/usePostMedia';
import { VideoPlayer } from './VideoPlayer';

export function PostMedia({
  media,
  id,
  token,
  service,
}: {
  media: SocialMedia;
  id: string;
  token: string;
  service: SocialService;
}) {
  const [playing, setPlaying] = useState(false);
  const resource = usePostMedia(
    service,
    token,
    id,
    media.kind === 'image' || playing,
  );
  return (
    <View style={styles.frame}>
      {resource.error ? (
        <Pressable
          accessibilityRole="button"
          onPress={resource.retry}
          style={styles.placeholder}
        >
          <Text style={styles.error}>{resource.error}</Text>
          <Text style={styles.retry}>{copy.form.retry}</Text>
        </Pressable>
      ) : media.kind === 'video' && !playing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.social.playVideo}
          onPress={() => setPlaying(true)}
          style={styles.placeholder}
        >
          <View style={styles.play}>
            <Play size={24} color={colors.brandInk} fill={colors.brandInk} />
          </View>
          <Text style={styles.caption}>{copy.social.playVideo}</Text>
        </Pressable>
      ) : resource.source ? (
        media.kind === 'image' ? (
          <Image
            source={resource.source}
            accessibilityLabel={copy.social.imagePreview}
            resizeMode="contain"
            onError={resource.fail}
            style={[
              styles.image,
              {
                aspectRatio: Math.max(
                  0.65,
                  Math.min(2, media.width / media.height),
                ),
              },
            ]}
          />
        ) : (
          <VideoPlayer
            source={resource.source}
            onError={resource.fail}
            autoPlay
          />
        )
      ) : (
        <View style={styles.placeholder}>
          <ActivityIndicator
            accessibilityLabel={copy.social.mediaLoading}
            color={colors.brand}
          />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  image: { width: '100%' },
  frame: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.lg,
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { color: colors.secondary, fontSize: 12 },
  error: { color: colors.secondary, fontSize: 12, textAlign: 'center' },
  retry: { color: colors.brand, fontSize: 13, fontWeight: '700' },
});
