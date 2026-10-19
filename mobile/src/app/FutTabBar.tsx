import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { copy } from '../shared/lib/copy';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { colors, radius, shadow, space } from '../styles/tokens';
import { HubBallArt, hubArt, isHubRoute, type HubRoute } from './HubArt';

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

// Each page's artwork lands in the hub with its own short move. Every move is
// one native timeline (a single 0→1 value with keyframed tracks), so it stays
// smooth while the page below is still mounting.
type Step = [to: number, ms: number, easing?: (t: number) => number];
type Track = { from: number; steps: Step[] };
type Landing = {
  x?: Track;
  y?: Track;
  turn?: Track;
  scale?: Track;
  flash?: Track;
};
// Waits for the chosen option to fly back into the hub.
const LAND_DELAY = 140;
const out = Easing.out(Easing.quad);
const into = Easing.in(Easing.quad);
const arrive: Track = {
  from: 0.55,
  steps: [
    [1.08, 160, out],
    [1, 120],
  ],
};
const wiggle = (values: number[], ms: number): Track => ({
  from: 0,
  steps: values.map(value => [value, ms] as Step),
});
// "Hub" is the idle button, which shows the ball.
const landings: Record<HubRoute | 'Hub', Landing> = {
  // Saha: the ball hops up, lands and rebounds once.
  Hub: {
    scale: arrive,
    y: {
      from: 0,
      steps: [
        [-20, 170, out],
        [0, 170, into],
        [-7, 110, out],
        [0, 110, into],
      ],
    },
  },
  // Sosyal: the bubbles pop in and beat twice like a like.
  Social: {
    scale: {
      from: 0.55,
      steps: [
        [1.12, 170, out],
        [0.95, 120],
        [1.14, 130, out],
        [1, 200],
      ],
    },
    turn: wiggle([-7, 6, -3, 0], 90),
  },
  // Profil: the player rises into the hub and gives a proud little nod.
  Profile: {
    scale: arrive,
    y: {
      from: 12,
      steps: [
        [-5, 220, out],
        [0, 160, into],
      ],
    },
    turn: wiggle([-9, 7, -3, 0], 110),
  },
  // Takımlar: the stadium swells as its floodlights come on.
  Teams: {
    scale: {
      from: 0.55,
      steps: [
        [1.14, 240, out],
        [0.97, 160],
        [1, 140],
      ],
    },
    flash: {
      from: 0,
      steps: [
        [1, 160],
        [0, 700, out],
      ],
    },
  },
  // Oyunlar: the pad rumbles like a vibrating controller.
  Games: {
    scale: arrive,
    x: wiggle([3, -3, 3, -3, 2.5, -2.5, 1.5, -1.5, 0], 45),
    turn: wiggle([5, -5, 5, -5, 3, -3, 0], 55),
  },
};
const trackLength = (track?: Track) =>
  track ? track.steps.reduce((sum, [, ms]) => sum + ms, 0) : 0;
function landingLength(landing: Landing) {
  const { x, y, turn, scale, flash } = landing;
  return LAND_DELAY + Math.max(...[x, y, turn, scale, flash].map(trackLength));
}
// Samples each eased step so the native interpolation follows its curve.
function play(
  time: Animated.Value,
  total: number,
  track: Track | undefined,
  rest: number,
) {
  if (!track) return rest;
  const input = [0];
  const output = [track.from];
  let at = LAND_DELAY;
  let value = track.from;
  input.push(at / total);
  output.push(value);
  for (const [to, ms, easing = Easing.inOut(Easing.quad)] of track.steps) {
    for (let i = 1; i <= 6; i += 1) {
      input.push((at + (ms * i) / 6) / total);
      output.push(value + (to - value) * easing(i / 6));
    }
    at += ms;
    value = to;
  }
  if (at < total) {
    input.push(1);
    output.push(value);
  }
  return time.interpolate({ inputRange: input, outputRange: output });
}

// The raised centre button. Idle ("Saha") it shows the ball, which hops once
// and sends out a couple of pulses to invite a tap; while one of its pages is
// open it shows that page's artwork; with the menu open it turns into a lime
// close button.
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
  // 1 is the resting pose; a landing replays it from 0.
  const time = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const motion = useMemo(() => {
    const landing = landings[active ?? 'Hub'];
    const total = landingLength(landing);
    return {
      total,
      x: play(time, total, landing.x, 0),
      y: play(time, total, landing.y, 0),
      turn: play(time, total, landing.turn, 0),
      scale: play(time, total, landing.scale, 1),
      flash: play(time, total, landing.flash, 0),
    };
  }, [active, time]);
  useEffect(() => {
    if (reducedMotion) return;
    time.setValue(0);
    const animation = Animated.timing(time, {
      toValue: 1,
      duration: motion.total,
      easing: Easing.linear,
      useNativeDriver: native,
    });
    animation.start();
    return () => animation.stop();
  }, [active, motion, time, reducedMotion]);
  useEffect(() => {
    if (active || reducedMotion) return;
    pulse.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(900),
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
  const Art = active ? hubArt[active] : HubBallArt;
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
        <View style={styles.hubCircle}>
          <Animated.View style={[styles.hubFill, { opacity: fade(0, 1) }]} />
          <Animated.View
            style={[
              styles.hubFlash,
              {
                opacity: Animated.multiply(motion.flash, 0.5),
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
                    rotate: Animated.multiply(motion.turn, 1).interpolate({
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
          <Animated.View
            style={[
              styles.hubLayer,
              {
                opacity: progress.interpolate({
                  inputRange: [0.4, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    rotate: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-90deg', '0deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <X size={28} color={colors.brandInk} strokeWidth={2.8} />
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
    backgroundColor: colors.raised,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.glow,
  },
  hubFill: {
    position: 'absolute',
    // Covers the 2 pt border too, so the open hub is one solid disc.
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: HUB_SIZE / 2,
    backgroundColor: colors.brand,
  },
  hubFlash: {
    position: 'absolute',
    // Covers the 2 pt border too, so the open hub is one solid disc.
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
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
