import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { KeyRound, Trash } from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { Button } from '../../../../shared/ui/Button';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { Screen } from '../../../../shared/ui/Screen';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage, useResource } from '../../application/hooks';
import type { FieldErrors } from '../../application/validation';
import type {
  AccountForm,
  AccountSection,
  CreatableRole,
  FootballType,
  ManagedAccount,
} from '../../domain/models';
import {
  Card,
  Choices,
  LoadState,
  SectionTitle,
  SmallButton,
  SuccessNotice,
  ToggleRow,
  adminStyles,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';
import { AccountProActions } from './AccountProActions';

const text = copy.admin.editor;
const blank = (section: AccountSection): AccountForm => ({
  fullName: '',
  email: '',
  username: '',
  footballType: 'unknown',
  district: '',
  description: '',
  venueName: '',
  venueAddress: '',
  trainingGroundName: '',
  trainingGroundAddress: '',
  trainingSchedule: '',
  password: '',
  role: section === 'clubs' ? 'club' : 'player',
  active: true,
  verified: false,
});
function toForm(account: ManagedAccount): AccountForm {
  return {
    ...account,
    footballType: account.footballType || 'unknown',
    role: account.role as CreatableRole,
    password: '',
  };
}

export function AccountEditorScreen({
  services,
  section,
  id,
  onBack,
  onDone,
}: {
  services: AdminServices;
  section: AccountSection;
  id?: string;
  onBack(): void;
  onDone(message: string): void;
}) {
  const load = useCallback(async () => {
    if (!id) return null;
    const account = await services.accounts.get(section, id);
    if (account.role === 'admin') throw new Error(text.protected);
    return account;
  }, [services, section, id]);
  const existing = useResource(load);
  const title =
    section === 'clubs'
      ? id
        ? text.editClub
        : text.createClub
      : id
      ? text.editUser
      : text.createUser;
  return (
    <Screen>
      <BackLink label={copy.admin.common.back} onPress={onBack} />
      <PageHeader eyebrow={text.eyebrow} title={title} />
      {id && (existing.loading || existing.error || !existing.data) ? (
        <LoadState
          loading={existing.loading}
          error={existing.error}
          onRetry={existing.retry}
        />
      ) : (
        <AccountFormView
          services={services}
          section={section}
          account={existing.data}
          onDone={onDone}
        />
      )}
    </Screen>
  );
}

function AccountFormView({
  services,
  section,
  account,
  onDone,
}: {
  services: AdminServices;
  section: AccountSection;
  account: ManagedAccount | null;
  onDone(message: string): void;
}) {
  const editing = !!account;
  const [form, setForm] = useState<AccountForm>(() =>
    account ? toForm(account) : blank(section),
  );
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const busy = saving || actionBusy;
  useEffect(() => {
    if (account) setForm(toForm(account));
  }, [account]);
  const club = section === 'clubs';
  const organizer = !club && form.role === 'organizer';
  const usesUsername = club || organizer;
  function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function save() {
    if (busy) return;
    // Turning access off ends the account's sessions; confirm it first.
    if (
      account?.active &&
      !form.active &&
      !(await confirm(
        text.stopAccessTitle,
        text.stopAccessBody,
        text.stopAccess,
      ))
    )
      return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    setFields({});
    try {
      await services.accounts.save(section, form, account?.id);
      onDone(editing ? copy.admin.accounts.saved : copy.admin.accounts.created);
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }
  const field = (
    key: keyof AccountForm,
    label: string,
    max: number,
    extra: Partial<React.ComponentProps<typeof Field>> = {},
  ) => (
    <Field
      label={label}
      value={String(form[key])}
      onChangeText={value => update(key, value as never)}
      error={fields[key]}
      maxLength={max}
      editable={!busy}
      {...extra}
    />
  );
  return (
    <>
      <View style={adminStyles.form}>
        {!club && !editing ? (
          <Choices<CreatableRole>
            label={text.accountType}
            value={form.role}
            onChange={value => update('role', value)}
            error={fields.role}
            disabled={busy}
            options={(['player', 'coach', 'organizer'] as const).map(role => ({
              value: role,
              label: copy.admin.roles[role],
            }))}
          />
        ) : null}
        {field('fullName', club ? text.clubName : text.fullName, 80)}
        {usesUsername
          ? field('username', text.username, 32, {
              hint: text.usernameHelp,
              autoCapitalize: 'none',
              autoCorrect: false,
            })
          : null}
        {field('email', usesUsername ? text.optionalEmail : text.email, 254, {
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          autoCorrect: false,
        })}
        {club ? (
          <>
            <Choices<FootballType>
              label={text.footballType}
              value={form.footballType}
              onChange={value => update('footballType', value)}
              error={fields.footballType}
              disabled={busy}
              options={(['amateur', 'professional', 'halisaha'] as const).map(
                value => ({ value, label: copy.admin.footballTypes[value] }),
              )}
            />
            <Text style={adminStyles.rowMeta}>{text.clubPublicInfo}</Text>
            {field('district', text.district, 80)}
            {field('description', text.description, 1000, { multiline: true })}
            {field('venueName', text.venueName, 120)}
            {field('venueAddress', text.venueAddress, 240)}
            {field('trainingGroundName', text.trainingGroundName, 120)}
            {field('trainingGroundAddress', text.trainingGroundAddress, 240)}
            {field('trainingSchedule', text.trainingSchedule, 240)}
          </>
        ) : null}
        {!editing ? (
          <>
            <Field
              label={text.password}
              value={form.password}
              onChangeText={value => update('password', value)}
              error={fields.password}
              hint={text.passwordHelp}
              password
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!busy}
            />
            {club ? (
              <Text style={adminStyles.rowMeta}>{text.credentialsHelp}</Text>
            ) : null}
            {organizer ? (
              <Text style={adminStyles.rowMeta}>
                {text.organizerVerificationHelp}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <ToggleRow
              label={text.access}
              hint={text.accessHelp}
              value={form.active}
              onChange={value => update('active', value)}
              error={fields.active}
              disabled={busy}
            />
            {['club', 'coach', 'organizer'].includes(form.role) ? (
              <ToggleRow
                label={text.verified}
                hint={
                  form.role === 'organizer'
                    ? text.organizerVerificationHelp
                    : text.verificationHelp
                }
                value={form.verified}
                onChange={value => update('verified', value)}
                error={fields.verified}
                disabled={busy}
              />
            ) : null}
          </>
        )}
        <ErrorBanner message={error} />
        <Button
          label={editing ? text.save : text.create}
          onPress={save}
          loading={saving}
          disabled={actionBusy}
        />
      </View>
      {account && ['player', 'club', 'coach'].includes(account.role) ? (
        <AccountProActions
          services={services}
          accountId={account.id}
          disabled={busy}
          onBusy={setActionBusy}
        />
      ) : null}
      {account ? (
        <SecurityActions
          services={services}
          section={section}
          account={account}
          disabled={busy}
          onBusy={setActionBusy}
          onDeleted={() => onDone(copy.admin.accounts.deleted)}
        />
      ) : null}
    </>
  );
}

function SecurityActions({
  services,
  section,
  account,
  disabled,
  onBusy,
  onDeleted,
}: {
  services: AdminServices;
  section: AccountSection;
  account: ManagedAccount;
  disabled: boolean;
  onBusy(value: boolean): void;
  onDeleted(): void;
}) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<'reset' | 'delete' | null>(null);
  async function run(next: 'reset' | 'delete') {
    if (disabled || action) return;
    setError(null);
    setNotice(null);
    setPasswordError(undefined);
    if (next === 'reset' && password.length < 10) {
      setPasswordError(text.passwordShort);
      return;
    }
    const ok =
      next === 'reset'
        ? await confirm(
            text.resetConfirmTitle,
            text.resetConfirmBody,
            text.reset,
          )
        : await confirm(text.deleteTitle, text.deleteBody, text.deleteConfirm);
    if (!ok) return;
    Keyboard.dismiss();
    setAction(next);
    onBusy(true);
    try {
      if (next === 'reset') {
        await services.accounts.resetPassword(section, account.id, password);
        setPassword('');
        setNotice(text.resetDone);
      } else {
        await services.accounts.remove(section, account.id);
        onDeleted();
      }
    } catch (failure) {
      if (failure instanceof ApiError)
        setPasswordError(failure.fields.password);
      setError(errorMessage(failure));
    } finally {
      setAction(null);
      onBusy(false);
    }
  }
  return (
    <Card>
      <SectionTitle title={text.resetTitle} hint={text.resetHelp} />
      <Field
        label={text.newPassword}
        icon={KeyRound}
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        hint={copy.admin.editor.passwordHelp}
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!disabled}
      />
      <SmallButton
        label={text.reset}
        onPress={() => run('reset')}
        loading={action === 'reset'}
        disabled={disabled && action !== 'reset'}
      />
      <SuccessNotice message={notice} />
      <ErrorBanner message={error} />
      <SectionTitle title={text.dangerZone} hint={text.deleteBody} />
      <SmallButton
        label={text.delete}
        tone="danger"
        icon={Trash}
        onPress={() => run('delete')}
        loading={action === 'delete'}
        disabled={disabled && action !== 'delete'}
      />
    </Card>
  );
}
