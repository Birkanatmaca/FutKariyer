import { useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { ApplicationService } from '../application/applications-service';
import type {
  AccountApplication,
  ApplicationDecision,
  ApplicationStatus,
} from '../domain/models';
import { ApplicationCard } from './ApplicationCard';

const tabs: ApplicationStatus[] = ['pending', 'approved', 'rejected'];

function message(failure: unknown) {
  return failure instanceof Error ? failure.message : copy.form.unexpected;
}

export function ApplicationsPanel({
  service,
  onPendingCount,
}: {
  service: ApplicationService;
  onPendingCount(count: number): void;
}) {
  const [status, setStatus] = useState<ApplicationStatus>('pending'),
    [items, setItems] = useState<AccountApplication[] | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<string | null>(null),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState<{
      id: string;
      decision: ApplicationDecision;
    } | null>(null),
    [actionError, setActionError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [rejecting, setRejecting] = useState<string | null>(null),
    [reason, setReason] = useState(''),
    [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    service
      .list(status)
      .then(value => {
        if (current) setItems(value);
      })
      .catch(failure => {
        if (current) {
          setItems(null);
          setLoadError(message(failure));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, status, reload]);

  useEffect(() => {
    if (status === 'pending' && items !== null && !loading) {
      onPendingCount(items.length);
    }
  }, [status, items, loading, onPendingCount]);

  function selectTab(next: ApplicationStatus) {
    if (next === status || busy) return;
    setItems(null);
    setStatus(next);
    setActionError(null);
    setNotice(null);
    setRejecting(null);
    setReasonError(null);
  }

  function openReject(id: string) {
    setRejecting(id);
    setReason('');
    setReasonError(null);
    setActionError(null);
  }

  async function decide(
    application: AccountApplication,
    decision: ApplicationDecision,
  ) {
    if (busy) return;
    setBusy({ id: application.userId, decision });
    setActionError(null);
    setReasonError(null);
    setNotice(null);
    try {
      await service.decide(application.userId, decision, reason);
      setItems(current =>
        current
          ? current.filter(item => item.userId !== application.userId)
          : current,
      );
      setRejecting(null);
      setReason('');
      setNotice(
        decision === 'approve'
          ? copy.applications.approved(application.fullName)
          : copy.applications.rejected(application.fullName),
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setActionError(copy.applications.alreadyDecided);
        setRejecting(null);
        setReload(v => v + 1);
      } else if (failure instanceof ApiError && failure.status === 404) {
        setActionError(copy.applications.notFound);
        setRejecting(null);
        setReload(v => v + 1);
      } else if (failure instanceof ApiError && failure.status === 422) {
        setReasonError(failure.fields.reason || failure.message);
      } else {
        setActionError(message(failure));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.applications.eyebrow}</p>
          <h1>{copy.applications.title}</h1>
          <p className="muted">{copy.applications.hint}</p>
        </div>
        <Button
          variant="secondary"
          busy={loading && items !== null}
          disabled={!!busy}
          onClick={() => setReload(v => v + 1)}
        >
          {copy.applications.refresh}
        </Button>
      </header>

      <div
        className="application-tabs"
        role="tablist"
        aria-label={copy.applications.title}
      >
        {tabs.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            id={'application-tab-' + value}
            aria-selected={status === value}
            aria-controls="application-tabpanel"
            className="application-tab"
            disabled={!!busy && status !== value}
            onClick={() => selectTab(value)}
          >
            {copy.applications.tabs[value]}
          </button>
        ))}
      </div>

      <section
        id="application-tabpanel"
        role="tabpanel"
        aria-labelledby={'application-tab-' + status}
        className="list-panel application-panel"
      >
        <Feedback message={notice} success />
        <Feedback message={actionError} />
        {items === null && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : items === null ? (
          <div className="empty">
            <Feedback message={loadError} />
            <Button variant="secondary" onClick={() => setReload(v => v + 1)}>
              {copy.form.retry}
            </Button>
          </div>
        ) : items.length ? (
          <>
            <Feedback message={loadError} />
            <ul className="review-list">
              {items.map(application => (
                <ApplicationCard
                  key={application.userId}
                  application={application}
                  busy={busy}
                  rejecting={rejecting === application.userId}
                  reason={reason}
                  reasonError={
                    rejecting === application.userId ? reasonError : null
                  }
                  onReason={value => {
                    setReason(value);
                    setReasonError(null);
                  }}
                  onApprove={() => decide(application, 'approve')}
                  onOpenReject={() => openReject(application.userId)}
                  onCancelReject={() => {
                    setRejecting(null);
                    setReasonError(null);
                  }}
                  onConfirmReject={() => decide(application, 'reject')}
                />
              ))}
            </ul>
          </>
        ) : (
          <div className="empty">
            <Feedback message={loadError} />
            <h2>{copy.applications.empty[status]}</h2>
            <p className="muted">{copy.applications.emptyHint[status]}</p>
          </div>
        )}
      </section>
    </main>
  );
}
