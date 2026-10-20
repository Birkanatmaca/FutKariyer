import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import {
  logKinds,
  logPageSize,
  logWindows,
  type LogEntry,
  type LogKind,
  type LogPage,
  type LogSummary,
  type LogWindow,
} from '../domain/models';
import {
  formatTime,
  formatUptime,
  type LogsService,
} from '../application/logs-service';
import { LogDetail } from './LogDetail';
import { LogSettingsCard } from './LogSettingsCard';

const text = copy.logs;

function message(failure: unknown) {
  return failure instanceof Error ? failure.message : copy.form.unexpected;
}

// Sistem logları (20 Oct 2026): summary for a time window, the kept lines
// with quick filters and search (support codes included), line details and
// the log settings.
export function LogsPanel({ service }: { service: LogsService }) {
  const [hours, setHours] = useState<LogWindow>(24),
    [kind, setKind] = useState<LogKind>(''),
    [searchDraft, setSearchDraft] = useState(''),
    [search, setSearch] = useState(''),
    [userDraft, setUserDraft] = useState(''),
    [userId, setUserId] = useState(''),
    [page, setPage] = useState(1),
    [data, setData] = useState<LogPage | null>(null),
    [summary, setSummary] = useState<LogSummary | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [reload, setReload] = useState(0),
    [auto, setAuto] = useState(false),
    [selected, setSelected] = useState<LogEntry | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    Promise.all([
      service.list({ kind, search, userId, hours, page }),
      service.summary(hours),
    ])
      .then(([list, top]) => {
        if (!current) return;
        setData(list);
        setSummary(top);
        setError(null);
      })
      .catch(failure => current && setError(message(failure)))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [service, kind, search, userId, hours, page, reload]);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(
      () => setReload(value => value + 1),
      10000,
    );
    return () => window.clearInterval(timer);
  }, [auto]);

  const filterBy = useCallback((next: { search?: string; userId?: string }) => {
    if (next.search !== undefined) {
      setSearchDraft(next.search);
      setSearch(next.search);
    }
    if (next.userId !== undefined) {
      setUserDraft(next.userId);
      setUserId(next.userId);
    }
    setKind('');
    setPage(1);
    setSelected(null);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setUserId(userDraft.trim());
    setPage(1);
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(Math.min(data.total, 10000) / logPageSize))
    : 1;
  const peak = summary
    ? Math.max(1, ...summary.timeline.map(b => b.errors + b.warnings))
    : 1;

  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <div className="action-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={auto}
              onChange={event => setAuto(event.target.checked)}
            />
            {text.autoRefresh}
          </label>
          <Button
            variant="secondary"
            busy={loading && data !== null}
            onClick={() => setReload(value => value + 1)}
          >
            {text.refresh}
          </Button>
        </div>
      </header>

      <div className="application-tabs" role="tablist" aria-label={text.title}>
        {logWindows.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={hours === value}
            className="application-tab"
            onClick={() => {
              setHours(value);
              setPage(1);
            }}
          >
            {text.windows[value]}
          </button>
        ))}
      </div>

      <Feedback message={error} />

      {summary && (
        <section className="logs-summary" aria-label={text.title}>
          <div className="logs-cards">
            {(
              [
                ['errors', summary.errors, 'errors'],
                ['warnings', summary.warnings, 'warnings'],
                ['security', summary.security, 'security'],
                ['clientErrors', summary.clientErrors, 'client'],
                ['slow', summary.slow, 'slow'],
              ] as const
            ).map(([key, value, target]) => (
              <button
                key={key}
                type="button"
                className={
                  'logs-card' +
                  (key === 'errors' && value > 0 ? ' logs-card-alert' : '')
                }
                aria-pressed={kind === target}
                onClick={() => {
                  setKind(target);
                  setPage(1);
                }}
              >
                <strong>{value.toLocaleString('tr-TR')}</strong>
                <span>{text.cards[key]}</span>
              </button>
            ))}
          </div>
          <dl className="logs-live">
            <div>
              <dt>{text.live.version}</dt>
              <dd>{summary.live.version || '—'}</dd>
            </div>
            <div>
              <dt>{text.live.uptime}</dt>
              <dd>{formatUptime(summary.live.uptimeSeconds)}</dd>
            </div>
            <div>
              <dt>{text.live.requests}</dt>
              <dd>{summary.live.requests.toLocaleString('tr-TR')}</dd>
            </div>
            <div>
              <dt>{text.live.serverErrors}</dt>
              <dd>{summary.live.serverErrors.toLocaleString('tr-TR')}</dd>
            </div>
            <div>
              <dt>{text.live.level}</dt>
              <dd>{summary.live.level}</dd>
            </div>
            <div>
              <dt>{text.live.dropped}</dt>
              <dd>{summary.live.dropped}</dd>
            </div>
          </dl>
          <div className="logs-insights">
            <div className="logs-insight">
              <h2>{text.timeline}</h2>
              {summary.timeline.length ? (
                <div
                  className="logs-timeline"
                  role="img"
                  aria-label={text.timeline}
                >
                  {summary.timeline.map(bucket => (
                    <span
                      key={bucket.at}
                      className="logs-bar"
                      title={
                        formatTime(bucket.at) +
                        ' · ' +
                        bucket.errors +
                        ' ' +
                        text.cards.errors +
                        ', ' +
                        bucket.warnings +
                        ' ' +
                        text.cards.warnings
                      }
                    >
                      <span
                        className="logs-bar-warn"
                        style={{ height: (bucket.warnings / peak) * 100 + '%' }}
                      />
                      <span
                        className="logs-bar-error"
                        style={{ height: (bucket.errors / peak) * 100 + '%' }}
                      />
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">{text.timelineEmpty}</p>
              )}
            </div>
            <div className="logs-insight">
              <h2>{text.topEvents}</h2>
              <ul className="logs-ranking">
                {summary.topEvents.map(item => (
                  <li key={item.event}>
                    <button
                      type="button"
                      onClick={() => filterBy({ search: item.event })}
                    >
                      <code>{item.event}</code>
                      <span>{text.times(item.count)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="logs-insight">
              <h2>{text.slowRoutes}</h2>
              <ul className="logs-ranking">
                {summary.slowRoutes.map(item => (
                  <li key={item.route}>
                    <button
                      type="button"
                      onClick={() => filterBy({ search: item.route })}
                    >
                      <code>{item.route}</code>
                      <span>
                        {text.times(item.count)} · {text.maxMs(item.maxMs)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <form className="logs-filters" onSubmit={submit}>
        <label className="field">
          <span>{text.search}</span>
          <input
            type="search"
            value={searchDraft}
            maxLength={120}
            placeholder={text.searchPlaceholder}
            onChange={event => setSearchDraft(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{text.user}</span>
          <input
            type="search"
            value={userDraft}
            maxLength={64}
            onChange={event => setUserDraft(event.target.value)}
          />
        </label>
        <div className="action-row">
          <Button type="submit" variant="secondary">
            {text.apply}
          </Button>
          {(search || userId) && (
            <Button
              variant="secondary"
              onClick={() => filterBy({ search: '', userId: '' })}
            >
              {text.clear}
            </Button>
          )}
        </div>
      </form>

      <div className="application-tabs" role="tablist" aria-label={text.event}>
        {logKinds.map(value => (
          <button
            key={value || 'all'}
            type="button"
            role="tab"
            aria-selected={kind === value}
            className="application-tab"
            onClick={() => {
              setKind(value);
              setPage(1);
            }}
          >
            {text.kinds[value || 'all']}
          </button>
        ))}
      </div>

      <section className="list-panel">
        {data === null && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : data && data.items.length ? (
          <>
            <div className="table-scroll">
              <table className="audit-table logs-table">
                <thead>
                  <tr>
                    <th>{text.when}</th>
                    <th>{text.level}</th>
                    <th>{text.event}</th>
                    <th>{text.request}</th>
                    <th>{text.account}</th>
                    <th>{text.message}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(entry => (
                    <tr
                      key={entry.id}
                      tabIndex={0}
                      className="logs-row"
                      onClick={() => setSelected(entry)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') setSelected(entry);
                      }}
                    >
                      <td>
                        <time dateTime={entry.at}>{formatTime(entry.at)}</time>
                      </td>
                      <td>
                        <span className={'status-badge level-' + entry.level}>
                          {text.levels[entry.level] ?? entry.level}
                        </span>
                        {entry.security && (
                          <span className="status-badge level-security">
                            {text.securityBadge}
                          </span>
                        )}
                      </td>
                      <td>
                        <code>{entry.event}</code>
                      </td>
                      <td>
                        {entry.route ? (
                          <>
                            <strong>
                              {entry.method} {entry.route}
                            </strong>
                            <span className="hint">
                              {entry.status ? entry.status + ' · ' : ''}
                              {entry.durationMs ? entry.durationMs + ' ms' : ''}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <code>{entry.userId || '—'}</code>
                      </td>
                      <td className="logs-message">{entry.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <footer className="pagination">
                <span>{copy.panel.page(page, totalPages)}</span>
                <div className="action-row">
                  <Button
                    variant="secondary"
                    className="button-small"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(value => value - 1)}
                  >
                    {copy.panel.previous}
                  </Button>
                  <Button
                    variant="secondary"
                    className="button-small"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage(value => value + 1)}
                  >
                    {copy.panel.next}
                  </Button>
                </div>
              </footer>
            )}
          </>
        ) : data ? (
          <div className="empty">
            <h2>{text.empty}</h2>
          </div>
        ) : null}
      </section>

      <LogSettingsCard
        service={service}
        onSaved={() => setReload(v => v + 1)}
      />

      {selected && (
        <LogDetail
          entry={selected}
          onClose={() => setSelected(null)}
          onSameRequest={
            // An app's error report points at the request that failed.
            typeof selected.attrs.failed_request_id === 'string'
              ? () =>
                  filterBy({ search: String(selected.attrs.failed_request_id) })
              : selected.requestId
              ? () => filterBy({ search: selected.requestId })
              : undefined
          }
          onSameUser={
            selected.userId
              ? () => filterBy({ search: '', userId: selected.userId })
              : undefined
          }
        />
      )}
    </main>
  );
}
