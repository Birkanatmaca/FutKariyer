import { useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';

const text = copy.login;

// Shown once, right after the authenticator is set up.
export function RecoveryCodesScreen({
  codes,
  onDone,
}: {
  codes: string[];
  onDone(): void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <main className="startup">
      <div className="login-card recovery-card">
        <Brand />
        <h2>{text.recoveryTitle}</h2>
        <p className="muted">{text.recoveryHint}</p>
        <ol className="recovery-codes">
          {codes.map(code => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ol>
        <div className="totp-actions">
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard
                ?.writeText(codes.join('\n'))
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? text.copied : text.recoveryCopy}
          </Button>
          <Button onClick={onDone}>{text.recoveryDone}</Button>
        </div>
      </div>
    </main>
  );
}
