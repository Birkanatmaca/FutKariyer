import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { Article } from '../domain/models';
import { NewsArt } from './NewsArt';

// How long one story stays before the bar under it fills and the next slides in.
const DURATION = 6000;

// Home news as an auto-advancing story strip: one card at a time, and a row of
// segments underneath where the current one fills left to right. Swiping,
// leaving the tab or backgrounding the app pauses it; reduced motion stops it.
export function HomeNews({
  items,
  imageUrl,
  onNews,
}: {
  items: Article[];
  imageUrl(id: string): string;
  onNews(): void;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.news.all}
        style={styles.heading}
        onPress={onNews}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {copy.news.title}
        </Text>
        <View style={styles.link}>
          <Text style={styles.linkText}>{copy.news.all}</Text>
          <ChevronRight size={16} color={colors.brand} />
        </View>
      </Pressable>
      {items.length ? (
        <NewsCarousel items={items} imageUrl={imageUrl} onNews={onNews} />
      ) : (
        <Text style={styles.empty}>{copy.news.noHome}</Text>
      )}
    </View>
  );
}

function NewsCarousel({
  items,
  imageUrl,
  onNews,
}: {
  items: Article[];
  imageUrl(id: string): string;
  onNews(): void;
}) {
  const scroll = useRef<ScrollView>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const rotating = items.length > 1;
  const playing =
    rotating && focused && active && !reduced && !dragging && width > 0;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  // The strip ends with a copy of the first story, so moving past the last one
  // keeps sliding forward; once it lands on the copy it jumps back to the real
  // first slide without animation.
  const jump = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(jump.current), []);
  const rewind = useCallback(() => {
    clearTimeout(jump.current);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, []);
  const go = useCallback(
    (index: number) => {
      const next = (index + items.length) % items.length;
      progress.setValue(0);
      setSelected(next);
      if (index >= items.length) {
        scroll.current?.scrollTo({ x: items.length * width, animated: true });
        clearTimeout(jump.current);
        jump.current = setTimeout(rewind, 600);
      } else {
        scroll.current?.scrollTo({ x: next * width, animated: true });
      }
    },
    [items.length, progress, width, rewind],
  );

  // A new width or list starts over from the first story. It runs
  // before the fill effect, since setValue would stop a running fill.
  useEffect(() => {
    progress.setValue(0);
    setSelected(0);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [width, items.length, progress]);

  // Fill the current segment; resume from where it stopped after a pause.
  useEffect(() => {
    if (!playing) {
      progress.stopAnimation();
      return;
    }
    let left = DURATION;
    progress.stopAnimation(value => {
      left = DURATION * (1 - value);
    });
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: left,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) {
        go(selected + 1);
      }
    });
    return () => animation.stop();
  }, [playing, selected, progress, go]);

  const strip = rotating ? [...items, items[0]] : items;
  const fill = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  return (
    <View
      style={styles.carousel}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessible={rotating}
      accessibilityRole={rotating ? 'adjustable' : undefined}
      accessibilityLabel={rotating ? items[selected]?.title : undefined}
      accessibilityValue={
        rotating
          ? { text: copy.news.page(selected + 1, items.length) }
          : undefined
      }
      accessibilityActions={
        rotating ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
      }
      onAccessibilityAction={event =>
        go(selected + (event.nativeEvent.actionName === 'increment' ? 1 : -1))
      }
    >
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        scrollEnabled={rotating}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={event => {
          setDragging(false);
          if (!width) return;
          const raw = Math.round(event.nativeEvent.contentOffset.x / width);
          if (raw >= items.length) rewind();
          const index = raw % items.length;
          if (index !== selected) {
            progress.setValue(0);
            setSelected(index);
          }
        }}
      >
        {strip.map((article, position) => (
          <NewsSlide
            key={article.id + (position === items.length ? '-loop' : '')}
            hidden={position === items.length}
            article={article}
            uri={article.imageId ? imageUrl(article.imageId) : ''}
            width={width}
            onPress={onNews}
            bar={
              rotating ? (
                <View style={styles.bar}>
                  <Animated.View
                    style={[
                      styles.fill,
                      article.id === items[selected]?.id
                        ? reduced
                          ? styles.full
                          : { width: fill }
                        : styles.none,
                    ]}
                  />
                </View>
              ) : null
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function NewsSlide({
  article,
  uri,
  width,
  onPress,
  bar,
  hidden,
}: {
  article: Article;
  uri: string;
  width: number;
  onPress(): void;
  bar: React.ReactNode;
  // The looping copy of the first story is skipped by screen readers.
  hidden: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const photo = !!uri && !failed;
  return (
    <View
      style={[styles.page, { width }]}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={article.title}
        onPress={onPress}
        style={({ pressed }) => [styles.slide, pressed && styles.pressed]}
      >
        {photo ? (
          <Image
            source={{ uri }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            onError={() => setFailed(true)}
          />
        ) : (
          <NewsArt id={article.id} width={width} />
        )}
        {bar}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  linkText: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  carousel: { gap: space.md },
  page: { gap: space.md },
  slide: {
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  // Sits on the card's bottom edge; the card clips it to its rounded corners.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: colors.overlay,
  },
  full: { width: '100%' },
  none: { width: '0%' },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
  },
});
