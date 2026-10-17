import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';

// Heart with a springy pop and an expanding ring when a post becomes liked;
// the count nudges up with it. Reduced motion keeps only the colour change.
export function LikeButton({
  liked,
  count,
  disabled,
  onPress,
}: {
  liked: boolean;
  count: number;
  disabled?: boolean;
  onPress?(): void;
}) {
  const pop = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const previous = useRef(liked);
  useEffect(() => {
    if (liked && !previous.current && !reduced) {
      pop.setValue(0.6);
      ring.setValue(0);
      Animated.parallel([
        Animated.spring(pop, {
          toValue: 1,
          friction: 3,
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
    previous.current = liked;
  }, [liked, pop, ring, reduced]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.social.likeLabel(count, liked)}
      accessibilityState={{ selected: liked, disabled: !!disabled }}
      aria-pressed={liked}
      aria-disabled={!!disabled}
      disabled={disabled}
      onPress={onPress}
      style={styles.action}
    >
      <Animated.View style={styles.heart}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: ring.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, 0.7, 0],
              }),
              transform: [
                {
                  scale: ring.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1.9],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Heart
            size={20}
            color={liked ? colors.danger : colors.muted}
            fill={liked ? colors.danger : colors.transparent}
          />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.count, liked && styles.liked]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: 44,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  heart: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  count: { color: colors.muted, fontSize: 12 },
  liked: { color: colors.danger },
});
