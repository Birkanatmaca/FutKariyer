import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { colors, radius, space } from '../../styles/tokens';
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <View accessibilityRole="alert" style={styles.box}>
      <CircleAlert color={colors.danger} size={18} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.dangerWash,
    borderRadius: radius.sm,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  text: { color: colors.danger, fontSize: 13, lineHeight: 20, flex: 1 },
});
