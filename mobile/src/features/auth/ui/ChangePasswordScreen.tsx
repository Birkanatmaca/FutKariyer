import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, type } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
import {
  validateNewPassword,
  type FieldErrors,
} from '../application/validation';

const text = copy.security;

// Şifreni değiştir (20 Oct 2026): the current password is checked on the
// server; every other device is signed out, this one stays.
export function ChangePasswordScreen({ onBack }: { onBack(): void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const errors: FieldErrors = validateNewPassword(
      next,
      repeat,
      'newPassword',
    );
    if (!current) errors.currentPassword = copy.form.passwordRequired;
    else if (!errors.newPassword && next === current)
      errors.newPassword = text.sameError;
    setFields(errors);
    setError(null);
    setNotice(null);
    if (Object.keys(errors).length) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setNotice(text.changed);
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TopBar title={text.changeTitle} onBack={onBack} />
      <Text style={styles.hint}>{text.changeHint}</Text>
      <Field
        label={text.currentPassword}
        icon={LockKeyhole}
        value={current}
        onChangeText={setCurrent}
        error={fields.currentPassword}
        placeholder={text.currentPasswordPlaceholder}
        password
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        editable={!busy}
      />
      <Field
        label={text.newPassword}
        icon={LockKeyhole}
        value={next}
        onChangeText={setNext}
        error={fields.newPassword}
        placeholder={text.newPasswordPlaceholder}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
      />
      <Field
        label={text.repeatPassword}
        icon={LockKeyhole}
        value={repeat}
        onChangeText={setRepeat}
        error={fields.repeat}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorBanner message={error} />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <Button label={text.changeButton} onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...type.caption, color: colors.secondary, lineHeight: 19 },
  notice: { color: colors.success, fontSize: 13 },
});
