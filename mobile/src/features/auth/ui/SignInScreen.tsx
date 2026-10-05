import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, Mail } from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
import { validateLogin, type FieldErrors } from '../application/validation';

export function SignInScreen({ onSignUp }: { onSignUp(): void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) {
      return;
    }
    const errors = validateLogin({ email, password });
    setFields(errors);
    setError(null);
    if (Object.keys(errors).length) {
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (failure) {
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
        <View>
          <Text style={styles.heading}>{copy.signIn.formTitle}</Text>
          <Text style={styles.description}>{copy.signIn.formDescription}</Text>
        </View>
        <Field
          label={copy.form.email}
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          error={fields.email}
          placeholder={copy.form.emailPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
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
        <ErrorBanner message={error} />
        <Button label={copy.signIn.button} onPress={submit} loading={busy} />
        <View style={styles.switch}>
          <Text style={styles.question}>{copy.signIn.question}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onSignUp}
            disabled={busy}
            hitSlop={10}
          >
            <Text style={styles.link}>{copy.signIn.link}</Text>
          </Pressable>
        </View>
      </View>
    </AuthFrame>
  );
}
const styles = StyleSheet.create({
  form: { gap: space.xl },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  description: { fontSize: 13, color: colors.muted, marginTop: space.sm },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  question: { color: colors.secondary, fontSize: 13 },
  link: { color: colors.brand, fontSize: 13, fontWeight: '700' },
});
