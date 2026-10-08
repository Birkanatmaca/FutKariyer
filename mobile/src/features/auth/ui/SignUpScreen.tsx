import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
import {
  validateRegistration,
  type FieldErrors,
} from '../application/validation';
export function SignUpScreen({ onSignIn }: { onSignIn(): void }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) {
      return;
    }
    const input = {
      fullName,
      email: email.trim(),
      password,
      role: 'player' as const,
    };
    const errors = validateRegistration(input);
    setFields(errors);
    setError(null);
    if (Object.keys(errors).length) {
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      await signUp(input);
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
    <AuthFrame
      title={copy.signUp.title}
      description={copy.signUp.description}
      onBack={onSignIn}
      compact
    >
      <View style={styles.form}>
        <Text accessibilityRole="header" style={styles.heading}>
          {copy.signUp.formTitle}
        </Text>
        <Field
          label={copy.signUp.name}
          icon={UserRound}
          value={fullName}
          onChangeText={setFullName}
          error={fields.fullName}
          placeholder={copy.signUp.namePlaceholder}
          autoComplete="name"
          textContentType="name"
          editable={!busy}
          maxLength={80}
        />
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
          autoComplete="new-password"
          textContentType="newPassword"
          hint={copy.signUp.passwordHelp}
          editable={!busy}
        />
        <Text style={styles.privacy}>{copy.signUp.privacy}</Text>
        <ErrorBanner message={error} />
        <Button label={copy.signUp.button} onPress={submit} loading={busy} />
        <View style={styles.switch}>
          <Text style={styles.question}>{copy.signUp.question}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onSignIn}
            disabled={busy}
            hitSlop={10}
          >
            <Text style={styles.link}>{copy.signUp.link}</Text>
          </Pressable>
        </View>
        <Text style={styles.clubHelp}>{copy.signUp.clubHelp}</Text>
      </View>
    </AuthFrame>
  );
}
const styles = StyleSheet.create({
  form: { gap: space.lg },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  privacy: { color: colors.secondary, fontSize: 12, lineHeight: 19 },
  clubHelp: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  question: { color: colors.secondary, fontSize: 13 },
  link: { color: colors.brand, fontSize: 13, fontWeight: '700' },
});
