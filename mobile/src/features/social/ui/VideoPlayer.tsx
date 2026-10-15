import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Video from 'react-native-video';
import { useIsFocused } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import type { MediaSource } from '../domain/models';

export function VideoPlayer({
  source,
  onError,
  autoPlay = false,
}: {
  source: MediaSource;
  onError(): void;
  autoPlay?: boolean;
}) {
  const focused = useIsFocused();
  const [paused, setPaused] = useState(!autoPlay);
  useEffect(() => {
    if (!focused) setPaused(true);
  }, [focused]);
  return (
    <Video
      source={{ uri: source.uri, headers: source.headers }}
      controls
      paused={paused || !focused}
      onPlaybackStateChanged={({ isPlaying }) => {
        if (focused) setPaused(!isPlaying);
      }}
      resizeMode="contain"
      playInBackground={false}
      playWhenInactive={false}
      onError={onError}
      accessibilityLabel={copy.social.videoPreview}
      style={styles.video}
    />
  );
}
const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9 },
});
