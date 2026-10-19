import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Bell,
  Ellipsis,
  House,
  Trophy,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { copy } from '../shared/lib/copy';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { colors, radius, shadow, space } from '../styles/tokens';
import { hubArt, isHubRoute, type HubRoute } from './HubArt';

type TabIcon = LucideIcon;
const userIcons: Record<string, TabIcon> = {
  Home: House,
  Leagues: Trophy,
  Notifications: Bell,
  More: Ellipsis,
};
const native = Platform.OS !== 'web';
const HUB_SIZE = 66;
const OPTION_SIZE = 60;
const OPTION_WIDTH = 84;
const FAN_RADIUS = 125;

function TabItem({
  label,
  icon: Icon,
  active,
  badge,
  onPress,
  onLongPress,
}: {
  label: string;
  icon: TabIcon;
  active: boolean;
  badge?: number | null;
  onPress(): void;
  onLongPress(): void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  function press() {
    if (!reducedMotion)
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 75,
          useNativeDriver: native,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: native,
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
      style={styles.item}
    >
      <Animated.View
        style={[
          styles.capsule,
          active && styles.activeCapsule,
          { transform: [{ scale }] },
        ]}
      >
        <View>
          <Icon
            size={22}
            color={active ? colors.brand : colors.secondary}
            strokeWidth={active ? 2.4 : 1.8}
          />
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={[styles.label, active && styles.activeLabel]}
        >
          {label}
        </Text>
        {active ? <View style={styles.activeDot} /> : null}
      </Animated.View>
    </Pressable>
  );
}

// Each page's artwork lands in the hub with its own short move.
type Motion = {
  x: Animated.Value;
  y: Animated.Value;
  turn: Animated.Value;
  scale: Animated.Value;
  flash: Animated.Value;
};

function landing(route: HubRoute, m: Motion) {
  const to = (
    value: Animated.Value,
    toValue: number,
    duration: number,
    easing: (t: number) => number = Easing.inOut(Easing.quad),
  ) =>
    Animated.timing(value, {
      toValue,
      duration,
      easing,
      useNativeDriver: native,
    });
  const settle = (value: Animated.Value, toValue: number) =>
    Animated.spring(value, {
      toValue,
      speed: 14,
      bounciness: 11,
      useNativeDriver: native,
    });
  switch (route) {
    // Sosyal: the ball hops up, lands and rebounds once.
    case 'Social':
      return Animated.parallel([
        settle(m.scale, 1),
        Animated.sequence([
          to(m.y, -20, 170, Easing.out(Easing.quad)),
          to(m.y, 0, 170, Easing.in(Easing.quad)),
          to(m.y, -7, 110, Easing.out(Easing.quad)),
          to(m.y, 0, 110, Easing.in(Easing.quad)),
        ]),
      ]);
    // Profil: the boot draws back and kicks.
    case 'Profile':
      return Animated.parallel([
        settle(m.scale, 1),
        Animated.sequence([
          to(m.turn, -26, 190, Easing.out(Easing.quad)),
          to(m.turn, 16, 110, Easing.in(Easing.quad)),
          settle(m.turn, 0),
        ]),
        Animated.sequence([to(m.x, -3, 190), to(m.x, 4, 110), settle(m.x, 0)]),
      ]);
    // Takımlar: the stadium swells as its floodlights come on.
    case 'Teams':
      return Animated.parallel([
        Animated.sequence([
          to(m.scale, 1.14, 220, Easing.out(Easing.quad)),
          settle(m.scale, 1),
        ]),
        Animated.sequence([
          to(m.flash, 1, 160),
          to(m.flash, 0, 700, Easing.out(Easing.quad)),
        ]),
      ]);
    // Oyunlar: the pad rumbles like a vibrating controller.
    case 'Games':
      return Animated.parallel([
        settle(m.scale, 1),
        Animated.sequence(
          [3, -3, 3, -3, 2.5, -2.5, 1.5, -1.5, 0].map(v => to(m.x, v, 40)),
        ),
        Animated.sequence([5, -5, 5, -5, 3, -3, 0].map(v => to(m.turn, v, 50))),
      ]);
  }
}

// The raised centre button. Idle it is a lime disc with a plus that pulses a
// couple of times to invite a tap; while one of its pages is open it shows that
// page's artwork; with the menu open the plus turns into a close cross.
function HubButton({
  active,
  label,
  expanded,
  progress,
  onPress,
  onLayout,
}: {
  active: HubRoute | null;
  label: string;
  expanded: boolean;
  progress: Animated.Value;
  onPress(): void;
  onLayout(event: LayoutChangeEvent): void;
}) {
  const reducedMotion = useReducedMotion();
  const motion = useRef<Motion>({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    turn: new Animated.Value(0),
    scale: new Animated.Value(1),
    flash: new Animated.Value(0),
  }).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reducedMotion) return;
    const { x, y, turn, scale, flash } = motion;
    for (const value of [x, y, turn, flash]) value.setValue(0);
    scale.setValue(0.55);
    // Waits for the chosen option to fly back into the hub.
    const animation = Animated.sequence([
      Animated.delay(140),
      landing(active, motion),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, motion, reducedMotion]);
  useEffect(() => {
    if (active || reducedMotion) return;
    pulse.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: native,
        }),
        { iterations: 2 },
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, pulse, reducedMotion]);
  const Art = active ? hubArt[active] : null;
  // Over an artwork the plus only shows while the menu opens.
  const plusOpacity = Art
    ? progress.interpolate({
        inputRange: [0.4, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : 1;
  const fade = (from: number, to: number) =>
    progress.interpolate({
      inputRange: [0, 0.6],
      outputRange: [from, to],
      extrapolate: 'clamp',
    });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        expanded ? copy.hub.close : label + ', ' + copy.hub.open
      }
      accessibilityState={{ expanded, selected: !!active }}
      onPress={onPress}
      onLayout={onLayout}
      style={styles.hubItem}
    >
      <View style={styles.hubStack}>
        {!active && !expanded ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.hubPulse,
              {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 0],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.45],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
        <View style={[styles.hubCircle, active && styles.hubCircleActive]}>
          {Art ? (
            <>
              <Animated.View
                style={[styles.hubFill, { opacity: fade(0, 1) }]}
              />
              <Animated.View
                style={[
                  styles.hubFlash,
                  {
                    opacity: motion.flash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.5],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.hubLayer,
                  {
                    opacity: fade(1, 0),
                    transform: [
                      { translateX: motion.x },
                      { translateY: motion.y },
                      {
                        rotate: motion.turn.interpolate({
                          inputRange: [-180, 180],
                          outputRange: ['-180deg', '180deg'],
                        }),
                      },
                      { scale: motion.scale },
                    ],
                  },
                ]}
              >
                <Art size={48} />
              </Animated.View>
            </>
          ) : null}
          <Animated.View
            style={[
              styles.hubLayer,
              {
                opacity: plusOpacity,
                transform: [
                  {
                    rotate: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '45deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Plus size={30} color={colors.brandInk} strokeWidth={3} />
          </Animated.View>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.label, styles.hubLabel, active && styles.activeLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Options fan out on an arc above the hub, left to right in hub order.
function fanAngles(count: number) {
  if (count === 1) return [90];
  if (count === 2) return [125, 55];
  return Array.from({ length: count }, (_, i) => 150 - (120 * i) / (count - 1));
}

function HubFan({
  anchor,
  routes,
  labels,
  active,
  progress,
  onSelect,
}: {
  anchor: { x: number; y: number };
  routes: HubRoute[];
  labels: Record<string, string>;
  active: HubRoute | null;
  progress: Animated.Value;
  onSelect(route: HubRoute): void;
}) {
  const angles = fanAngles(routes.length);
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {routes.map((route, i) => {
        const angle = (angles[i] * Math.PI) / 180;
        const dx = FAN_RADIUS * Math.cos(angle);
        const dy = -FAN_RADIUS * Math.sin(angle);
        // Later options start a little later, so the arc unfolds left to right.
        const start = i * 0.08;
        const along = (from: number, to: number) =>
          progress.interpolate({
            inputRange: [start, 1],
            outputRange: [from, to],
            extrapolateLeft: 'clamp',
          });
        const Art = hubArt[route];
        const selected = route === active;
        return (
          <Animated.View
            key={route}
            style={[
              styles.option,
              {
                left: anchor.x - OPTION_WIDTH / 2,
                top: anchor.y - OPTION_SIZE / 2,
                opacity: progress.interpolate({
                  inputRange: [start, start + 0.3],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  { translateX: along(0, dx) },
                  { translateY: along(0, dy) },
                  { scale: along(0.3, 1) },
                ],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels[route] ?? route}
              accessibilityState={{ selected }}
              onPress={() => onSelect(route)}
              style={({ pressed }) => [
                styles.optionPress,
                pressed && styles.optionPressed,
              ]}
            >
              <View
                style={[styles.optionCircle, selected && styles.optionSelected]}
              >
                <Art size={route === 'Social' ? 40 : 42} />
              </View>
              <Text numberOfLines={1} style={styles.optionLabel}>
                {labels[route] ?? route}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

// The admin shell reuses the same bar with its own tab names and icons; it has
// no hub pages, so it gets no centre button.
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
  const reducedMotion = useReducedMotion();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Stays true while the close animation runs, so the layer can fade out.
  const [layerShown, setLayerShown] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const bar = useRef({ x: 0, y: 0 });
  const hub = useRef({ x: 0, y: 0, width: 0 });
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const updateAnchor = useCallback(() => {
    if (!hub.current.width) return;
    setAnchor({
      x: bar.current.x + hub.current.x + hub.current.width / 2,
      y: bar.current.y + hub.current.y + HUB_SIZE / 2,
    });
  }, []);
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
  const openMenu = useCallback(() => {
    setLayerShown(true);
    setMenuOpen(true);
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: native,
    }).start();
  }, [progress, reducedMotion]);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(0);
      setLayerShown(false);
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: native,
    }).start(({ finished }) => {
      if (finished) setLayerShown(false);
    });
  }, [progress, reducedMotion]);
  // Android Back closes the menu before it leaves the page.
  useEffect(() => {
    if (!menuOpen) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closeMenu();
        return true;
      },
    );
    return () => subscription.remove();
  }, [menuOpen, closeMenu]);
  if (keyboardVisible) {
    return null;
  }
  const focused = state.routes[state.index]?.name ?? '';
  const activeHub = isHubRoute(focused) ? focused : null;
  const hubRoutes = state.routes.map(route => route.name).filter(isHubRoute);
  const plain = state.routes.filter(route => !isHubRoute(route.name));
  // The hub takes the place of the first hub page in the navigator's order.
  const hubAt = state.routes.findIndex(route => isHubRoute(route.name));
  const hubSlot = state.routes
    .slice(0, Math.max(hubAt, 0))
    .filter(route => !isHubRoute(route.name)).length;
  const go = (name: string, key: string, active: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: key,
      canPreventDefault: true,
    });
    if (!active && !event.defaultPrevented) navigation.navigate(name);
  };
  const items = plain.map(route => (
    <TabItem
      key={route.key}
      label={labels[route.name] ?? route.name}
      icon={icons[route.name] ?? Ellipsis}
      active={focused === route.name}
      badge={badges[route.name]}
      onPress={() => {
        if (menuOpen) closeMenu();
        go(route.name, route.key, focused === route.name);
      }}
      onLongPress={() =>
        navigation.emit({ type: 'tabLongPress', target: route.key })
      }
    />
  ));
  if (hubRoutes.length) {
    items.splice(
      hubSlot,
      0,
      <HubButton
        key="hub"
        active={activeHub}
        label={activeHub ? labels[activeHub] ?? activeHub : copy.tabs.Hub}
        expanded={menuOpen}
        progress={progress}
        onPress={menuOpen ? closeMenu : openMenu}
        onLayout={event => {
          const { x, y, width } = event.nativeEvent.layout;
          hub.current = { x, y, width };
          updateAnchor();
        }}
      />,
    );
  }
  return (
    <View
      style={[
        styles.host,
        layerShown && styles.hostOpen,
        { paddingBottom: Math.max(insets.bottom, space.md) },
      ]}
    >
      {layerShown ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.scrim,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.hub.close}
            onPress={closeMenu}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View
        style={styles.bar}
        onLayout={event => {
          const { x, y } = event.nativeEvent.layout;
          bar.current = { x, y };
          updateAnchor();
        }}
      >
        <View style={styles.barSurface} />
        {items}
      </View>
      {layerShown && anchor ? (
        <HubFan
          anchor={anchor}
          routes={hubRoutes}
          labels={labels}
          active={activeHub}
          progress={progress}
          onSelect={route => {
            const target = state.routes.find(item => item.name === route);
            closeMenu();
            if (target) go(route, target.key, focused === route);
          }}
        />
      ) : null}
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
  // With the menu open the host covers the screen so the scrim and the
  // options receive touches; the bar stays at the bottom.
  hostOpen: { top: 0, justifyContent: 'flex-end' },
  scrim: { backgroundColor: colors.scrim },
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
  hubItem: {
    flex: 1,
    minWidth: HUB_SIZE,
    minHeight: 84,
    marginTop: -28,
    alignItems: 'center',
  },
  hubStack: { width: HUB_SIZE, height: HUB_SIZE },
  hubPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: HUB_SIZE,
    height: HUB_SIZE,
    borderRadius: HUB_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  hubCircle: {
    width: HUB_SIZE,
    height: HUB_SIZE,
    borderRadius: HUB_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.glow,
  },
  hubCircleActive: { backgroundColor: colors.raised },
  hubFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: HUB_SIZE / 2,
    backgroundColor: colors.brand,
  },
  hubFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: HUB_SIZE / 2,
    backgroundColor: colors.floodlight,
  },
  hubLayer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubLabel: { position: 'absolute', bottom: 4, fontWeight: '700' },
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
  option: { position: 'absolute', width: OPTION_WIDTH, alignItems: 'center' },
  optionPress: { alignItems: 'center', gap: space.xs },
  optionPressed: { opacity: 0.8 },
  optionCircle: {
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    borderRadius: OPTION_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.raised,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.layer,
  },
  optionSelected: { backgroundColor: colors.overlay, ...shadow.glow },
  optionLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
