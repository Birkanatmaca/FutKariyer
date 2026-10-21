import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
import { Modal } from '../../../shared/ui/Modal';
import type { League, LeagueForm, LeagueStatus } from '../domain/models';
import type { LeagueService } from '../application/league-service';

const empty: LeagueForm = {
  name: '',
  season: '',
  description: '',
  status: 'draft',
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
};
const statuses: LeagueStatus[] = ['draft', 'active', 'finished'];

// Create or edit a league in a modal.
export function LeagueEditor({
  league,
  service,
  onClose,
  onDone,
}: {
  league?: League;
  service: LeagueService;
  onClose(): void;
  onDone(): void;
}) {
  const [form, setForm] = useState<LeagueForm>(
    league
      ? {
          name: league.name,
          season: league.season,
          description: league.description,
          status: league.status,
          winPoints: league.winPoints,
          drawPoints: league.drawPoints,
          lossPoints: league.lossPoints,
        }
      : empty,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  function change<K extends keyof LeagueForm>(key: K, value: LeagueForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await service.save(form, league?.id);
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={league ? copy.leagues.edit : copy.leagues.create}
      eyebrow={copy.leagues.eyebrow}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {copy.form.cancel}
          </Button>
          <Button busy={busy} onClick={() => save()}>
            {copy.leagues.save}
          </Button>
        </>
      }
    >
      <form className="lg-form" onSubmit={save}>
        <Field
          label={copy.leagues.name}
          value={form.name}
          required
          autoFocus
          maxLength={120}
          disabled={busy}
          error={fields.name}
          onChange={event => change('name', event.target.value)}
        />
        <Field
          label={copy.leagues.season}
          value={form.season}
          required
          maxLength={40}
          disabled={busy}
          error={fields.season}
          placeholder="2026-2027"
          onChange={event => change('season', event.target.value)}
        />
        <label className="field lg-wide">
          <span>{copy.leagues.description}</span>
          <textarea
            value={form.description}
            maxLength={1000}
            rows={3}
            disabled={busy}
            onChange={event => change('description', event.target.value)}
            aria-invalid={!!fields.description}
          />
          {fields.description && (
            <span className="field-error" role="alert">
              {fields.description}
            </span>
          )}
        </label>
        <div className="field lg-wide">
          <span>{copy.leagues.status}</span>
          <div
            className="rt-segment"
            role="radiogroup"
            aria-label={copy.leagues.status}
          >
            {statuses.map(value => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.status === value}
                disabled={busy}
                onClick={() => change('status', value)}
              >
                {copy.leagues[value]}
              </button>
            ))}
          </div>
          <span className="hint">{copy.leagues.liveNote}</span>
        </div>
        <div className="lg-wide lg-points">
          <span className="rt-label">{copy.leagues.points}</span>
          <div className="lg-points-row">
            {(
              [
                ['winPoints', copy.leagues.winPoints],
                ['drawPoints', copy.leagues.drawPoints],
                ['lossPoints', copy.leagues.lossPoints],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min={0}
                max={10}
                required
                value={form[key]}
                disabled={busy}
                error={fields[key]}
                onChange={event => change(key, Number(event.target.value))}
              />
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
      <Feedback message={error} />
    </Modal>
  );
}
