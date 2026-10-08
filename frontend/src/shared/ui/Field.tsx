import { useId, useState, type InputHTMLAttributes } from 'react';
import { copy } from '../lib/copy';
export function Field({
  label,
  error,
  hint,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          {...props}
          id={id}
          type={type === 'password' && visible ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={error || hint ? id + '-hint' : undefined}
        />
        {type === 'password' && (
          <button
            type="button"
            className="password-toggle"
            disabled={props.disabled}
            aria-label={
              visible ? copy.form.hidePassword : copy.form.showPassword
            }
            onClick={() => setVisible(value => !value)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {visible && <path d="M3 3 21 21" />}
            </svg>
          </button>
        )}
      </div>
      {(error || hint) && (
        <p
          id={id + '-hint'}
          className={error ? 'field-error' : 'hint'}
          role={error ? 'alert' : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
