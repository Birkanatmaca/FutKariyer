import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { advertisementAspectRatio, type Advertisement } from '../domain/models';

// One fixed-size rectangle that shows only the advertisement picture.
// Several ads rotate inside the same slot; nothing else comes from the server.
export function AdvertisementBanner({
  items,
  imageUrl,
}: {
  items: Advertisement[];
  imageUrl(id: string): string;
}) {
  const scroll = useRef<ScrollView>(null),
    [width, setWidth] = useState(0),
    [selected, setSelected] = useState(0),
    [dragging, setDragging] = useState(false),
    [active, setActive] = useState(AppState.currentState === 'active');
  const focused = useIsFocused(),
    reduced = useReducedMotion(),
    rotating = items.length > 1;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!focused || !active || reduced || dragging || !rotating || width <= 0)
      return;
    const timer = setInterval(() => {
      const next = (selected + 1) % items.length;
      scroll.current?.scrollTo({ x: next * width, animated: true });
      setSelected(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [
    focused,
    active,
    reduced,
    dragging,
    rotating,
    items.length,
    width,
    selected,
  ]);
  useEffect(() => {
    scroll.current?.scrollTo({ x: 0, animated: false });
    setSelected(0);
  }, [width]);
  function move(delta: number) {
    if (!rotating) return;
    const next = (selected + delta + items.length) % items.length;
    scroll.current?.scrollTo({ x: next * width, animated: !reduced });
    setSelected(next);
  }
  const height = width / advertisementAspectRatio;
  return (
    <View
      testID="advertisement-banner"
      style={styles.frame}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole={rotating ? 'adjustable' : 'image'}
      accessibilityLabel={copy.home.adImage}
      accessibilityValue={
        rotating
          ? { text: copy.home.adPage(selected + 1, items.length) }
          : undefined
      }
      accessibilityActions={
        rotating ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
      }
      onAccessibilityAction={event =>
        move(event.nativeEvent.actionName === 'increment' ? 1 : -1)
      }
    >
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        scrollEnabled={rotating}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onTouchStart={() => setDragging(true)}
        onTouchEnd={() => setDragging(false)}
        onMomentumScrollEnd={event => {
          if (width)
            setSelected(
              Math.max(
                0,
                Math.min(
                  items.length - 1,
                  Math.round(event.nativeEvent.contentOffset.x / width),
                ),
              ),
            );
        }}
      >
        {items.map(item => (
          <AdvertisementImage
            key={item.id}
            uri={item.imageId ? imageUrl(item.imageId) : ''}
            width={width}
            height={height}
          />
        ))}
      </ScrollView>
      <View style={styles.tag} pointerEvents="none">
        <Text style={styles.tagText}>{copy.home.adTag}</Text>
      </View>
      {rotating && (
        <View style={styles.dots} pointerEvents="none">
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[styles.dot, index === selected && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type ImageState = 'loading' | 'ready' | 'failed';
function AdvertisementImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const [state, setState] = useState<ImageState>(uri ? 'loading' : 'failed');
  useEffect(() => setState(uri ? 'loading' : 'failed'), [uri]);
  return (
    <View style={[styles.slide, { width, height }]}>
      {uri && state !== 'failed' ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          style={styles.image}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
        />
      ) : null}
      {state === 'loading' && (
        <View style={styles.placeholder} testID="advertisement-loading">
          <ActivityIndicator color={colors.muted} />
        </View>
      )}
      {state === 'failed' && (
        <View style={styles.placeholder} testID="advertisement-unavailable">
          <ImageOff size={26} color={colors.muted} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: advertisementAspectRatio,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  slide: { backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  tag: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  tagText: { ...type.eyebrow, fontSize: 9, color: colors.secondary },
  dots: {
    position: 'absolute',
    bottom: space.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dotActive: { width: 16, backgroundColor: colors.brand },
});
