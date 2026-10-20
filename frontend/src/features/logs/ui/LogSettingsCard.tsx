import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import type { LogSettings } from '../domain/models';
import type { LogsService } from '../application/logs-service';
import { formatTime } from '../application/logs-service';

const text = copy.logs;
const levels: LogSettings['level'][] = ['debug', 'info', 'warn', 'error'];

// What the server writes and how long lines are kept.
export function LogSettingsCard({
  service,
  onSaved,
}: {
  service: LogsService;
  onSaved(): void;
}) {
  const [form, setForm] = useState<LogSettings | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    let current = true;
    service
      .settings()
      .then(value => current && setForm(value))
      .catch(
        failure =>
          current &&
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          ),
      );
    return () => {
      current = false;
    };
  }, [service]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setFields({});
    try {
      setForm(await service.saveSettings(form));
      setNotice(text.saved);
      onSaved();
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  const days =
    (key: 'requestDays' | 'problemDays' | 'securityDays') =>
    (event: { target: { value: string } }) =>
      form && setForm({ ...form, [key]: Number(event.target.value) || 0 });

  return (
    <section className="list-panel logs-settings">
      <header>
        <h2>{text.settingsTitle}</h2>
        <p className="muted">{text.settingsHint}</p>
      </header>
      {form ? (
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span>{text.levelLabel}</span>
            <select
              value={form.level}
              disabled={busy}
              onChange={event =>
                setForm({
                  ...form,
                  level: event.target.value as LogSettings['level'],
                })
              }
            >
              {levels.map(value => (
                <option key={value} value={value}>
                  {text.levelHints[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.storeRequests}
              disabled={busy}
              onChange={event =>
                setForm({ ...form, storeRequests: event.target.checked })
              }
            />
            {text.storeRequests}
          </label>
          <p className="hint">{text.storeRequestsHint}</p>
          <div className="logs-days">
            <Field
              label={text.requestDays}
              type="number"
              min={1}
              max={90}
              value={form.requestDays}
              error={fields.requestDays}
              disabled={busy}
              onChange={days('requestDays')}
            />
            <Field
              label={text.problemDays}
              type="number"
              min={7}
              max={365}
              value={form.problemDays}
              error={fields.problemDays}
              disabled={busy}
              onChange={days('problemDays')}
            />
            <Field
              label={text.securityDays}
              type="number"
              min={30}
              max={730}
              value={form.securityDays}
              error={fields.securityDays}
              disabled={busy}
              onChange={days('securityDays')}
            />
          </div>
          <Feedback message={error} />
          <Feedback message={notice} success />
          <div className="action-row">
            <Button type="submit" busy={busy}>
              {text.save}
            </Button>
            {form.updatedBy && (
              <span className="hint">
                {text.updated(formatTime(form.updatedAt))}
              </span>
            )}
          </div>
        </form>
      ) : (
        <Feedback message={error} />
      )}
    </section>
  );
}
