import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { Modal } from '../../../shared/ui/Modal';
import type {
  TeamType,
  TournamentForm,
  TournamentFormat,
} from '../domain/models';
import { checkTournament, today } from '../domain/rules';
import type { TournamentService } from '../application/tournament-service';

const text = organizerCopy.create;
const formats: TournamentFormat[] = [
  'halisaha',
  'seven_a_side',
  'eleven_a_side',
];
const teamTypes: TeamType[] = ['halisaha', 'amateur', 'professional'];

export function TournamentCreateModal({
  service,
  onClose,
  onDone,
}: {
  service: TournamentService;
  onClose(): void;
  onDone(notified: number): void;
}) {
  const [form, setForm] = useState<TournamentForm>({
    name: '',
    format: 'halisaha',
    eligibleTypes: ['halisaha'],
    district: '',
    venue: '',
    description: '',
    startsOn: '',
    endsOn: '',
    applicationDeadline: '',
    teamCapacity: 8,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const min = today();
  function change<K extends keyof TournamentForm>(
    key: K,
    value: TournamentForm[K],
  ) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function toggleType(type: TeamType) {
    change(
      'eligibleTypes',
      form.eligibleTypes.includes(type)
        ? form.eligibleTypes.filter(value => value !== type)
        : [...form.eligibleTypes, type],
    );
  }
  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const problems = checkTournament(form);
    const local: Record<string, string> = {};
    for (const [key, problem] of Object.entries(problems))
      if (problem) local[key] = text[problem];
    if (Object.keys(local).length) {
      setFields(local);
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const result = await service.create(form);
      onDone(result.notified);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : organizerCopy.form.unexpected,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={text.title}
      eyebrow={organizerCopy.shell.eyebrow}
      size="lg"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {organizerCopy.form.cancel}
          </Button>
          <Button busy={busy} onClick={() => save()}>
            {text.save}
          </Button>
        </>
      }
    >
      <form className="lg-form" onSubmit={save}>
        <div className="lg-wide">
          <Field
            label={text.name}
            value={form.name}
            required
            autoFocus
            minLength={2}
            maxLength={120}
            disabled={busy}
            error={fields.name}
            onChange={event => change('name', event.target.value)}
          />
        </div>
        <div className="field lg-wide">
          <span className="rt-label">{text.format}</span>
          <div
            className="rt-segment"
            role="radiogroup"
            aria-label={text.format}
          >
            {formats.map(value => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.format === value}
                disabled={busy}
                onClick={() => change('format', value)}
              >
                {organizerCopy.formats[value]}
              </button>
            ))}
          </div>
          {fields.format && (
            <span className="field-error" role="alert">
              {fields.format}
            </span>
          )}
        </div>
        <fieldset className="field lg-wide org-fieldset">
          <legend className="rt-label">{text.eligibleTypes}</legend>
          <div className="org-checks">
            {teamTypes.map(value => (
              <label key={value} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.eligibleTypes.includes(value)}
                  disabled={busy}
                  onChange={() => toggleType(value)}
                />
                {organizerCopy.teamTypes[value]}
              </label>
            ))}
          </div>
          {fields.eligibleTypes && (
            <span className="field-error" role="alert">
              {fields.eligibleTypes}
            </span>
          )}
        </fieldset>
        <Field
          label={text.district}
          value={form.district}
          maxLength={80}
          disabled={busy}
          error={fields.district}
          onChange={event => change('district', event.target.value)}
        />
        <Field
          label={text.venue}
          value={form.venue}
          maxLength={120}
          disabled={busy}
          error={fields.venue}
          onChange={event => change('venue', event.target.value)}
        />
        <Field
          label={text.startsOn}
          type="date"
          required
          min={min}
          value={form.startsOn}
          disabled={busy}
          error={fields.startsOn}
          onChange={event => change('startsOn', event.target.value)}
        />
        <Field
          label={text.endsOn}
          type="date"
          required
          min={form.startsOn || min}
          value={form.endsOn}
          disabled={busy}
          error={fields.endsOn}
          onChange={event => change('endsOn', event.target.value)}
        />
        <Field
          label={text.applicationDeadline}
          type="date"
          required
          min={min}
          max={form.startsOn || undefined}
          value={form.applicationDeadline}
          disabled={busy}
          error={fields.applicationDeadline}
          onChange={event => change('applicationDeadline', event.target.value)}
        />
        <Field
          label={text.teamCapacity}
          type="number"
          required
          min={2}
          max={128}
          value={Number.isFinite(form.teamCapacity) ? form.teamCapacity : ''}
          disabled={busy}
          error={fields.teamCapacity}
          hint={text.capacityHint}
          onChange={event => change('teamCapacity', Number(event.target.value))}
        />
        <label className="field lg-wide">
          <span>{text.description}</span>
          <textarea
            value={form.description}
            maxLength={2000}
            rows={3}
            disabled={busy}
            aria-invalid={!!fields.description}
            onChange={event => change('description', event.target.value)}
          />
          {fields.description && (
            <span className="field-error" role="alert">
              {fields.description}
            </span>
          )}
        </label>
        <button type="submit" hidden />
      </form>
      <Feedback message={error} />
    </Modal>
  );
}
