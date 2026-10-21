import { useEffect, useRef, useState } from 'react';
import { copy } from '../lib/copy';
import { fromLocalInput, toLocalInput } from './kit';

// Image picking and publishing windows shared by news, ads and popups.
const text = copy.content;

function formatWhen(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "12 Eki 14:00 → 30 Eki 23:59", with open sides spelled out.
export function windowLabel(schedule: {
  startsAt: string | null;
  endsAt: string | null;
}) {
  if (!schedule.startsAt && !schedule.endsAt) return text.always;
  return (
    (schedule.startsAt ? formatWhen(schedule.startsAt) : text.now) +
    ' → ' +
    (schedule.endsAt ? formatWhen(schedule.endsAt) : text.noEnd)
  );
}

export function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function ImagePicker({
  label,
  hint,
  src,
  aspect,
  busy,
  error,
  onFile,
  onRemove,
}: {
  label: string;
  hint: string;
  src: string | null;
  aspect: string;
  busy: boolean;
  error?: string;
  onFile(file: File | null): void;
  onRemove?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="ct-picker">
        <button
          type="button"
          className="ct-picker-frame"
          style={{ aspectRatio: aspect }}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {src ? (
            <img src={src} alt="" />
          ) : (
            <span className="muted">{text.pickImage}</span>
          )}
        </button>
        <div className="ct-picker-side">
          <p className="hint">{hint}</p>
          <div className="kit-row-actions">
            <button
              type="button"
              className="kit-action"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {src ? text.replaceImage : text.pickImage}
            </button>
            {src && onRemove && (
              <button
                type="button"
                className="kit-action kit-action-danger"
                disabled={busy}
                onClick={() => {
                  if (input.current) input.current.value = '';
                  onRemove();
                }}
              >
                {text.removeImage}
              </button>
            )}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png"
          onChange={event => onFile(event.target.files?.[0] || null)}
        />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

// The publishing window: a start and an end, each optional.
export function WindowFields({
  value,
  onChange,
  busy,
  errors,
}: {
  value: { startsAt: string | null; endsAt: string | null };
  onChange(patch: { startsAt?: string | null; endsAt?: string | null }): void;
  busy: boolean;
  errors: Record<string, string>;
}) {
  const set = onChange;
  return (
    <div className="rt-form">
      <div className="field">
        <label htmlFor="ct-starts">{text.startsAt}</label>
        <input
          id="ct-starts"
          type="datetime-local"
          value={toLocalInput(value.startsAt)}
          disabled={busy}
          onChange={event =>
            set({ startsAt: fromLocalInput(event.target.value) })
          }
        />
        <div className="ct-chips">
          <button
            type="button"
            className="kit-tab"
            aria-pressed={!value.startsAt}
            disabled={busy}
            onClick={() => set({ startsAt: null })}
          >
            {text.now}
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="ct-ends">{text.endsAt}</label>
        <input
          id="ct-ends"
          type="datetime-local"
          value={toLocalInput(value.endsAt)}
          disabled={busy}
          onChange={event =>
            set({ endsAt: fromLocalInput(event.target.value) })
          }
        />
        <div className="ct-chips">
          <button
            type="button"
            className="kit-tab"
            aria-pressed={!value.endsAt}
            disabled={busy}
            onClick={() => set({ endsAt: null })}
          >
            {text.noEnd}
          </button>
          {[7, 30].map(days => (
            <button
              type="button"
              key={days}
              className="kit-tab"
              disabled={busy}
              onClick={() => set({ endsAt: addDays(days) })}
            >
              {text.plusDays(days)}
            </button>
          ))}
        </div>
        {errors.endsAt && (
          <p className="field-error" role="alert">
            {errors.endsAt}
          </p>
        )}
      </div>
    </div>
  );
}
