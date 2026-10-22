import { useState, type FormEvent } from 'react';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import type { OrganizerLoginInput } from '../domain/models';

const text = organizerCopy.login;

// Centred, minimal sign-in like the admin panel's, for organizer accounts.
export function OrganizerLoginScreen({
  onLogin,
  serviceError,
  notice,
  onRetry,
}: {
  onLogin(input: OrganizerLoginInput): Promise<void>;
  serviceError: string | null;
  notice: string | null;
  onRetry(): void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLogin({ identifier, password });
    } catch (failure) {
      setPassword('');
      setError(
        failure instanceof Error
          ? failure.message
          : organizerCopy.form.unexpected,
      );
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <div className="pitch" aria-hidden="true">
        <div className="pitch-center" />
        <div className="pitch-box" />
      </div>
      <div className="login-card">
        <Brand stacked />
        <h1>{text.title}</h1>
        <Feedback message={serviceError} />
        {serviceError && (
          <Button variant="secondary" onClick={onRetry}>
            {organizerCopy.form.retry}
          </Button>
        )}
        {notice && !error && <p className="notice org-notice">{notice}</p>}
        <form onSubmit={submit} className="form-stack">
          <Field
            label={text.identifier}
            value={identifier}
            onChange={event => setIdentifier(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            autoFocus
            required
            disabled={busy}
          />
          <Field
            label={text.password}
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={busy}
          />
          <Feedback message={error} />
          <Button type="submit" busy={busy}>
            {text.button}
          </Button>
        </form>
        <p className="hint org-login-hint">{text.hint}</p>
      </div>
    </main>
  );
}
