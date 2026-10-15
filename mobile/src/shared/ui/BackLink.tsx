import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, space } from '../../styles/tokens';

export function BackLink({
  label,
  onPress,
}: {
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.back}
    >
      <ArrowLeft size={18} color={colors.text} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.md,
  },
  text: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
