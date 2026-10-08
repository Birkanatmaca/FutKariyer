import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Compass, House, MessagesSquare, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { copy } from '../shared/lib/copy';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { colors, radius, space } from '../styles/tokens';
const icons = {
  Home: House,
  Discover: Compass,
  Connections: MessagesSquare,
  Profile: UserRound,
};
type TabName = keyof typeof icons;
function TabItem({
  name,
  active,
  onPress,
  onLongPress,
}: {
  name: TabName;
  active: boolean;
  onPress(): void;
  onLongPress(): void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const Icon = icons[name];
  const reducedMotion = useReducedMotion();
  function press() {
    if (reducedMotion) {
      onPress();
      return;
    }
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 75,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 4,
      }),
    ]).start();
    onPress();
  }
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={copy.tabs[name]}
      accessibilityState={{ selected: active }}
      onPress={press}
      onLongPress={onLongPress}
      style={styles.item}
      hitSlop={4}
    >
      <Animated.View
        style={[
          styles.capsule,
          active && styles.activeCapsule,
          { transform: [{ scale }] },
        ]}
      >
        <Icon
          size={22}
          color={active ? colors.brand : colors.secondary}
          strokeWidth={active ? 2.4 : 1.8}
        />
        <Text
          numberOfLines={1}
          style={[styles.label, active && styles.activeLabel]}
        >
          {copy.tabs[name]}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
export function FutTabBar({ state, navigation }: BottomTabBarProps) {
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
        {state.routes.map((route, index) => {
          const name = route.name as TabName;
          const active = state.index === index;
          return (
            <TabItem
              key={route.key}
              name={name}
              active={active}
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
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  bar: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.sm,
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 8,
    shadowColor: colors.bg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  item: { flex: 1, minHeight: 56, justifyContent: 'center' },
  capsule: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.md,
    paddingHorizontal: space.xs,
  },
  activeCapsule: { backgroundColor: colors.brandWash },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
    flexShrink: 1,
  },
  activeLabel: { color: colors.brand, fontWeight: '700' },
});
