import type { CSSProperties, ReactNode } from 'react';
import { copy } from '../lib/copy';

// Shared building blocks for the list pages (21 Oct 2026): stat cards above
// the list, filter tabs with counts, numbered pages and a phone frame for
// previews, so every section looks and behaves the same.

export type Tone = 'brand' | 'accent' | 'info' | 'warning' | 'danger' | 'muted';

export type Stat = {
  label: string;
  value: number | string;
  sub?: string;
  tone?: Tone;
  // An optional share bar under the value (0–1).
  share?: number;
};

export function StatCards({
  items,
  loading,
}: {
  items: Stat[];
  loading?: boolean;
}) {
  return (
    <div
      className="kit-stats"
      aria-busy={loading}
      style={
        {
          '--cols': items.length,
          '--cols-md': items.length <= 5 ? items.length : 3,
        } as CSSProperties
      }
    >
      {items.map(item => (
        <div
          className={'kit-stat tone-' + (item.tone || 'brand')}
          key={item.label}
        >
          <span className="kit-stat-label">{item.label}</span>
          <strong className="kit-stat-value">
            {loading
              ? '—'
              : typeof item.value === 'number'
              ? item.value.toLocaleString('tr-TR')
              : item.value}
          </strong>
          {item.share !== undefined && (
            <span className="kit-stat-bar" aria-hidden="true">
              <span
                style={{
                  width:
                    Math.round(Math.min(1, Math.max(0, item.share)) * 100) +
                    '%',
                }}
              />
            </span>
          )}
          {item.sub && <span className="kit-stat-sub">{item.sub}</span>}
        </div>
      ))}
    </div>
  );
}

export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange(value: T): void;
  disabled?: boolean;
}) {
  return (
    <div className="kit-tabs" role="tablist" aria-label={label}>
      {options.map(option => (
        <button
          type="button"
          role="tab"
          key={option.value}
          className="kit-tab"
          aria-selected={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="kit-tab-count">
              {option.count.toLocaleString('tr-TR')}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Page numbers with the first, last and two around the current one.
function pageNumbers(page: number, pages: number): (number | '…')[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const out: (number | '…')[] = [];
  let last = 0;
  for (let n = 1; n <= pages; n++) {
    if (!wanted.has(n)) continue;
    if (n - last > 1) out.push('…');
    out.push(n);
    last = n;
  }
  return out;
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage(page: number): void;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <footer className="kit-pager">
      <span className="muted">{copy.kit.range(from, to, total)}</span>
      {pages > 1 && (
        <nav className="kit-pages" aria-label={copy.kit.pages}>
          <button
            type="button"
            className="kit-page"
            disabled={disabled || page <= 1}
            aria-label={copy.panel.previous}
            onClick={() => onPage(page - 1)}
          >
            ‹
          </button>
          {pageNumbers(page, pages).map((n, index) =>
            n === '…' ? (
              <span className="kit-page-gap" key={'gap' + index}>
                …
              </span>
            ) : (
              <button
                type="button"
                key={n}
                className="kit-page"
                aria-current={n === page ? 'page' : undefined}
                disabled={disabled}
                onClick={() => onPage(n)}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            className="kit-page"
            disabled={disabled || page >= pages}
            aria-label={copy.panel.next}
            onClick={() => onPage(page + 1)}
          >
            ›
          </button>
        </nav>
      )}
    </footer>
  );
}

export function slice<T>(items: T[], page: number, pageSize: number) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function Pill({
  tone = 'muted',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={'kit-pill tone-' + tone}>{children}</span>;
}

// A phone outline for previews of how an item looks in the app.
export function PhoneFrame({
  children,
  caption,
}: {
  children: ReactNode;
  caption?: string;
}) {
  return (
    <figure className="kit-phone">
      <div className="kit-phone-screen">{children}</div>
      {caption && <figcaption className="muted">{caption}</figcaption>}
    </figure>
  );
}

export function Initials({ name }: { name: string }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.slice(0, 1).toLocaleUpperCase('tr-TR'))
    .join('');
  return (
    <span className="kit-avatar" aria-hidden="true">
      {letters || '?'}
    </span>
  );
}

export function shortDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function dateTime(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "3 gün önce" style age of a timestamp.
export function ago(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(value)) / 60000));
  if (minutes < 1) return copy.kit.justNow;
  if (minutes < 60) return copy.kit.minutesAgo(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return copy.kit.hoursAgo(hours);
  const days = Math.round(hours / 24);
  if (days < 31) return copy.kit.daysAgo(days);
  return shortDate(value);
}

// Converts between an ISO timestamp and the value of a datetime-local input.
export function toLocalInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
}
export function fromLocalInput(value: string) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export type WindowState = 'live' | 'scheduled' | 'expired';
export function windowState(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = Date.now(),
): WindowState {
  if (startsAt && Date.parse(startsAt) > now) return 'scheduled';
  if (endsAt && Date.parse(endsAt) <= now) return 'expired';
  return 'live';
}

// A labelled on/off switch row for forms.
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  return (
    <label className={'kit-toggle' + (checked ? ' kit-toggle-on' : '')}>
      <span className="kit-toggle-text">
        <strong>{label}</strong>
        {hint && <span className="muted">{hint}</span>}
      </span>
      <span className="rt-switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={event => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}
