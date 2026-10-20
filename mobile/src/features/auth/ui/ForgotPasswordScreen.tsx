import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Hash, LockKeyhole, Mail } from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { AuthNotice } from './AuthNotice';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
import {
  validEmail,
  validateNewPassword,
  type FieldErrors,
} from '../application/validation';

const text = copy.security;

// Şifremi unuttum (20 Oct 2026): the address gets a 6-digit code; the code
// and a new password sign this device in and end every other session.
export function ForgotPasswordScreen({ onBack }: { onBack(): void }) {
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const trimmed = email.trim();
    if (!validEmail(trimmed)) {
      setFields({ email: copy.form.emailError });
      return;
    }
    setFields({});
    run(async () => {
      await forgotPassword(trimmed);
      setNotice(text.codeSent(trimmed));
      setStep('code');
    });
  }

  function reset() {
    const errors: FieldErrors = validateNewPassword(password, repeat);
    if (!/^\d{6}$/.test(code.trim())) errors.code = text.codeError;
    setFields(errors);
    if (Object.keys(errors).length) return;
    run(() =>
      resetPassword({ email: email.trim(), code: code.trim(), password }),
    );
  }

  function resend() {
    run(async () => {
      await forgotPassword(email.trim());
      setNotice(text.resent);
    });
  }

  return (
    <AuthFrame
      title={text.forgotTitle}
      description={text.forgotDescription}
      onBack={onBack}
    >
      <View style={styles.form}>
        {step === 'email' ? (
          <>
            <Field
              label={copy.form.email}
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              error={fields.email}
              placeholder={copy.form.emailPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={254}
              editable={!busy}
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <ErrorBanner message={error} />
            <Button
              label={text.sendCode}
              onPress={send}
              loading={busy}
              compact
            />
          </>
        ) : (
          <>
            <AuthNotice message={notice} live />
            <Field
              label={text.code}
              icon={Hash}
              value={code}
              onChangeText={value => setCode(value.replace(/\D/g, ''))}
              error={fields.code}
              placeholder={text.codePlaceholder}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              editable={!busy}
            />
            <Field
              label={text.newPassword}
              icon={LockKeyhole}
              value={password}
              onChangeText={setPassword}
              error={fields.password}
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
              onSubmitEditing={reset}
            />
            <ErrorBanner message={error} />
            <Button
              label={text.resetButton}
              onPress={reset}
              loading={busy}
              compact
            />
            <View style={styles.links}>
              <Pressable
                accessibilityRole="button"
                onPress={resend}
                disabled={busy}
                hitSlop={12}
              >
                <Text style={styles.link}>{text.resend}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setNotice(null);
                  setError(null);
                }}
                disabled={busy}
                hitSlop={12}
              >
                <Text style={styles.secondary}>{text.otherEmail}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
  },
  link: { color: colors.brand, fontSize: 14, fontWeight: '700' },
  secondary: { color: colors.secondary, fontSize: 14, fontWeight: '600' },
});
