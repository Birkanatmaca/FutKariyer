import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';

export function DeleteContentPrompt({
  visible,
  busy,
  reply,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  reply?: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>
            {reply ? copy.social.deleteReply : copy.social.deletePost}
          </Text>
          <Text style={styles.body}>
            {reply ? copy.social.deleteReplyBody : copy.social.deletePostBody}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={styles.button}
            >
              <Text style={styles.cancel}>{copy.social.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={onConfirm}
              style={[styles.button, styles.danger]}
            >
              <Text style={styles.confirm}>
                {busy ? copy.social.deleting : copy.social.delete}
              </Text>
            </Pressable>
          </View>
        </View>
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
    backgroundColor: colors.bg,
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
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
  },
  danger: { backgroundColor: colors.danger },
  cancel: { color: colors.text, fontWeight: '700' },
  confirm: { color: colors.brandInk, fontWeight: '800' },
});
