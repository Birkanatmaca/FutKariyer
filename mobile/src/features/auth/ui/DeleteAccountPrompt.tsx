import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, TriangleAlert } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  KeyboardAwareScrollView,
  keyboardOffset,
} from '../../../shared/ui/keyboard';
import { colors, radius, space, type } from '../../../styles/tokens';

const text = copy.account;

// Permanent account deletion, confirmed with the current password.
export function DeleteAccountPrompt({
  visible,
  onCancel,
  onDelete,
}: {
  visible: boolean;
  onCancel(): void;
  onDelete(password: string): Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  useEffect(() => {
    if (visible) {
      setPassword('');
      setError('');
      setFieldError('');
    }
  }, [visible]);
  async function submit() {
    if (busy) return;
    if (!password) {
      setFieldError(text.passwordRequired);
      return;
    }
    setBusy(true);
    setError('');
    setFieldError('');
    try {
      await onDelete(password);
    } catch (failure) {
      if (failure instanceof ApiError && failure.fields.password) {
        setFieldError(failure.fields.password);
      } else {
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
      }
      setBusy(false);
    }
  }
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
          <KeyboardAwareScrollView
            bottomOffset={keyboardOffset}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.icon}>
              <TriangleAlert size={26} color={colors.danger} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {text.deleteTitle}
            </Text>
            <Text style={styles.body}>{text.deleteBody}</Text>
            <Field
              label={copy.form.password}
              icon={LockKeyhole}
              value={password}
              onChangeText={setPassword}
              error={fieldError}
              password
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              editable={!busy}
            />
            <ErrorBanner message={error} />
            <Button
              label={text.deleteConfirm}
              loading={busy}
              onPress={submit}
            />
            <Button
              label={copy.social.cancel}
              secondary
              disabled={busy}
              onPress={onCancel}
            />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.scrim,
  },
  dialog: {
    maxHeight: '90%',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  content: { padding: space.xl, gap: space.md },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerWash,
  },
  title: { ...type.headline, fontSize: 19, color: colors.text },
  body: { ...type.body, color: colors.secondary },
});
