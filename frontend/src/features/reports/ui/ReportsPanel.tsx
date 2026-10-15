import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { ReportsService } from '../application/reports-service';
import {
  reportActions,
  type ContentReport,
  type ReportAction,
  type ReportPage,
  type ReportTab,
} from '../domain/models';

const text = copy.reports;
const tabs: ReportTab[] = ['open', 'resolved'];

function message(failure: unknown) {
  return failure instanceof Error ? failure.message : copy.form.unexpected;
}
function formatDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function ReportsPanel({
  service,
  onOpenCount,
}: {
  service: ReportsService;
  onOpenCount(count: number): void;
}) {
  const [tab, setTab] = useState<ReportTab>('open'),
    [page, setPage] = useState(1),
    [data, setData] = useState<ReportPage | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<string | null>(null),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState<string | null>(null),
    [confirming, setConfirming] = useState<{
      id: string;
      action: ReportAction;
    } | null>(null),
    [actionError, setActionError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    service
      .list(tab, page)
      .then(value => {
        if (!current) return;
        setData(value);
        if (tab === 'open') onOpenCount(value.total);
      })
      .catch(failure => {
        if (current) {
          setData(null);
          setLoadError(message(failure));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, tab, page, reload, onOpenCount]);

  function selectTab(next: ReportTab) {
    if (next === tab || busy) return;
    setData(null);
    setTab(next);
    setPage(1);
    setConfirming(null);
    setActionError(null);
    setNotice(null);
  }

  async function resolve(report: ContentReport, action: ReportAction) {
    if (busy) return;
    // Removing content and stopping an account are confirmed first.
    if (
      action !== 'dismiss' &&
      (confirming?.id !== report.id || confirming.action !== action)
    ) {
      setConfirming({ id: report.id, action });
      return;
    }
    setBusy(report.id);
    setActionError(null);
    setNotice(null);
    try {
      await service.resolve(report.id, action);
      setNotice(text.resolved[action]);
    } catch (failure) {
      setActionError(
        failure instanceof ApiError && failure.status === 409
          ? text.alreadyResolved
          : message(failure),
      );
    } finally {
      setConfirming(null);
      setBusy(null);
      // One decision closes every open report about the same target.
      setReload(value => value + 1);
    }
  }

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
          disabled={!!busy}
          onClick={() => setReload(value => value + 1)}
        >
          {text.refresh}
        </Button>
      </header>

      <div className="application-tabs" role="tablist" aria-label={text.title}>
        {tabs.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            id={'report-tab-' + value}
            aria-selected={tab === value}
            aria-controls="report-tabpanel"
            className="application-tab"
            disabled={!!busy && tab !== value}
            onClick={() => selectTab(value)}
          >
            {text.tabs[value]}
          </button>
        ))}
      </div>

      <section
        id="report-tabpanel"
        role="tabpanel"
        aria-labelledby={'report-tab-' + tab}
        className="list-panel application-panel"
      >
        <Feedback message={notice} success />
        <Feedback message={actionError} />
        {data === null && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : data === null ? (
          <div className="empty">
            <Feedback message={loadError} />
            <Button
              variant="secondary"
              onClick={() => setReload(value => value + 1)}
            >
              {copy.form.retry}
            </Button>
          </div>
        ) : data.items.length ? (
          <>
            <Feedback message={loadError} />
            <ul className="review-list">
              {data.items.map(report => (
                <li key={report.id} className="review-item application-card">
                  <div className="review-meta">
                    <span className="status-badge">
                      {text.kinds[report.targetKind]}
                    </span>
                    <strong>{report.targetName || text.deletedAccount}</strong>
                    {report.targetReports > 1 && (
                      <span className="status-badge pending">
                        {text.openCount(report.targetReports)}
                      </span>
                    )}
                    {report.status !== 'open' && (
                      <span className="status-badge">
                        {text.statuses[report.status]}
                      </span>
                    )}
                  </div>
                  {report.excerpt && (
                    <p className="review-preview">{report.excerpt}</p>
                  )}
                  <dl className="application-details">
                    <div>
                      <dt>{text.reason}</dt>
                      <dd>{text.reasons[report.reason]}</dd>
                    </div>
                    <div>
                      <dt>{text.reporter}</dt>
                      <dd>{report.reporterName || text.deletedAccount}</dd>
                    </div>
                    <div>
                      <dt>{text.reportedAt}</dt>
                      <dd>
                        <time dateTime={report.createdAt}>
                          {formatDate(report.createdAt)}
                        </time>
                      </dd>
                    </div>
                    {report.resolvedAt && (
                      <div>
                        <dt>{text.resolvedAt}</dt>
                        <dd>
                          <time dateTime={report.resolvedAt}>
                            {formatDate(report.resolvedAt)}
                          </time>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {report.note && (
                    <p className="review-preview">
                      <span className="hint">{text.note}: </span>
                      {report.note}
                    </p>
                  )}
                  {reportActions(report).length > 0 && (
                    <div className="action-row">
                      {confirming?.id === report.id ? (
                        <>
                          <span className="hint" role="alert">
                            {text.confirm[confirming.action]}
                          </span>
                          <Button
                            variant="danger"
                            className="button-small"
                            busy={busy === report.id}
                            disabled={!!busy}
                            onClick={() => resolve(report, confirming.action)}
                          >
                            {text.actions[confirming.action]}
                          </Button>
                          <Button
                            variant="secondary"
                            className="button-small"
                            disabled={!!busy}
                            onClick={() => setConfirming(null)}
                          >
                            {copy.form.cancel}
                          </Button>
                        </>
                      ) : (
                        reportActions(report).map(action => (
                          <Button
                            key={action}
                            variant={
                              action === 'dismiss' ? 'secondary' : 'danger'
                            }
                            className="button-small"
                            busy={busy === report.id && action === 'dismiss'}
                            disabled={!!busy}
                            onClick={() => resolve(report, action)}
                          >
                            {text.actions[action]}
                          </Button>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {data.totalPages > 1 && (
              <footer className="pagination">
                <span>{copy.panel.page(data.page, data.totalPages)}</span>
                <div className="action-row">
                  <Button
                    variant="secondary"
                    className="button-small"
                    disabled={page <= 1 || !!busy}
                    onClick={() => setPage(value => value - 1)}
                  >
                    {copy.panel.previous}
                  </Button>
                  <Button
                    variant="secondary"
                    className="button-small"
                    disabled={page >= data.totalPages || !!busy}
                    onClick={() => setPage(value => value + 1)}
                  >
                    {copy.panel.next}
                  </Button>
                </div>
              </footer>
            )}
          </>
        ) : (
          <div className="empty">
            <Feedback message={loadError} />
            <h2>{text.empty[tab]}</h2>
          </div>
        )}
      </section>
    </main>
  );
}
