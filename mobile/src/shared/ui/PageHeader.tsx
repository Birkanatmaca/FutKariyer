import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../../styles/tokens';

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    fontWeight: '800',
  },
  description: { color: colors.secondary, fontSize: 14, lineHeight: 22 },
});
