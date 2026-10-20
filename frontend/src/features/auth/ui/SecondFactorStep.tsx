import { useState, type FormEvent } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
import type { TwoFactorChallenge } from '../domain/models';

const text = copy.login;

// The second sign-in step (20 Oct 2026). On the first sign-in the admin adds
// the key to an authenticator app; afterwards only the code is asked.
export function SecondFactorStep({
  challenge,
  onVerify,
  onBack,
}: {
  challenge: TwoFactorChallenge;
  onVerify(code: string): Promise<void>;
  onBack(): void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  const grouped = (challenge.secret ?? '').replace(/(.{4})/g, '$1 ').trim();
  return (
    <div className="form-stack">
      <h2>{challenge.setup ? text.setupTitle : text.twoFactorTitle}</h2>
      <p className="muted">
        {challenge.setup ? text.setupHint : text.twoFactorHint}
      </p>
      {challenge.setup && challenge.secret ? (
        <div className="totp-key">
          <span className="eyebrow">{text.setupKey}</span>
          <code>{grouped}</code>
          <div className="totp-actions">
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(challenge.secret ?? '')
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? text.copied : text.copyKey}
            </Button>
            {challenge.otpauthUri ? (
              <a className="text-link" href={challenge.otpauthUri}>
                {text.setupLink}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      <form onSubmit={submit} className="form-stack">
        <Field
          label={challenge.setup ? text.code : text.codeOrRecovery}
          value={code}
          onChange={event => setCode(event.target.value)}
          autoComplete="one-time-code"
          inputMode={challenge.setup ? 'numeric' : 'text'}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={challenge.setup ? 6 : 12}
          autoFocus
          required
          disabled={busy}
        />
        <Feedback message={error} />
        <Button type="submit" busy={busy}>
          {text.verify}
          <span aria-hidden="true">↗</span>
        </Button>
      </form>
      <button
        type="button"
        className="text-link"
        onClick={onBack}
        disabled={busy}
      >
        {text.back}
      </button>
    </div>
  );
}
