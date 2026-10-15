import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { applicationLimits } from '../application/applications-service';
import type { AccountApplication, ApplicationDecision } from '../domain/models';

function formatDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || copy.applications.missing}</dd>
    </div>
  );
}

export function ApplicationCard({
  application,
  busy,
  rejecting,
  reason,
  reasonError,
  onReason,
  onApprove,
  onOpenReject,
  onCancelReject,
  onConfirmReject,
}: {
  application: AccountApplication;
  busy: { id: string; decision: ApplicationDecision } | null;
  rejecting: boolean;
  reason: string;
  reasonError: string | null;
  onReason(value: string): void;
  onApprove(): void;
  onOpenReject(): void;
  onCancelReject(): void;
  onConfirmReject(): void;
}) {
  const id = application.userId;
  const own = busy?.id === id;
  const reasonId = 'application-reason-' + id;
  return (
    <li className="review-item application-card">
      <div className="review-meta">
        <span className="status-badge">
          {copy.applications.roles[application.role]}
        </span>
        <strong>{application.fullName}</strong>
        {application.status !== 'pending' && (
          <span className={'status-badge ' + application.status}>
            <span className="status-dot" aria-hidden="true" />
            {copy.applications.tabs[application.status]}
          </span>
        )}
      </div>
      <dl className="application-details">
        <Detail
          label={copy.applications.contactName}
          value={application.contactName}
        />
        <Detail
          label={copy.applications.username}
          value={application.username}
        />
        <Detail label={copy.applications.email} value={application.email} />
        <Detail label={copy.applications.phone} value={application.phone} />
        <Detail
          label={copy.applications.district}
          value={application.district}
        />
        {application.role === 'club' && (
          <Detail
            label={copy.applications.footballType}
            value={
              application.footballType
                ? copy.football.types[application.footballType]
                : ''
            }
          />
        )}
        <div>
          <dt>{copy.applications.submittedAt}</dt>
          <dd>
            <time dateTime={application.submittedAt}>
              {formatDate(application.submittedAt)}
            </time>
          </dd>
        </div>
        {application.decidedAt && (
          <div>
            <dt>{copy.applications.decidedAt}</dt>
            <dd>
              <time dateTime={application.decidedAt}>
                {formatDate(application.decidedAt)}
              </time>
            </dd>
          </div>
        )}
      </dl>
      {application.note && (
        <p className="review-preview">
          <span className="hint">{copy.applications.note}: </span>
          {application.note}
        </p>
      )}
      {application.status === 'rejected' && (
        <p className="review-preview">
          <span className="hint">{copy.applications.reason}: </span>
          {application.rejectionReason || copy.applications.noReason}
        </p>
      )}
      {application.status === 'pending' &&
        (rejecting ? (
          <div className="application-reject">
            <label className="field">
              <span>{copy.applications.reasonLabel}</span>
              <textarea
                value={reason}
                rows={3}
                maxLength={applicationLimits.reasonMax}
                disabled={own}
                aria-invalid={!!reasonError}
                aria-describedby={reasonId}
                onChange={event => onReason(event.target.value)}
              />
              <span className="gift-counter">
                {copy.applications.counter(
                  reason.length,
                  applicationLimits.reasonMax,
                )}
              </span>
              <span
                id={reasonId}
                className={reasonError ? 'field-error' : 'hint'}
                role={reasonError ? 'alert' : undefined}
              >
                {reasonError || copy.applications.reasonHint}
              </span>
            </label>
            <div className="action-row">
              <Button
                variant="danger"
                className="button-small"
                busy={own && busy?.decision === 'reject'}
                disabled={!!busy}
                onClick={onConfirmReject}
              >
                {copy.applications.confirmReject}
              </Button>
              <Button
                variant="secondary"
                className="button-small"
                disabled={!!busy}
                onClick={onCancelReject}
              >
                {copy.form.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="action-row">
            <Button
              className="button-small"
              busy={own && busy?.decision === 'approve'}
              disabled={!!busy}
              onClick={onApprove}
            >
              {copy.applications.approve}
            </Button>
            <Button
              variant="danger"
              className="button-small"
              disabled={!!busy}
              onClick={onOpenReject}
            >
              {copy.applications.reject}
            </Button>
          </div>
        ))}
    </li>
  );
}
