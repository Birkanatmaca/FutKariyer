import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../styles/tokens';
import { wordmarkCareer, wordmarkFut, wordmarkSize } from './brand-paths';

export type BrandSurface = 'light' | 'dark';

// FUTCAREER in Barlow Condensed ExtraBold Italic outlines. Dark surfaces:
// white FUT and lime CAREER; light surfaces: all black.
export function Wordmark({
  height,
  surface = 'dark',
}: {
  height: number;
  surface?: BrandSurface;
}) {
  const light = surface === 'light';
  const width = (wordmarkSize.width / wordmarkSize.height) * height;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={'0 0 ' + wordmarkSize.width + ' ' + wordmarkSize.height}
      aria-hidden
    >
      <Path d={wordmarkFut} fill={light ? colors.brandInk : colors.text} />
      <Path d={wordmarkCareer} fill={light ? colors.brandInk : colors.brand} />
    </Svg>
  );
}
