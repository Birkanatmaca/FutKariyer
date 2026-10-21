import { copy } from '../../../shared/lib/copy';
import { Field } from '../../../shared/ui/Field';
import { ToggleRow } from '../../../shared/ui/kit';
import type { AccountForm, AdminSection } from '../domain/models';

// Edits an existing account; accounts are created by signing up in the app.
export function AccountFields({
  form,
  onChange,
  section,
  busy,
  errors,
}: {
  form: AccountForm;
  onChange(value: AccountForm): void;
  section: AdminSection;
  busy: boolean;
  errors: Record<string, string>;
}) {
  const club = section === 'clubs' || form.role === 'club';
  const organizer = form.role === 'organizer';
  const usesUsername = club || organizer;
  const verifiable =
    form.role === 'club' || form.role === 'coach' || form.role === 'organizer';
  function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    onChange({ ...form, [key]: value });
  }
  return (
    <div className="kit-form">
      <p className="kit-form-title">{copy.editor.identityTitle}</p>
      <div className="rt-form">
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
        {usesUsername && (
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
          label={usesUsername ? copy.editor.optionalEmail : copy.form.email}
          type="email"
          value={form.email}
          onChange={event => update('email', event.target.value)}
          required={!usesUsername}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          disabled={busy}
          error={errors.email}
        />
        {club && (
          <div className="field">
            <label htmlFor="club-football-type">
              {copy.editor.footballType}
            </label>
            <select
              id="club-football-type"
              value={form.footballType}
              disabled={busy}
              required
              onChange={event =>
                update(
                  'footballType',
                  event.target.value as AccountForm['footballType'],
                )
              }
            >
              <option value="unknown">{copy.editor.selectFootballType}</option>
              <option value="amateur">{copy.football.types.amateur}</option>
              <option value="professional">
                {copy.football.types.professional}
              </option>
              <option value="halisaha">{copy.football.types.halisaha}</option>
            </select>
            {errors.footballType && (
              <p className="field-error" role="alert">
                {errors.footballType}
              </p>
            )}
          </div>
        )}
      </div>
      {club && (
        <>
          <p className="kit-form-title">{copy.editor.clubPublicTitle}</p>
          <p className="hint">{copy.editor.clubPublicInfo}</p>
          <div className="rt-form">
            <Field
              label={copy.editor.district}
              value={form.district}
              onChange={event => update('district', event.target.value)}
              maxLength={80}
              disabled={busy}
              error={errors.district}
            />
            <Field
              label={copy.editor.trainingSchedule}
              value={form.trainingSchedule}
              onChange={event => update('trainingSchedule', event.target.value)}
              maxLength={240}
              disabled={busy}
              error={errors.trainingSchedule}
            />
            <div className="field rt-wide">
              <label htmlFor="club-description">
                {copy.editor.clubDescription}
              </label>
              <textarea
                id="club-description"
                value={form.description}
                maxLength={1000}
                rows={3}
                disabled={busy}
                onChange={event => update('description', event.target.value)}
              />
              {errors.description && (
                <p className="field-error" role="alert">
                  {errors.description}
                </p>
              )}
            </div>
            <Field
              label={copy.editor.venueName}
              value={form.venueName}
              onChange={event => update('venueName', event.target.value)}
              maxLength={120}
              disabled={busy}
              error={errors.venueName}
            />
            <Field
              label={copy.editor.venueAddress}
              value={form.venueAddress}
              onChange={event => update('venueAddress', event.target.value)}
              maxLength={240}
              disabled={busy}
              error={errors.venueAddress}
            />
            <Field
              label={copy.editor.trainingGroundName}
              value={form.trainingGroundName}
              onChange={event =>
                update('trainingGroundName', event.target.value)
              }
              maxLength={120}
              disabled={busy}
              error={errors.trainingGroundName}
            />
            <Field
              label={copy.editor.trainingGroundAddress}
              value={form.trainingGroundAddress}
              onChange={event =>
                update('trainingGroundAddress', event.target.value)
              }
              maxLength={240}
              disabled={busy}
              error={errors.trainingGroundAddress}
            />
          </div>
        </>
      )}
      <p className="kit-form-title">{copy.editor.accessTitle}</p>
      <ToggleRow
        label={copy.editor.access}
        hint={copy.editor.accessHelp}
        checked={form.active}
        onChange={value => update('active', value)}
        disabled={busy}
      />
      {errors.active && (
        <p className="field-error" role="alert">
          {errors.active}
        </p>
      )}
      {verifiable && (
        <ToggleRow
          label={copy.editor.verified}
          hint={
            organizer
              ? copy.editor.organizerVerificationHelp
              : copy.editor.verificationHelp
          }
          checked={form.verified}
          onChange={value => update('verified', value)}
          disabled={busy}
        />
      )}
      {errors.verified && (
        <p className="field-error" role="alert">
          {errors.verified}
        </p>
      )}
    </div>
  );
}
