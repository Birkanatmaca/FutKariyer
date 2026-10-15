import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../../styles/tokens';

// Stylised goalkeeper drawn from tokens, so it follows the theme and needs no image asset.
export function GoalkeeperArt({ height }: { height: number }) {
  return (
    <Svg
      width={height * 0.6}
      height={height}
      viewBox="0 0 60 100"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M20 26 L40 26 L43 60 L17 60 Z" fill={colors.accent} />
      <Path d="M20 28 L8 46 L12 50 L25 36 Z" fill={colors.accent} />
      <Path d="M40 28 L52 46 L48 50 L35 36 Z" fill={colors.accent} />
      <Circle cx={7} cy={50} r={6} fill={colors.brand} />
      <Circle cx={53} cy={50} r={6} fill={colors.brand} />
      <Circle cx={30} cy={14} r={9} fill={colors.text} />
      <Rect x={17} y={58} width={26} height={14} rx={2} fill={colors.raised} />
      <Rect
        x={19}
        y={72}
        width={9}
        height={26}
        rx={3}
        fill={colors.secondary}
      />
      <Rect
        x={32}
        y={72}
        width={9}
        height={26}
        rx={3}
        fill={colors.secondary}
      />
    </Svg>
  );
}
