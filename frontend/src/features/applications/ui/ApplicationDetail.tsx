import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Modal } from '../../../shared/ui/Modal';
import { Initials, Pill, ago, dateTime } from '../../../shared/ui/kit';
import { applicationLimits } from '../application/applications-service';
import type {
  AccountApplication,
  ApplicationDecision,
  ApplicationStatus,
} from '../domain/models';

const text = copy.applications;

export function statusTone(status: ApplicationStatus) {
  return status === 'pending'
    ? 'warning'
    : status === 'approved'
    ? 'accent'
    : 'danger';
}

// One application in full, with the decision at the bottom while it waits.
export function ApplicationDetail({
  application: item,
  onClose,
  onDecide,
}: {
  application: AccountApplication;
  onClose(): void;
  onDecide(decision: ApplicationDecision, reason: string): Promise<void>;
}) {
  const [busy, setBusy] = useState<ApplicationDecision | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const pending = item.status === 'pending';

  async function decide(decision: ApplicationDecision) {
    if (busy) return;
    setBusy(decision);
    setError(null);
    setReasonError(null);
    try {
      await onDecide(decision, reason);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 422)
        setReasonError(failure.fields.reason || failure.message);
      else
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
      setBusy(null);
    }
  }

  const rows: [string, string][] = [
    [text.contactName, item.contactName],
    [text.username, item.username],
    [text.email, item.email],
    [text.phone, item.phone],
    [text.district, item.district],
    [
      text.footballType,
      item.footballType ? copy.football.types[item.footballType] : '',
    ],
    [text.submittedAt, dateTime(item.submittedAt)],
  ];
  if (item.decidedAt) rows.push([text.decidedAt, dateTime(item.decidedAt)]);

  return (
    <Modal
      title={item.fullName}
      eyebrow={text.detailEyebrow}
      size="md"
      busy={!!busy}
      onClose={onClose}
      footer={
        pending ? (
          rejecting ? (
            <>
              <Button
                variant="secondary"
                disabled={!!busy}
                onClick={() => {
                  setRejecting(false);
                  setReasonError(null);
                }}
              >
                {copy.form.cancel}
              </Button>
              <Button
                variant="danger"
                busy={busy === 'reject'}
                disabled={!!busy}
                onClick={() => decide('reject')}
              >
                {text.confirmReject}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="danger"
                disabled={!!busy}
                onClick={() => setRejecting(true)}
              >
                {text.reject}
              </Button>
              <Button
                busy={busy === 'approve'}
                disabled={!!busy}
                onClick={() => decide('approve')}
              >
                {text.approve}
              </Button>
            </>
          )
        ) : undefined
      }
    >
      <div className="kit-editor">
        <div className="kit-profile">
          <Initials name={item.fullName} />
          <div>
            <strong>{item.fullName}</strong>
            <span className="muted">{text.sentAgo(ago(item.submittedAt))}</span>
          </div>
          <div className="kit-profile-pills">
            <Pill tone={item.role === 'club' ? 'brand' : 'warning'}>
              {text.roles[item.role]}
            </Pill>
            <Pill tone={statusTone(item.status)}>{text.tabs[item.status]}</Pill>
          </div>
        </div>
        <dl className="kit-details">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || <span className="muted">{text.missing}</span>}</dd>
            </div>
          ))}
        </dl>
        <div className="kit-note">
          <span className="kit-form-title">{text.note}</span>
          <p>{item.note || <span className="muted">{text.noNote}</span>}</p>
        </div>
        {item.status === 'rejected' && (
          <div className="kit-note kit-note-danger">
            <span className="kit-form-title">{text.reason}</span>
            <p>{item.rejectionReason || text.noReason}</p>
          </div>
        )}
        {pending && (
          <p className="hint">
            {item.role === 'club' ? text.approveHintClub : text.approveHint}
          </p>
        )}
        {rejecting && (
          <div className="field">
            <label htmlFor="reject-reason">{text.reasonLabel}</label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              maxLength={applicationLimits.reasonMax}
              disabled={!!busy}
              onChange={event => {
                setReason(event.target.value);
                setReasonError(null);
              }}
            />
            <p className="hint">
              {text.reasonHint}{' '}
              {text.counter(reason.length, applicationLimits.reasonMax)}
            </p>
            {reasonError && (
              <p className="field-error" role="alert">
                {reasonError}
              </p>
            )}
          </div>
        )}
        <Feedback message={error} />
      </div>
    </Modal>
  );
}
