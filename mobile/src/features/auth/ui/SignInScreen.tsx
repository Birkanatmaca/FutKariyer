import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, UserRound } from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { AuthNotice } from './AuthNotice';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, space, type } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
import { validateLogin, type FieldErrors } from '../application/validation';

// Correct credentials for an application that is still pending or was
// declined; the server message is informational rather than an error.
const applicationCodes = ['pending_approval', 'application_rejected'];

export function SignInScreen({ onSignUp }: { onSignUp(): void }) {
  const { signIn, sessionNotice } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) {
      return;
    }
    const errors = validateLogin({ identifier, password });
    setFields(errors);
    setError(null);
    setNotice(null);
    if (Object.keys(errors).length) {
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      await signIn({ identifier: identifier.trim(), password });
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        failure.status === 403 &&
        applicationCodes.includes(failure.code)
      ) {
        setNotice(failure.message);
        return;
      }
      if (failure instanceof ApiError) {
        setFields(failure.fields);
      }
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title={copy.signIn.title} description={copy.signIn.description}>
      <View style={styles.form}>
        <Text accessibilityRole="header" style={styles.heading}>
          {copy.signIn.formTitle}
        </Text>
        <Field
          label={copy.form.identifier}
          icon={UserRound}
          value={identifier}
          onChangeText={setIdentifier}
          error={fields.identifier}
          placeholder={copy.form.identifierPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          maxLength={254}
          editable={!busy}
        />
        <Field
          label={copy.form.password}
          icon={LockKeyhole}
          value={password}
          onChangeText={setPassword}
          error={fields.password}
          placeholder={copy.form.passwordPlaceholder}
          password
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          editable={!busy}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <AuthNotice message={notice ?? sessionNotice} live />
        <ErrorBanner message={error} />
        <Button label={copy.signIn.button} onPress={submit} loading={busy} />
        <View style={styles.divider} accessibilityElementsHidden>
          <View style={styles.rule} />
          <Text style={styles.or}>{copy.signIn.or}</Text>
          <View style={styles.rule} />
        </View>
        <Button
          label={copy.signIn.link}
          accessibilityLabel={copy.signIn.question + ' ' + copy.signIn.link}
          onPress={onSignUp}
          disabled={busy}
          secondary
        />
      </View>
    </AuthFrame>
  );
}
const styles = StyleSheet.create({
  form: { gap: space.lg },
  heading: { ...type.headline, fontSize: 20, color: colors.text },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { ...type.caption, color: colors.muted },
});
