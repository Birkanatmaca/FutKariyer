import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, space } from '../../../styles/tokens';

export function Choice({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  choice: {
    minHeight: 42,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    justifyContent: 'center',
  },
  choiceSelected: {
    backgroundColor: colors.brandWash,
    borderColor: colors.brand,
  },
  choiceText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  choiceTextSelected: { color: colors.brand },
});
