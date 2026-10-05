import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Check,
  CircleUserRound,
  LockKeyhole,
  Mail,
  Shield,
  UserRound,
  Whistle,
} from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
import {
  validateRegistration,
  type FieldErrors,
} from '../application/validation';
import type { AccountRole } from '../domain/models';

const roles = [
  { role: 'player', Icon: CircleUserRound },
  { role: 'coach', Icon: Whistle },
  { role: 'club', Icon: Shield },
] as const;
export function SignUpScreen({ onSignIn }: { onSignIn(): void }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('player');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
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
      role,
      adultConfirmed,
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
        <Text style={styles.heading}>{copy.signUp.formTitle}</Text>
        <View style={styles.roleGroup}>
          <Text style={styles.label}>{copy.signUp.roleLabel}</Text>
          <View style={styles.roles}>
            {roles.map(({ role: option, Icon }) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: role === option }}
                disabled={busy}
                onPress={() => setRole(option)}
                style={[styles.role, role === option && styles.roleSelected]}
              >
                <Icon
                  size={21}
                  color={role === option ? colors.brand : colors.secondary}
                />
                <Text
                  style={[
                    styles.roleText,
                    role === option && styles.roleTextSelected,
                  ]}
                >
                  {copy.roles[option]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
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
        <View style={styles.confirmGroup}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={copy.signUp.adult}
            accessibilityState={{ checked: adultConfirmed }}
            disabled={busy}
            onPress={() => setAdultConfirmed(!adultConfirmed)}
            style={styles.confirm}
          >
            <View style={[styles.checkbox, adultConfirmed && styles.checked]}>
              {adultConfirmed && (
                <Check size={15} strokeWidth={3} color={colors.brandInk} />
              )}
            </View>
            <Text style={styles.confirmText}>{copy.signUp.adult}</Text>
          </Pressable>
          {!!fields.adultConfirmed && (
            <Text style={styles.error}>{fields.adultConfirmed}</Text>
          )}
          <Text style={styles.privacy}>{copy.signUp.privacy}</Text>
        </View>
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
  form: { gap: space.xl },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  label: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  roleGroup: { gap: space.md },
  roles: { flexDirection: 'row', gap: space.sm },
  role: {
    flex: 1,
    gap: space.sm,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  roleSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  roleText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  roleTextSelected: { color: colors.brand },
  confirmGroup: { gap: space.md },
  confirm: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    minHeight: 40,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.brand, borderColor: colors.brand },
  confirmText: { color: colors.secondary, fontSize: 13, flex: 1 },
  privacy: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  question: { color: colors.secondary, fontSize: 13 },
  link: { color: colors.brand, fontSize: 13, fontWeight: '700' },
});
