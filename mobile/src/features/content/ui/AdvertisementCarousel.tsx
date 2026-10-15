import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { Advertisement } from '../domain/models';
import { ContentImage } from './ContentImage';
export function AdvertisementCarousel({
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
    reduced = useReducedMotion();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (
      !focused ||
      !active ||
      reduced ||
      dragging ||
      items.length < 2 ||
      width <= 0
    )
      return;
    const timer = setInterval(() => {
      const next = (selected + 1) % items.length;
      scroll.current?.scrollTo({ x: next * width, animated: true });
      setSelected(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [focused, active, reduced, dragging, items.length, width, selected]);
  useEffect(() => {
    scroll.current?.scrollTo({ x: 0, animated: false });
    setSelected(0);
  }, [width]);
  function move(delta: number) {
    const next = (selected + delta + items.length) % items.length;
    scroll.current?.scrollTo({ x: next * width, animated: !reduced });
    setSelected(next);
  }
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.home.ads}
        </Text>
        <Text style={styles.sponsor}>{copy.home.sponsored}</Text>
      </View>
      {items.length ? (
        <>
          <View
            style={styles.window}
            onLayout={event => setWidth(event.nativeEvent.layout.width)}
          >
            <ScrollView
              ref={scroll}
              horizontal
              pagingEnabled
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
                <View key={item.id} style={{ width }}>
                  <ContentImage
                    uri={imageUrl(item.imageId)}
                    label={item.title}
                    contain
                  />
                  <Text numberOfLines={1} style={styles.caption}>
                    {item.title}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
          {items.length > 1 && (
            <View style={styles.controls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.home.previousAd}
                style={styles.control}
                onPress={() => move(-1)}
              >
                <ChevronLeft size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.counter}>
                {copy.home.adPage(selected + 1, items.length)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.home.nextAd}
                style={styles.control}
                onPress={() => move(1)}
              >
                <ChevronRight size={18} color={colors.text} />
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.counter}>{copy.home.noAds}</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: space.md },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  sponsor: { color: colors.muted, fontSize: 9, letterSpacing: 1 },
  window: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  caption: {
    color: colors.secondary,
    fontSize: 11,
    padding: space.md,
    backgroundColor: colors.surface,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.md,
  },
  control: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  counter: { color: colors.muted, fontSize: 12 },
  empty: {
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
