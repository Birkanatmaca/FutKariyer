import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import type { GiftAudience, GiftKind } from '../domain/models';
import {
  giftLimits,
  normalizeGiftDraft,
  validateGiftDraft,
} from '../application/gifts-service';
import type { GiftService } from '../application/gifts-service';

// Heart gifts were retired with hearts (17 Oct 2026).
const kinds: GiftKind[] = ['application_right'];

type FormState = {
  kind: GiftKind;
  title: string;
  message: string;
  audience: GiftAudience;
  email: string;
  validityDays: string;
};

const initialForm: FormState = {
  kind: 'application_right',
  title: '',
  message: '',
  audience: 'all',
  email: '',
  validityDays: '30',
};

export function GiftForm({
  service,
  onSent,
}: {
  service: GiftService;
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
    const draft = normalizeGiftDraft({
      kind: form.kind,
      title: form.title,
      message: form.message,
      audience: form.audience,
      email: form.email,
      validityDays: Number(form.validityDays),
    });
    const problems = validateGiftDraft(draft);
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
        failure instanceof Error ? failure.message : copy.gifts.sendError,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="gift-form" onSubmit={submit} noValidate>
      <label className="field">
        <span>{copy.gifts.kind}</span>
        <select
          value={form.kind}
          disabled={busy}
          aria-invalid={!!fields.kind}
          onChange={event => change('kind', event.target.value as GiftKind)}
        >
          {kinds.map(value => (
            <option key={value} value={value}>
              {copy.gifts.kinds[value]}
            </option>
          ))}
        </select>
        {fields.kind && (
          <span className="field-error" role="alert">
            {fields.kind}
          </span>
        )}
        {form.kind === 'application_right' && (
          <span className="hint">{copy.gifts.applicationRightNote}</span>
        )}
      </label>

      <Field
        label={copy.gifts.giftTitle}
        value={form.title}
        required
        minLength={giftLimits.titleMin}
        maxLength={giftLimits.titleMax}
        disabled={busy}
        error={fields.title}
        onChange={event => change('title', event.target.value)}
      />

      <label className="field gift-wide">
        <span>{copy.gifts.message}</span>
        <textarea
          value={form.message}
          maxLength={giftLimits.messageMax}
          rows={3}
          disabled={busy}
          aria-invalid={!!fields.message}
          aria-describedby="gift-message-hint"
          onChange={event => change('message', event.target.value)}
        />
        <span className="gift-counter">
          {copy.gifts.counter(form.message.length, giftLimits.messageMax)}
        </span>
        <span
          id="gift-message-hint"
          className={fields.message ? 'field-error' : 'hint'}
          role={fields.message ? 'alert' : undefined}
        >
          {fields.message || copy.gifts.messageHint}
        </span>
      </label>

      <label className="field">
        <span>{copy.gifts.audience}</span>
        <select
          value={form.audience}
          disabled={busy}
          onChange={event =>
            change('audience', event.target.value as GiftAudience)
          }
        >
          <option value="all">{copy.gifts.audienceAll}</option>
          <option value="account">{copy.gifts.audienceAccount}</option>
        </select>
      </label>

      {form.audience === 'account' && (
        <Field
          label={copy.gifts.email}
          type="email"
          value={form.email}
          required
          maxLength={giftLimits.emailMax}
          autoComplete="off"
          disabled={busy}
          error={fields.email}
          onChange={event => change('email', event.target.value)}
        />
      )}

      <Field
        label={copy.gifts.validityDays}
        type="number"
        inputMode="numeric"
        min={giftLimits.validityMin}
        max={giftLimits.validityMax}
        step={1}
        value={form.validityDays}
        required
        disabled={busy}
        error={fields.validityDays}
        onChange={event => change('validityDays', event.target.value)}
      />

      <div className="gift-actions gift-wide">
        <Feedback message={error} />
        <Button type="submit" busy={busy}>
          {copy.gifts.submit}
        </Button>
      </div>
    </form>
  );
}
