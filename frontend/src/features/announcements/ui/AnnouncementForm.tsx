import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import type { AnnouncementAudience } from '../domain/models';
import {
  announcementLimits,
  normalizeAnnouncementDraft,
  validateAnnouncementDraft,
} from '../application/announcements-service';
import type { AnnouncementService } from '../application/announcements-service';

const audiences: AnnouncementAudience[] = [
  'all',
  'player',
  'club',
  'coach',
  'account',
];

type FormState = {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  email: string;
};

const initialForm: FormState = {
  title: '',
  body: '',
  audience: 'all',
  email: '',
};

export function AnnouncementForm({
  service,
  onSent,
}: {
  service: AnnouncementService;
  onSent(recipients: number): void;
}) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const draft = normalizeAnnouncementDraft(form);
    const problems = validateAnnouncementDraft(draft);
    setError(null);
    setFields(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    try {
      const created = await service.create(draft);
      setForm(initialForm);
      setFields({});
      onSent(created.recipients);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : copy.announcements.sendError,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="gift-form" onSubmit={submit} noValidate>
      <Field
        label={copy.announcements.announcementTitle}
        value={form.title}
        required
        minLength={announcementLimits.titleMin}
        maxLength={announcementLimits.titleMax}
        disabled={busy}
        error={fields.title}
        onChange={event => change('title', event.target.value)}
      />

      <label className="field">
        <span>{copy.announcements.audience}</span>
        <select
          value={form.audience}
          disabled={busy}
          onChange={event =>
            change('audience', event.target.value as AnnouncementAudience)
          }
        >
          {audiences.map(value => (
            <option key={value} value={value}>
              {copy.announcements.audiences[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="field gift-wide">
        <span>{copy.announcements.body}</span>
        <textarea
          value={form.body}
          maxLength={announcementLimits.bodyMax}
          rows={4}
          required
          disabled={busy}
          aria-invalid={!!fields.body}
          aria-describedby="announcement-body-hint"
          onChange={event => change('body', event.target.value)}
        />
        <span className="gift-counter">
          {copy.announcements.counter(
            form.body.length,
            announcementLimits.bodyMax,
          )}
        </span>
        <span
          id="announcement-body-hint"
          className={fields.body ? 'field-error' : 'hint'}
          role={fields.body ? 'alert' : undefined}
        >
          {fields.body || copy.announcements.bodyHint}
        </span>
      </label>

      {form.audience === 'account' && (
        <Field
          label={copy.announcements.email}
          type="email"
          value={form.email}
          required
          maxLength={announcementLimits.emailMax}
          autoComplete="off"
          disabled={busy}
          error={fields.email}
          onChange={event => change('email', event.target.value)}
        />
      )}

      <div className="gift-actions gift-wide">
        <Feedback message={error} />
        <Button type="submit" busy={busy}>
          {copy.announcements.submit}
        </Button>
      </div>
    </form>
  );
}
