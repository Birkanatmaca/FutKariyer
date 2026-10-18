import React from 'react';
import { StyleSheet, View } from 'react-native';
import { copy } from '../lib/copy';
import { LogoMark } from './LogoMark';
import { Wordmark, type BrandSurface } from './Wordmark';

// Mark + wordmark lockup with the proportions of assets/brand/logo-lockup-*.svg
// (wordmark cap height 100/140 of the mark, gap 36/140), so the in-app logo
// matches the native launch screen. size is the mark's edge in points;
// mark={false} keeps only the wordmark at the same height.
export function Brand({
  size = 36,
  surface = 'dark',
  mark = true,
}: {
  size?: number;
  surface?: BrandSurface;
  mark?: boolean;
} = {}) {
  return (
    <View
      style={[styles.row, { gap: (size * 36) / 140 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={copy.brand}
    >
      {mark ? <LogoMark size={size} /> : null}
      <Wordmark height={(size * 100) / 140} surface={surface} />
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
