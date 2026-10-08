import { copy } from '../../../shared/lib/copy';
import { Field } from '../../../shared/ui/Field';
import type { AccountForm, AdminSection } from '../domain/models';
export function AccountFields({
  form,
  onChange,
  section,
  editing,
  busy,
  errors,
}: {
  form: AccountForm;
  onChange(value: AccountForm): void;
  section: AdminSection;
  editing: boolean;
  busy: boolean;
  errors: Record<string, string>;
}) {
  const club = section === 'clubs';
  function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    onChange({ ...form, [key]: value });
  }
  return (
    <>
      {!club && !editing && (
        <div className="field">
          <label htmlFor="new-account-role">{copy.editor.accountType}</label>
          <select
            id="new-account-role"
            value={form.role}
            disabled={busy}
            onChange={event =>
              update('role', event.target.value as 'player' | 'coach')
            }
          >
            <option value="player">{copy.roles.player}</option>
            <option value="coach">{copy.roles.coach}</option>
          </select>
          {errors.role && (
            <p className="field-error" role="alert">
              {errors.role}
            </p>
          )}
        </div>
      )}
      <Field
        label={club ? copy.editor.clubName : copy.form.fullName}
        value={form.fullName}
        onChange={event => update('fullName', event.target.value)}
        required
        minLength={2}
        maxLength={80}
        disabled={busy}
        error={errors.fullName}
      />
      {club && (
        <Field
          label={copy.editor.username}
          value={form.username}
          onChange={event => update('username', event.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={32}
          disabled={busy}
          error={errors.username}
          hint={copy.editor.usernameHelp}
        />
      )}
      <Field
        label={club ? copy.editor.optionalEmail : copy.form.email}
        type="email"
        value={form.email}
        onChange={event => update('email', event.target.value)}
        required={!club}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        disabled={busy}
        error={errors.email}
      />
      {club && (
        <Field
          label={copy.editor.district}
          value={form.district}
          onChange={event => update('district', event.target.value)}
          maxLength={80}
          disabled={busy}
          error={errors.district}
        />
      )}
      {!editing && (
        <>
          <Field
            label={copy.form.password}
            type="password"
            value={form.password}
            onChange={event => update('password', event.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
            disabled={busy}
            error={errors.password}
            hint={copy.form.passwordHelp}
          />
          {club && <p className="notice">{copy.editor.credentialsHelp}</p>}
        </>
      )}
      {editing && (
        <div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.active}
              onChange={event => update('active', event.target.checked)}
              disabled={busy}
            />
            <span>{copy.editor.access}</span>
          </label>
          <p className="hint">{copy.editor.accessHelp}</p>
          {errors.active && (
            <p className="field-error" role="alert">
              {errors.active}
            </p>
          )}
        </div>
      )}
    </>
  );
}
