import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';

// Compact "?" sheet: the rules live here instead of on the game cards.
export function GameRulesSheet({
  title,
  rules,
  onClose,
}: {
  title: string | null;
  rules: readonly string[];
  onClose(): void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={!!title}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.games.close}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.xl) },
          ]}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.games.close}
              onPress={onClose}
              style={styles.close}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
          {rules.map((rule, i) => (
            <View key={rule} style={styles.rule}>
              <View style={styles.index}>
                <Text style={styles.number}>{i + 1}</Text>
              </View>
              <Text style={styles.body}>{rule}</Text>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.82,
  },
  sheet: {
    gap: space.lg,
    padding: space.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '800' },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  rule: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  index: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  body: { color: colors.secondary, fontSize: 13, lineHeight: 20, flex: 1 },
});
