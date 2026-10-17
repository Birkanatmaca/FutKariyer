import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { colors } from '../../../styles/tokens';

const RAYS = 12;

// The global rating emblem: a lit trophy in front of slowly turning
// floodlight rays. Decorative only; hidden from assistive tech.
export function RatingTrophy({
  size,
  animated = true,
}: {
  size: number;
  animated?: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!animated || reduced) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, reduced, spin]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <View
      style={{ width: size, height: size }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
      >
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="rayFade" cx="50%" cy="50%" r="50%">
              <Stop
                offset="0.15"
                stopColor={colors.floodlight}
                stopOpacity={0.5}
              />
              <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <G>
            {Array.from({ length: RAYS }, (_, i) => (
              <Path
                key={i}
                d="M100 100 L94 4 L106 4 Z"
                fill="url(#rayFade)"
                transform={`rotate(${(360 / RAYS) * i} 100 100)`}
              />
            ))}
          </G>
        </Svg>
      </Animated.View>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id="trophyGlow" cx="50%" cy="48%" r="45%">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={0.45} />
            <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="cup" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.floodlight} />
            <Stop offset="0.55" stopColor={colors.brand} />
            <Stop offset="1" stopColor={colors.brandHover} />
          </LinearGradient>
          <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.floodlight} stopOpacity={0.9} />
            <Stop offset="1" stopColor={colors.floodlight} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle cx={100} cy={96} r={86} fill="url(#trophyGlow)" />
        {/* handles */}
        <Path
          d="M68 62 H48 C48 92 58 104 74 106 M132 62 H152 C152 92 142 104 126 106"
          stroke={colors.brand}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
        {/* cup */}
        <Path
          d="M64 50 H136 V82 C136 110 120 126 100 130 C80 126 64 110 64 82 Z"
          fill="url(#cup)"
        />
        <Path
          d="M74 58 C74 92 82 110 92 120"
          stroke="url(#shine)"
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
        />
        {/* star */}
        <Path
          d="M100 70 L105 81 L117 82 L108 90 L111 102 L100 96 L89 102 L92 90 L83 82 L95 81 Z"
          fill={colors.brandInk}
          opacity={0.85}
        />
        {/* stem and base */}
        <Rect x={92} y={128} width={16} height={18} fill={colors.brand} />
        <Rect
          x={72}
          y={144}
          width={56}
          height={14}
          rx={4}
          fill={colors.overlay}
        />
        <Rect
          x={64}
          y={156}
          width={72}
          height={16}
          rx={5}
          fill={colors.raised}
        />
        <Rect
          x={78}
          y={161}
          width={44}
          height={5}
          rx={2.5}
          fill={colors.brand}
        />
        {/* sparkles */}
        <Path
          d="M38 40 L41 47 L48 50 L41 53 L38 60 L35 53 L28 50 L35 47 Z"
          fill={colors.floodlight}
          opacity={0.9}
        />
        <Path
          d="M164 30 L166 35 L171 37 L166 39 L164 44 L162 39 L157 37 L162 35 Z"
          fill={colors.accent}
        />
        <Path
          d="M160 120 L162 125 L167 127 L162 129 L160 134 L158 129 L153 127 L158 125 Z"
          fill={colors.brand}
        />
      </Svg>
    </View>
  );
}
