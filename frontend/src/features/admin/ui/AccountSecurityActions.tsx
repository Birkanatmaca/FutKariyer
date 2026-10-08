import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { AdminService } from '../application/admin-service';
import type { AdminSection } from '../domain/models';
export function AccountSecurityActions({
  service,
  section,
  id,
  disabled,
  onBusy,
  onDeleted,
}: {
  service: AdminService;
  section: AdminSection;
  id: string;
  disabled: boolean;
  onBusy(value: boolean): void;
  onDeleted(): void;
}) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [action, setAction] = useState<'reset' | 'delete' | null>(null);
  async function mutate(next: 'reset' | 'delete') {
    if (disabled || action) {
      return;
    }
    setAction(next);
    onBusy(true);
    setError(null);
    setNotice(null);
    setPasswordError(undefined);
    try {
      if (next === 'reset') {
        await service.resetPassword(section, id, password);
        setPassword('');
        setNotice(copy.editor.resetDone);
      } else {
        await service.remove(section, id);
        onDeleted();
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        setPasswordError(failure.fields.password);
      }
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setAction(null);
      onBusy(false);
    }
  }
  function reset(event: FormEvent) {
    event.preventDefault();
    void mutate('reset');
  }
  return (
    <section className="security-actions">
      <h3>{copy.editor.resetTitle}</h3>
      <p className="muted">{copy.editor.resetHelp}</p>
      <form onSubmit={reset} className="form-stack">
        <Field
          label={copy.editor.newPassword}
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
          minLength={10}
          autoComplete="new-password"
          disabled={disabled}
          error={passwordError}
          hint={copy.form.passwordHelp}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled}
          busy={action === 'reset'}
        >
          {copy.editor.reset}
        </Button>
      </form>
      <Feedback message={notice} success />
      <Feedback message={error} />
      {confirmDelete ? (
        <div className="delete-confirm">
          <h3>{copy.editor.deleteTitle}</h3>
          <p className="muted">{copy.editor.deleteBody}</p>
          <div className="action-row">
            <Button
              variant="danger"
              disabled={disabled}
              busy={action === 'delete'}
              onClick={() => mutate('delete')}
            >
              {copy.editor.deleteConfirm}
            </Button>
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => setConfirmDelete(false)}
            >
              {copy.form.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="danger"
          disabled={disabled}
          onClick={() => setConfirmDelete(true)}
        >
          {copy.editor.delete}
        </Button>
      )}
    </section>
  );
}
