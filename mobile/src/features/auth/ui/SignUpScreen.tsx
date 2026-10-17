import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { FootballTypePicker, LicenseCheck } from './FootballChoices';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, space } from '../../../styles/tokens';
import type {
  DeclaredLicenseStatus,
  PlayerFootballType,
} from '../../../shared/domain/football';
import { useAuth } from '../application/AuthProvider';
import {
  validateRegistration,
  type FieldErrors,
} from '../application/validation';
export function SignUpScreen({
  onBack,
  onInfo,
  onSignIn,
}: {
  onBack?: () => void;
  onInfo?: () => void;
  onSignIn(): void;
}) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [footballType, setFootballType] = useState<PlayerFootballType | ''>('');
  // Unchecked license box means no active license, so this always has a value.
  const [licenseStatus, setLicenseStatus] =
    useState<DeclaredLicenseStatus>('unlicensed');
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function chooseFootballType(value: PlayerFootballType) {
    setFootballType(value);
    setFields(current => {
      const next = { ...current };
      delete next.footballType;
      return next;
    });
  }
  async function submit() {
    if (busy) {
      return;
    }
    const input = {
      fullName,
      email: email.trim(),
      password,
      role: 'player' as const,
      footballType,
      licenseStatus,
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
      await signUp({
        ...input,
        footballType: footballType as PlayerFootballType,
        licenseStatus,
      });
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
      onBack={onBack ?? onSignIn}
      onInfo={onInfo}
      step={2}
    >
      <View style={styles.form}>
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
        <FootballTypePicker
          value={footballType}
          error={fields.footballType}
          disabled={busy}
          onChange={chooseFootballType}
        />
        <LicenseCheck
          checked={licenseStatus === 'licensed'}
          disabled={busy}
          onChange={checked =>
            setLicenseStatus(checked ? 'licensed' : 'unlicensed')
          }
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
      </View>
    </AuthFrame>
  );
}
const styles = StyleSheet.create({
  form: { gap: space.lg },
  privacy: { color: colors.secondary, fontSize: 12, lineHeight: 19 },
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
