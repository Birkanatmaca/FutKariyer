import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeftRight, Undo2 } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';

const text = copy.coaches;

// Always-visible strip while a coach runs a club account, with the way back.
export function DelegateBanner({
  clubName,
  coachName,
  onBack,
}: {
  clubName: string;
  coachName: string;
  onBack(): Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={
          text.banner(clubName) + ', ' + text.bannerBy(coachName)
        }
        style={styles.bar}
      >
        <ArrowLeftRight size={18} color={colors.brandInk} strokeWidth={2.4} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {text.banner(clubName)}
          </Text>
          <Text numberOfLines={1} style={styles.by}>
            {text.bannerBy(coachName)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.backTo(coachName)}
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onBack();
            } finally {
              setBusy(false);
            }
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Undo2 size={15} color={colors.text} />
          )}
          <Text style={styles.backText}>{text.back}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.brand },
  bar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  copy: { flex: 1 },
  title: { color: colors.brandInk, fontSize: 14, fontWeight: '800' },
  by: { color: colors.brandInk, fontSize: 11, opacity: 0.75 },
  back: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandInk,
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
