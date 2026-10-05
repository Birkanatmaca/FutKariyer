import React from 'react';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors } from '../../styles/tokens';
export function PitchArt({
  width = 200,
  height = 230,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 200 230"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect
        x={16}
        y={12}
        width={168}
        height={206}
        rx={8}
        fill="none"
        stroke={colors.pitchLine}
        strokeWidth={1.2}
      />
      <Line
        x1={16}
        y1={115}
        x2={184}
        y2={115}
        stroke={colors.pitchLine}
        strokeWidth={1.2}
      />
      <Circle
        cx={100}
        cy={115}
        r={31}
        fill="none"
        stroke={colors.pitchLine}
        strokeWidth={1.2}
      />
      <Rect
        x={52}
        y={12}
        width={96}
        height={38}
        fill="none"
        stroke={colors.pitchLine}
        strokeWidth={1.2}
      />
      <Rect
        x={70}
        y={12}
        width={60}
        height={16}
        fill="none"
        stroke={colors.pitchLine}
      />
      <Rect
        x={52}
        y={180}
        width={96}
        height={38}
        fill="none"
        stroke={colors.pitchLine}
        strokeWidth={1.2}
      />
      <Rect
        x={70}
        y={202}
        width={60}
        height={16}
        fill="none"
        stroke={colors.pitchLine}
      />
      <Circle cx={137} cy={83} r={12} fill={colors.brandWash} />
      <Circle cx={137} cy={83} r={4} fill={colors.brand} />
      <Circle cx={65} cy={152} r={3} fill={colors.accent} />
      <Line
        x1={71}
        y1={145}
        x2={123}
        y2={97}
        stroke={colors.pitchLine}
        strokeDasharray="4 6"
      />
    </Svg>
  );
}
