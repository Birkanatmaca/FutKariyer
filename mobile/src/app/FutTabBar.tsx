import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  Ellipsis,
  House,
  Shield,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { copy } from '../shared/lib/copy';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { colors, radius, shadow, space } from '../styles/tokens';
import { FootballTabIcon } from './FootballTabIcon';
// The Social tab always renders the raised football button instead.
type TabIcon = LucideIcon;
const userIcons: Record<string, TabIcon> = {
  Home: House,
  Leagues: Trophy,
  Teams: Shield,
  Profile: UserRound,
  Notifications: Bell,
  More: Ellipsis,
};
function TabItem({
  name,
  label,
  icon: Icon,
  active,
  badge,
  onPress,
  onLongPress,
}: {
  name: string;
  label: string;
  icon: TabIcon;
  active: boolean;
  badge?: number | null;
  onPress(): void;
  onLongPress(): void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const social = name === 'Social';
  const reducedMotion = useReducedMotion();
  function press() {
    if (reducedMotion) {
      onPress();
      return;
    }
    if (social) bounce(hop);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 75,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
        speed: 24,
        bounciness: 4,
      }),
    ]).start();
    onPress();
  }
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={
        badge ? label + ', ' + copy.more.unread(badge) : label
      }
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={press}
      onLongPress={onLongPress}
      style={[styles.item, social && styles.socialItem]}
    >
      <Animated.View
        style={[
          styles.capsule,
          social && styles.socialCapsule,
          active && !social && styles.activeCapsule,
          { transform: [{ scale }] },
        ]}
      >
        {social ? (
          <View
            style={[styles.socialCircle, active && styles.activeSocialCircle]}
          >
            <Animated.View style={{ transform: [{ translateY: hop }] }}>
              <FootballTabIcon />
            </Animated.View>
          </View>
        ) : (
          <View>
            <Icon
              size={22}
              color={active ? colors.brand : colors.secondary}
              strokeWidth={active ? 2.4 : 1.8}
            />
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            social && styles.socialLabel,
            active && styles.activeLabel,
          ]}
        >
          {label}
        </Text>
        {active && !social ? <View style={styles.activeDot} /> : null}
      </Animated.View>
    </Pressable>
  );
}
// The Social ball hops up, lands and rebounds once.
function bounce(hop: Animated.Value) {
  const native = Platform.OS !== 'web';
  const step = (
    toValue: number,
    duration: number,
    easing: (t: number) => number,
  ) =>
    Animated.timing(hop, {
      toValue,
      duration,
      easing,
      useNativeDriver: native,
    });
  hop.stopAnimation();
  hop.setValue(0);
  Animated.sequence([
    step(-22, 170, Easing.out(Easing.quad)),
    step(0, 170, Easing.in(Easing.quad)),
    step(-7, 110, Easing.out(Easing.quad)),
    step(0, 110, Easing.in(Easing.quad)),
  ]).start();
}

// The admin shell reuses the same bar with its own tab names and icons.
export function FutTabBar({
  state,
  navigation,
  icons = userIcons,
  labels = copy.tabs,
  badges = {},
}: BottomTabBarProps & {
  icons?: Record<string, TabIcon>;
  labels?: Record<string, string>;
  badges?: Record<string, number | null>;
}) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboardVisible) {
    return null;
  }
  return (
    <View
      style={[
        styles.host,
        { paddingBottom: Math.max(insets.bottom, space.md) },
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.barSurface} />
        {state.routes.map((route, index) => {
          const name = route.name;
          const active = state.index === index;
          return (
            <TabItem
              key={route.key}
              name={name}
              label={labels[name] ?? name}
              icon={icons[name] ?? Ellipsis}
              active={active}
              badge={badges[name]}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
            />
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
  },
  bar: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.xs,
    paddingTop: 30,
  },
  barSurface: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 26,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.layer,
  },
  item: { flex: 1, minWidth: 44, minHeight: 56, justifyContent: 'center' },
  socialItem: { marginTop: -28, minHeight: 84, minWidth: 66 },
  capsule: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.md,
  },
  activeCapsule: { backgroundColor: colors.brandWash, borderRadius: radius.lg },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  socialCapsule: { minHeight: 84 },
  socialCircle: {
    position: 'absolute',
    top: 0,
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.raised,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.glow,
  },
  activeSocialCircle: { backgroundColor: colors.brand },
  socialLabel: { position: 'absolute', bottom: 4, fontWeight: '700' },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.secondary,
    flexShrink: 1,
  },
  activeLabel: { color: colors.brand, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.text, fontSize: 9, fontWeight: '800' },
});
