import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  Line,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../../styles/tokens';

// One soft floodlight spill at the top of a screen, with faint pitch lines.
// Purely decorative: static, hidden from assistive tech and never touchable.
export function Floodlight({ height = 420 }: { height?: number }) {
  const { width } = useWindowDimensions();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.layer, { height }]}
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient
            id="flood"
            cx="78%"
            cy="0%"
            rx="85%"
            ry="70%"
            fx="78%"
            fy="0%"
          >
            <Stop offset="0" stopColor={colors.floodlight} stopOpacity="0.28" />
            <Stop offset="0.45" stopColor={colors.brand} stopOpacity="0.1" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="fade" cx="50%" cy="0%" rx="70%" ry="100%">
            <Stop offset="0" stopColor={colors.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#flood)" />
        <Line
          x1={0}
          y1={height * 0.62}
          x2={width}
          y2={height * 0.62}
          stroke={colors.hairline}
          strokeWidth={1}
        />
        <Ellipse
          cx={width / 2}
          cy={height * 0.62}
          rx={width * 0.22}
          ry={width * 0.22}
          stroke={colors.hairline}
          strokeWidth={1}
          fill="none"
        />
        <Rect x={0} y={0} width={width} height={height} fill="url(#fade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
});
