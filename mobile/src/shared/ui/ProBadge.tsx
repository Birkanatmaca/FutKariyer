import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { copy } from '../lib/copy';
import { colors, radius, space } from '../../styles/tokens';

// Small lime "PRO" pill next to a name; the label is read as "Pro üye".
export function ProBadge() {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={copy.pro.badgeLabel}
      style={styles.pill}
    >
      <Text style={styles.text}>{copy.pro.badge}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    paddingHorizontal: space.sm - 2,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  text: {
    color: colors.brandInk,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
