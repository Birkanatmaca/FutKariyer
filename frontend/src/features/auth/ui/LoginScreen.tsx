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
      <div className="pitch" aria-hidden="true">
        <div className="pitch-center" />
        <div className="pitch-box" />
      </div>
      <div className="login-card">
        <Brand stacked />
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
            <h1>{copy.login.formTitle}</h1>
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
                maxLength={254}
                autoFocus
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
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
