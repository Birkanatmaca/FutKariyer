import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../../styles/tokens';

export function PageHeader({
  eyebrow,
  title,
  description,
  hint,
  accessory,
}: {
  eyebrow: string;
  title: string;
  // Real content (a league's or article's own text) shown under the title.
  description?: string;
  // Generic explanations stay out of sight and are read by screen readers only.
  hint?: string;
  // Compact control at the top right of the header (e.g. a balance badge).
  accessory?: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowMark} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <View style={styles.titleRow}>
        <Text
          accessibilityRole="header"
          accessibilityHint={hint}
          style={styles.title}
        >
          {title}
        </Text>
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.md },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrowMark: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.brand,
  },
  eyebrow: { ...type.eyebrow, color: colors.brand },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accessory: { marginLeft: 'auto' },
  title: { ...type.display, color: colors.text, flexShrink: 1 },
  description: { ...type.body, color: colors.secondary, maxWidth: 420 },
});
