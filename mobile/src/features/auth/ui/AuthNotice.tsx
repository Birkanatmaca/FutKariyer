import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';

// Neutral, informational counterpart of ErrorBanner for auth screens.
export function AuthNotice({
  message,
  live,
}: {
  message?: string | null;
  live?: boolean;
}) {
  if (!message) {
    return null;
  }
  return (
    <View
      accessibilityRole={live ? 'alert' : undefined}
      accessibilityLiveRegion={live ? 'polite' : undefined}
      style={styles.box}
    >
      <Info color={colors.info} size={18} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  text: { color: colors.text, fontSize: 13, lineHeight: 20, flex: 1 },
});
