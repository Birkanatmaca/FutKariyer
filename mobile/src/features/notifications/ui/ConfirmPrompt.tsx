import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';

// Confirmation for the bulk notification actions; destructive ones use the
// danger tone.
export function ConfirmPrompt({
  request,
  busy,
  onCancel,
  onConfirm,
}: {
  request: {
    title: string;
    body: string;
    action: string;
    danger: boolean;
  } | null;
  busy: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <Modal
      visible={!!request}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        {request ? (
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" style={styles.title}>
              {request.title}
            </Text>
            <Text style={styles.body}>{request.body}</Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancel}>
                  {copy.notifications.confirmCancel}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.button,
                  request.danger ? styles.danger : styles.primary,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.confirm}>
                  {busy ? copy.notifications.confirmBusy : request.action}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
    backgroundColor: colors.scrim,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    padding: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.lg,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  body: { color: colors.secondary, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: space.md },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  primary: { backgroundColor: colors.brand },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.85 },
  cancel: { color: colors.text, fontWeight: '700' },
  confirm: { color: colors.brandInk, fontWeight: '800' },
});
