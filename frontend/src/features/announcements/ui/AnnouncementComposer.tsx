import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { Modal } from '../../../shared/ui/Modal';
import { PhoneFrame } from '../../../shared/ui/kit';
import {
  announcementLimits,
  normalizeAnnouncementDraft,
  validateAnnouncementDraft,
  type AnnouncementService,
} from '../application/announcements-service';
import type { AnnouncementAudience, AnnouncementDraft } from '../domain/models';

const text = copy.announcements;
export const audiences: AnnouncementAudience[] = [
  'all',
  'player',
  'club',
  'coach',
  'account',
];

// How the announcement shows in the app's Bildirimler list.
export function NotificationPhone({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <PhoneFrame caption={text.previewCaption}>
      <div className="an-phone-head">
        <strong>{text.notifications}</strong>
      </div>
      <div className="an-note an-note-new">
        <span className="an-note-icon" aria-hidden="true">
          ★
        </span>
        <span className="an-note-text">
          <strong>{title || text.previewTitle}</strong>
          <span>{body || text.previewBody}</span>
          <em>{copy.kit.justNow}</em>
        </span>
        <i className="an-dot" aria-hidden="true" />
      </div>
      <div className="an-note" aria-hidden="true">
        <span className="an-note-icon">•</span>
        <span className="an-note-text">
          <span className="ct-skeleton" style={{ height: 10, width: '70%' }} />
          <span className="ct-skeleton" style={{ height: 8, width: '90%' }} />
        </span>
      </div>
      <div className="an-note" aria-hidden="true">
        <span className="an-note-icon">•</span>
        <span className="an-note-text">
          <span className="ct-skeleton" style={{ height: 10, width: '60%' }} />
          <span className="ct-skeleton" style={{ height: 8, width: '80%' }} />
        </span>
      </div>
    </PhoneFrame>
  );
}

export function AnnouncementComposer({
  service,
  onClose,
  onSent,
}: {
  service: AnnouncementService;
  onClose(): void;
  onSent(recipients: number): void;
}) {
  const [form, setForm] = useState<AnnouncementDraft>({
    title: '',
    body: '',
    audience: 'all',
    email: '',
  });
  const [step, setStep] = useState<'write' | 'confirm'>('write');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const change = (patch: Partial<AnnouncementDraft>) =>
    setForm(current => ({ ...current, ...patch }));

  function review(event: FormEvent) {
    event.preventDefault();
    const problems = validateAnnouncementDraft(
      normalizeAnnouncementDraft(form),
    );
    setFields(problems);
    setError(null);
    if (!Object.keys(problems).length) setStep('confirm');
  }

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await service.create(form);
      onSent(created.recipients);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.sendError);
      if (failure instanceof ApiError) {
        setFields(failure.fields);
        setStep('write');
      }
    } finally {
      setBusy(false);
    }
  }

  const target =
    form.audience === 'account'
      ? text.toAccount(form.email.trim())
      : text.audiences[form.audience];

  return (
    <Modal
      title={step === 'write' ? text.formTitle : text.confirmTitle}
      eyebrow={text.eyebrow}
      size="xl"
      busy={busy}
      onClose={onClose}
      footer={
        step === 'write' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              {copy.form.cancel}
            </Button>
            <Button type="submit" form="announcement-form">
              {text.next}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setStep('write')}
            >
              {text.back}
            </Button>
            <Button busy={busy} onClick={send}>
              {text.submit}
            </Button>
          </>
        )
      }
    >
      <div className="ct-editor">
        {step === 'write' ? (
          <form
            id="announcement-form"
            className="kit-form"
            onSubmit={review}
            noValidate
          >
            <Field
              label={text.announcementTitle}
              value={form.title}
              required
              minLength={announcementLimits.titleMin}
              maxLength={announcementLimits.titleMax}
              error={fields.title}
              onChange={event => change({ title: event.target.value })}
            />
            <div className="field">
              <label htmlFor="announcement-body">{text.body}</label>
              <textarea
                id="announcement-body"
                rows={5}
                maxLength={announcementLimits.bodyMax}
                value={form.body}
                onChange={event => change({ body: event.target.value })}
              />
              <p className={fields.body ? 'field-error' : 'hint'}>
                {fields.body ||
                  text.counter(form.body.length, announcementLimits.bodyMax)}
              </p>
            </div>
            <span className="field-label">{text.audience}</span>
            <div className="an-audiences" role="radiogroup">
              {audiences.map(value => (
                <button
                  type="button"
                  role="radio"
                  key={value}
                  aria-checked={form.audience === value}
                  className="an-audience"
                  onClick={() => change({ audience: value })}
                >
                  <strong>{text.audiences[value]}</strong>
                  <span className="muted">{text.audienceHints[value]}</span>
                </button>
              ))}
            </div>
            {form.audience === 'account' && (
              <Field
                label={text.email}
                type="email"
                value={form.email}
                required
                maxLength={announcementLimits.emailMax}
                autoComplete="off"
                error={fields.email}
                onChange={event => change({ email: event.target.value })}
              />
            )}
            <Feedback message={error} />
          </form>
        ) : (
          <div className="kit-form">
            <dl className="kit-details">
              <div>
                <dt>{text.audience}</dt>
                <dd>{target}</dd>
              </div>
              <div>
                <dt>{text.announcementTitle}</dt>
                <dd>{form.title.trim()}</dd>
              </div>
            </dl>
            <div className="kit-note">
              <span className="kit-form-title">{text.body}</span>
              <p>{form.body.trim()}</p>
            </div>
            <p className="notice">{text.confirmHint}</p>
            <Feedback message={error} />
          </div>
        )}
        <aside className="ct-preview">
          <div className="ct-preview-head">
            <span className="kit-form-title">{copy.content.preview}</span>
          </div>
          <NotificationPhone
            title={form.title.trim()}
            body={form.body.trim()}
          />
        </aside>
      </div>
    </Modal>
  );
}
