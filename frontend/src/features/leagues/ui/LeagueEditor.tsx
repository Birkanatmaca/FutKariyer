import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
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
  const dialog = useRef<HTMLDialogElement>(null);
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
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  function change<K extends keyof LeagueForm>(key: K, value: LeagueForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
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
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="league-editor-title"
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="editor-header">
        <div>
          <p className="eyebrow">{copy.leagues.eyebrow}</p>
          <h2 id="league-editor-title">
            {league ? copy.leagues.edit : copy.leagues.create}
          </h2>
        </div>
        <button
          className="icon-button"
          disabled={busy}
          onClick={onClose}
          aria-label={copy.form.close}
        >
          ×
        </button>
      </header>
      <div className="editor-body">
        <form className="form-stack" onSubmit={save}>
          <Field
            label={copy.leagues.name}
            value={form.name}
            required
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
            onChange={event => change('season', event.target.value)}
          />
          <label className="field">
            {copy.leagues.description}
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
          <label className="field">
            {copy.leagues.status}
            <select
              value={form.status}
              disabled={busy}
              onChange={event =>
                change('status', event.target.value as LeagueStatus)
              }
            >
              <option value="draft">{copy.leagues.draft}</option>
              <option value="active">{copy.leagues.active}</option>
              <option value="finished">{copy.leagues.finished}</option>
            </select>
          </label>
          <div className="league-editor-points">
            <strong>{copy.leagues.points}</strong>
            <Field
              label={copy.leagues.winPoints}
              type="number"
              min={0}
              max={10}
              required
              value={form.winPoints}
              disabled={busy}
              error={fields.winPoints}
              onChange={event =>
                change('winPoints', Number(event.target.value))
              }
            />
            <Field
              label={copy.leagues.drawPoints}
              type="number"
              min={0}
              max={10}
              required
              value={form.drawPoints}
              disabled={busy}
              error={fields.drawPoints}
              onChange={event =>
                change('drawPoints', Number(event.target.value))
              }
            />
            <Field
              label={copy.leagues.lossPoints}
              type="number"
              min={0}
              max={10}
              required
              value={form.lossPoints}
              disabled={busy}
              error={fields.lossPoints}
              onChange={event =>
                change('lossPoints', Number(event.target.value))
              }
            />
          </div>
          <p className="hint">{copy.leagues.liveNote}</p>
          <Feedback message={error} />
          <div className="action-row">
            <Button type="submit" busy={busy}>
              {copy.leagues.save}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {copy.form.cancel}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
