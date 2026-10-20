import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Wordmark } from '../../../shared/ui/Wordmark';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';

// Top of the sign-in screen: a night pitch in perspective under two
// floodlights, with the FUTCAREER wordmark (no football mark). The scene is
// static decoration, hidden from assistive tech; only the wordmark is read.
export function StadiumHero({ height = 280 }: { height?: number }) {
  const { width } = useWindowDimensions();
  const horizon = height * 0.56;
  // A point across the pitch: u from 0 (left touchline) to 1 (right), depth
  // from 0 (far goal line) to 1 (bottom of the hero and beyond).
  const point = (u: number, depth: number) => {
    const half = width * (0.21 + depth * 0.62);
    return {
      x: width / 2 - half + u * half * 2,
      y: horizon + depth * (height * 1.05 - horizon),
    };
  };
  const line = (from: [number, number], to: [number, number]) => {
    const a = point(...from);
    const b = point(...to);
    return `M${a.x} ${a.y}L${b.x} ${b.y}`;
  };
  const halfway = point(0.5, 0.62);
  const circle = (point(1, 0.62).x - point(0, 0.62).x) * 0.13;
  const lamps = [
    { x: width * 0.12, y: height * 0.14 },
    { x: width * 0.88, y: height * 0.14 },
  ];
  return (
    <View style={[styles.hero, { height }]}>
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <RadialGradient id="spill" cx="50%" cy="0%" rx="75%" ry="85%">
            <Stop offset="0" stopColor={colors.floodlight} stopOpacity="0.16" />
            <Stop offset="0.5" stopColor={colors.brand} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="lamp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.floodlight} stopOpacity="0.55" />
            <Stop offset="1" stopColor={colors.floodlight} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.floodlight} stopOpacity="0.14" />
            <Stop offset="1" stopColor={colors.floodlight} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brand} stopOpacity="0.1" />
            <Stop offset="1" stopColor={colors.brand} stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={colors.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#spill)" />
        {/* Light from each tower falls across the pitch. */}
        {lamps.map(lamp => (
          <Path
            key={'beam' + lamp.x}
            d={`M${lamp.x - 8} ${lamp.y}L${lamp.x + 8} ${lamp.y}L${
              width / 2 + (lamp.x < width / 2 ? width * 0.08 : width * 0.42)
            } ${height}L${
              width / 2 - (lamp.x < width / 2 ? width * 0.42 : width * 0.08)
            } ${height}Z`}
            fill="url(#beam)"
          />
        ))}
        <Path
          d={`${line([0, 0], [1, 0])}L${point(1, 1).x} ${point(1, 1).y}L${
            point(0, 1).x
          } ${point(0, 1).y}Z`}
          fill="url(#grass)"
        />
        <G stroke={colors.pitchLine} strokeWidth={1.2} fill="none">
          <Path d={line([0, 0], [1, 0])} />
          <Path d={line([0, 0], [0, 1])} />
          <Path d={line([1, 0], [1, 1])} />
          <Path d={line([0, 0.62], [1, 0.62])} />
          <Ellipse
            cx={halfway.x}
            cy={halfway.y}
            rx={circle}
            ry={circle * 0.34}
          />
          <Path
            d={`${line([0.28, 0], [0.28, 0.12])}L${point(0.72, 0.12).x} ${
              point(0.72, 0.12).y
            }L${point(0.72, 0).x} ${point(0.72, 0).y}`}
          />
        </G>
        <Line
          x1={point(0.46, 0).x}
          y1={horizon}
          x2={point(0.54, 0).x}
          y2={horizon}
          stroke={colors.floodlight}
          strokeOpacity={0.5}
          strokeWidth={2}
        />
        {/* The two floodlight towers. */}
        {lamps.map(lamp => (
          <G key={'tower' + lamp.x}>
            <Line
              x1={lamp.x}
              y1={lamp.y + 8}
              x2={lamp.x}
              y2={horizon - 6}
              stroke={colors.hairline}
              strokeWidth={2}
            />
            <Circle cx={lamp.x} cy={lamp.y} r={30} fill="url(#lamp)" />
            <Rect
              x={lamp.x - 14}
              y={lamp.y - 7}
              width={28}
              height={14}
              rx={3}
              fill={colors.raised}
            />
            {[-8, 0, 8].map(dx =>
              [-3, 3].map(dy => (
                <Circle
                  key={`${dx}:${dy}`}
                  cx={lamp.x + dx}
                  cy={lamp.y + dy}
                  r={2.2}
                  fill={colors.floodlight}
                />
              )),
            )}
          </G>
        ))}
        <Rect width={width} height={height} fill="url(#fade)" />
      </Svg>
      <View
        style={[styles.brand, { top: height * 0.3 }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={copy.brand}
      >
        <Wordmark height={38} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden' },
  brand: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    alignItems: 'center',
  },
});
