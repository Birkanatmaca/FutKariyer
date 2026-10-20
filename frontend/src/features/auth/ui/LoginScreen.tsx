import { useState, type FormEvent } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
import type { LoginInput, TwoFactorChallenge } from '../domain/models';
import { SecondFactorStep } from './SecondFactorStep';

export function LoginScreen({
  onLogin,
  serviceError,
  onRetry,
  challenge,
  onVerify,
  onCancelChallenge,
}: {
  onLogin(input: LoginInput): Promise<void>;
  serviceError: string | null;
  onRetry(): void;
  challenge: TwoFactorChallenge | null;
  onVerify(code: string): Promise<void>;
  onCancelChallenge(): void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onLogin({ identifier, password });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <p className="eyebrow">{copy.login.eyebrow}</p>
          <h1>{copy.login.title}</h1>
          <p className="lead">{copy.login.description}</p>
          <div className="login-tags">
            <span>{copy.login.users}</span>
            <span>{copy.login.clubs}</span>
          </div>
        </div>
        <div className="pitch" aria-hidden="true">
          <div className="pitch-center" />
          <div className="pitch-box" />
        </div>
        <p className="login-footer">
          <span className="status-dot" />
          {copy.login.access}
        </p>
      </section>
      <section className="login-form-area">
        <div className="login-form-card">
          <p className="eyebrow">{copy.brand}</p>
          {challenge ? (
            <SecondFactorStep
              key={challenge.challenge}
              challenge={challenge}
              onVerify={onVerify}
              onBack={() => {
                setPassword('');
                onCancelChallenge();
              }}
            />
          ) : (
            <>
              <h2>{copy.login.formTitle}</h2>
              <p className="muted">{copy.login.formDescription}</p>
              <Feedback message={serviceError} />
              {serviceError && (
                <Button variant="secondary" onClick={onRetry}>
                  {copy.form.retry}
                </Button>
              )}
              <form onSubmit={submit} className="form-stack">
                <Field
                  label={copy.login.username}
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={32}
                  required
                  disabled={busy}
                />
                <Field
                  label={copy.login.password}
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
                <Feedback message={error} />
                <Button type="submit" busy={busy}>
                  {copy.login.button}
                  <span aria-hidden="true">↗</span>
                </Button>
              </form>
              <p className="login-mobile-hint">{copy.login.mobileHint}</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
