import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import {
  auditFilters,
  auditPageSize,
  type AuditFilter,
  type AuditPage,
} from '../domain/models';
import {
  describeAction,
  type AuditService,
} from '../application/audit-service';

const text = copy.audit;

function formatDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

// İşlem geçmişi: read-only; rows cannot be edited or removed.
export function AuditPanel({ service }: { service: AuditService }) {
  const [filter, setFilter] = useState<AuditFilter>(''),
    [page, setPage] = useState(1),
    [data, setData] = useState<AuditPage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .list(page, filter)
      .then(value => current && setData(value))
      .catch(failure => {
        if (current) {
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
        }
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [service, page, filter, reload]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / auditPageSize))
    : 1;
  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <Button
          variant="secondary"
          busy={loading && data !== null}
          onClick={() => setReload(value => value + 1)}
        >
          {text.refresh}
        </Button>
      </header>

      <div className="application-tabs" role="tablist" aria-label={text.title}>
        {auditFilters.map(value => (
          <button
            key={value || 'all'}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className="application-tab"
            onClick={() => {
              setFilter(value);
              setPage(1);
            }}
          >
            {text.filters[value || 'all']}
          </button>
        ))}
      </div>

      <section className="list-panel">
        <Feedback message={error} />
        {data === null && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : data && data.items.length ? (
          <>
            <div className="table-scroll">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>{text.when}</th>
                    <th>{text.who}</th>
                    <th>{text.what}</th>
                    <th>{text.record}</th>
                    <th>{text.ip}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(entry => (
                    <tr key={entry.id}>
                      <td>
                        <time dateTime={entry.at}>{formatDate(entry.at)}</time>
                      </td>
                      <td>
                        <strong>
                          {entry.actorType === 'system'
                            ? text.system
                            : entry.actorName || text.deleted}
                        </strong>
                        <span className="hint">
                          {text.actorTypes[entry.actorType]}
                          {entry.delegatedBy ? ' · ' + text.delegated : ''}
                        </span>
                      </td>
                      <td>{describeAction(entry)}</td>
                      <td>
                        <code>{entry.targetId || '—'}</code>
                      </td>
                      <td>{entry.ip || '—'}</td>
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
    </main>
  );
}
