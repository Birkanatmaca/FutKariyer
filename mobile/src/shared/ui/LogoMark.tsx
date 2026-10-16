import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../styles/tokens';
import { BallMark } from './BallMark';

// The Fut Career mark: the lit football on the lime square, placed exactly as
// in the app icon (assets/brand/app-icon.svg: ball box 186,160 652 on 1024).
export function LogoMark({ size }: { size: number }) {
  const unit = size / 1024;
  return (
    <View
      style={[
        styles.square,
        { width: size, height: size, borderRadius: (size * 16) / 72 },
      ]}
    >
      <View style={{ marginLeft: 186 * unit, marginTop: 160 * unit }}>
        <BallMark size={652 * unit} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  square: { backgroundColor: colors.brand, overflow: 'hidden' },
});
