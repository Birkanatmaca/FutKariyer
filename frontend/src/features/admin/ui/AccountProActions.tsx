import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { AdminService } from '../application/admin-service';
import type { ProAction, ProStatus } from '../domain/models';

export function AccountProActions({
  service,
  id,
  disabled,
  onBusy,
}: {
  service: AdminService;
  id: string;
  disabled: boolean;
  onBusy(value: boolean): void;
}) {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ProAction | null>(null);
  const [action, setAction] = useState<ProAction | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setError(null);
    service
      .proStatus(id)
      .then(value => {
        if (current) {
          setStatus(value);
        }
      })
      .catch(failure => {
        if (current) {
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
        }
      });
    return () => {
      current = false;
    };
  }, [service, id, revision]);
  async function mutate(next: ProAction) {
    if (disabled || action) {
      return;
    }
    setAction(next);
    onBusy(true);
    setError(null);
    setNotice(null);
    try {
      setStatus(await service.changePro(id, next));
      setConfirm(null);
      setRevision(value => value + 1);
      setNotice(
        next === 'grant' ? copy.editor.proGranted : copy.editor.proRevoked,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setAction(null);
      onBusy(false);
    }
  }
  const locked = disabled || !status;
  return (
    <section className="security-actions" aria-labelledby="account-pro-title">
      <div>
        <h3 id="account-pro-title">{copy.editor.proTitle}</h3>
        <p className="muted">{copy.editor.proHint}</p>
      </div>
      {status ? (
        <div className="pro-membership-status">
          <span
            className={
              'league-status ' + (status.active ? 'active' : 'neutral')
            }
          >
            {status.active && status.expiresAt
              ? copy.editor.proActive(
                  new Date(status.expiresAt).toLocaleDateString('tr-TR'),
                )
              : copy.editor.proInactive}
          </span>
          <span className="muted">
            {copy.editor.proRights(status.bonusCredits)}
          </span>
        </div>
      ) : error ? null : (
        <p role="status">{copy.form.loading}</p>
      )}
      <Feedback message={notice} success />
      <Feedback message={error} />
      {!status && error ? (
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => setRevision(value => value + 1)}
        >
          {copy.form.retry}
        </Button>
      ) : confirm ? (
        <div className="delete-confirm">
          <h3>
            {confirm === 'grant'
              ? copy.editor.proGrantTitle
              : copy.editor.proRevokeTitle}
          </h3>
          <p className="muted">
            {confirm === 'grant'
              ? copy.editor.proGrantBody
              : copy.editor.proRevokeBody}
          </p>
          <div className="action-row">
            <Button
              variant={confirm === 'grant' ? 'primary' : 'danger'}
              disabled={locked}
              busy={action === confirm}
              onClick={() => void mutate(confirm)}
            >
              {copy.editor.proConfirm}
            </Button>
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => setConfirm(null)}
            >
              {copy.form.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="action-row">
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => setConfirm('grant')}
          >
            {copy.editor.proGrant}
          </Button>
          <Button
            variant="danger"
            disabled={locked || !status?.active}
            onClick={() => setConfirm('revoke')}
          >
            {copy.editor.proRevoke}
          </Button>
        </div>
      )}
    </section>
  );
}
