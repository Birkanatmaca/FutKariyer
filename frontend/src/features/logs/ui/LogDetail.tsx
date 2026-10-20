import { useEffect } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import type { LogEntry } from '../domain/models';
import { formatTime } from '../application/logs-service';

const text = copy.logs;

// One line with every field, and shortcuts to the request's and the
// account's other lines.
export function LogDetail({
  entry,
  onClose,
  onSameRequest,
  onSameUser,
}: {
  entry: LogEntry;
  onClose(): void;
  onSameRequest?: () => void;
  onSameUser?: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  const rows: [string, string][] = [
    [text.fields.requestId, entry.requestId],
    [text.fields.route, entry.route ? entry.method + ' ' + entry.route : ''],
    [text.fields.status, entry.status ? String(entry.status) : ''],
    [text.fields.duration, entry.durationMs ? entry.durationMs + ' ms' : ''],
    [
      text.fields.user,
      entry.userId
        ? entry.userId + (entry.accountType ? ' · ' + entry.accountType : '')
        : '',
    ],
    [text.fields.ip, entry.ip],
    [text.fields.client, entry.client],
    [text.fields.appVersion, entry.appVersion],
    [text.fields.version, entry.version],
  ];
  return (
    <div className="logs-drawer-backdrop" onClick={onClose}>
      <aside
        className="logs-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={text.detailTitle}
        onClick={event => event.stopPropagation()}
      >
        <header className="logs-drawer-header">
          <div>
            <p className="eyebrow">
              {text.levels[entry.level] ?? entry.level}
              {entry.security ? ' · ' + text.securityBadge : ''}
            </p>
            <h2>
              <code>{entry.event}</code>
            </h2>
            <p className="muted">
              <time dateTime={entry.at}>{formatTime(entry.at)}</time>
            </p>
          </div>
          <Button
            variant="secondary"
            className="button-small"
            onClick={onClose}
          >
            {text.close}
          </Button>
        </header>
        {entry.message && <pre className="logs-pre">{entry.message}</pre>}
        <dl className="overview-details">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <code>{value}</code>
                </dd>
              </div>
            ))}
        </dl>
        {Object.keys(entry.attrs).length > 0 && (
          <>
            <h3>{text.fields.attrs}</h3>
            <pre className="logs-pre">
              {JSON.stringify(entry.attrs, null, 2)}
            </pre>
          </>
        )}
        <div className="action-row">
          {onSameRequest && (
            <Button variant="secondary" onClick={onSameRequest}>
              {text.sameRequest}
            </Button>
          )}
          {onSameUser && (
            <Button variant="secondary" onClick={onSameUser}>
              {text.sameUser}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
