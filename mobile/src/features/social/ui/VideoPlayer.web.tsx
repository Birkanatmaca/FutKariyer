import React, { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { copy } from '../../../shared/lib/copy';
import { colors } from '../../../styles/tokens';
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
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!focused) ref.current?.pause();
  }, [focused]);
  return (
    <video
      ref={ref}
      src={source.uri}
      controls
      playsInline
      autoPlay={autoPlay}
      preload="metadata"
      onError={onError}
      aria-label={copy.social.videoPreview}
      style={videoStyle}
    />
  );
}
const videoStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '16 / 9',
  background: colors.bg,
};
