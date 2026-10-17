import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import {
  AtSign,
  CircleCheck,
  ContactRound,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Shield,
} from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { AuthNotice } from './AuthNotice';
import { Choice } from './Choice';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { PlayerFootballType } from '../../../shared/domain/football';
import { useAuth } from '../application/AuthProvider';
import {
  toApplicationInput,
  validateApplication,
  type ApplicationDraft,
  type FieldErrors,
} from '../application/validation';
import type { ApplicationRole } from '../domain/models';

const text = copy.application;
type TextKey = Exclude<keyof ApplicationDraft, 'role' | 'footballType'>;

export function ApplicationScreen({
  role,
  onBack,
  onSignIn,
}: {
  role: ApplicationRole;
  onBack(): void;
  onSignIn(): void;
}) {
  const { apply } = useAuth();
  const [draft, setDraft] = useState<ApplicationDraft>({
    role,
    fullName: '',
    contactName: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    district: '',
    footballType: '',
    note: '',
  });
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const club = role === 'club';

  function change(key: TextKey) {
    return (value: string) =>
      setDraft(current => ({ ...current, [key]: value }));
  }
  function chooseFootballType(value: PlayerFootballType) {
    setDraft(current => ({ ...current, footballType: value }));
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
    const errors = validateApplication(draft);
    setFields(errors);
    setError(null);
    if (Object.keys(errors).length) {
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      await apply(toApplicationInput(draft));
      setSubmitted(true);
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

  const title = club ? text.clubTitle : text.organizerTitle;
  if (submitted) {
    return (
      <AuthFrame title={title} description={text.description}>
        <View style={styles.form}>
          <View style={styles.success}>
            <CircleCheck size={28} color={colors.success} />
            <Text accessibilityRole="header" style={styles.heading}>
              {text.successTitle}
            </Text>
            <Text style={styles.successText}>{text.successDescription}</Text>
          </View>
          <Button label={text.successBack} onPress={onSignIn} />
        </View>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame
      title={title}
      description={text.description}
      onBack={onBack}
      step={2}
    >
      <View style={styles.form}>
        <AuthNotice message={text.notice} />
        <Field
          label={club ? text.clubName : text.organizerName}
          icon={Shield}
          value={draft.fullName}
          onChangeText={change('fullName')}
          error={fields.fullName}
          placeholder={
            club ? text.clubNamePlaceholder : text.organizerNamePlaceholder
          }
          autoComplete="organization"
          textContentType="organizationName"
          editable={!busy}
          maxLength={80}
        />
        <Field
          label={text.contactName}
          icon={ContactRound}
          value={draft.contactName}
          onChangeText={change('contactName')}
          error={fields.contactName}
          placeholder={text.contactNamePlaceholder}
          autoComplete="name"
          textContentType="name"
          editable={!busy}
          maxLength={80}
        />
        <Field
          label={text.username}
          icon={AtSign}
          value={draft.username}
          onChangeText={change('username')}
          error={fields.username}
          placeholder={text.usernamePlaceholder}
          hint={text.usernameHint}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          editable={!busy}
          maxLength={32}
        />
        <Field
          label={copy.form.email}
          icon={Mail}
          value={draft.email}
          onChangeText={change('email')}
          error={fields.email}
          placeholder={copy.form.emailPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          maxLength={254}
        />
        <Field
          label={copy.form.password}
          icon={LockKeyhole}
          value={draft.password}
          onChangeText={change('password')}
          error={fields.password}
          placeholder={copy.form.passwordPlaceholder}
          password
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          hint={copy.signUp.passwordHelp}
          editable={!busy}
        />
        {club ? (
          <View style={styles.choiceSection}>
            <Text style={styles.choiceTitle}>{text.footballType}</Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {(['amateur', 'professional', 'halisaha'] as const).map(value => (
                <Choice
                  key={value}
                  label={text.footballTypes[value]}
                  selected={draft.footballType === value}
                  disabled={busy}
                  onPress={() => chooseFootballType(value)}
                />
              ))}
            </View>
            {fields.footballType ? (
              <Text accessibilityRole="alert" style={styles.fieldError}>
                {fields.footballType}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Field
          label={text.phone}
          icon={Phone}
          value={draft.phone}
          onChangeText={change('phone')}
          error={fields.phone}
          placeholder={text.phonePlaceholder}
          hint={text.privateHint}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={!busy}
          maxLength={30}
        />
        <Field
          label={text.district}
          icon={MapPin}
          value={draft.district}
          onChangeText={change('district')}
          error={fields.district}
          placeholder={text.districtPlaceholder}
          editable={!busy}
          maxLength={80}
        />
        <Field
          label={text.note}
          value={draft.note}
          onChangeText={change('note')}
          error={fields.note}
          placeholder={text.notePlaceholder}
          hint={text.privateHint}
          multiline
          textAlignVertical="top"
          editable={!busy}
          maxLength={500}
        />
        <ErrorBanner message={error} />
        <Button label={text.button} onPress={submit} loading={busy} />
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
  choiceSection: { gap: space.sm },
  choiceTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fieldError: { color: colors.danger, fontSize: 12 },
  success: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  successText: { color: colors.secondary, fontSize: 14, lineHeight: 22 },
});
