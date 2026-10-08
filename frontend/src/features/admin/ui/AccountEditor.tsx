import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { AccountForm, AdminSection } from '../domain/models';
import type { AdminService } from '../application/admin-service';
import { AccountFields } from './AccountFields';
import { AccountSecurityActions } from './AccountSecurityActions';

export function AccountEditor({
  service,
  section,
  id,
  onClose,
  onDone,
}: {
  service: AdminService;
  section: AdminSection;
  id?: string;
  onClose(): void;
  onDone(message: string): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<AccountForm>({
    fullName: '',
    email: '',
    username: '',
    district: '',
    password: '',
    role: section === 'clubs' ? 'club' : 'player',
    active: true,
  });
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = saving || actionBusy;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (!id) {
      return;
    }
    let current = true;
    setLoading(true);
    setLoadError(null);
    service
      .get(section, id)
      .then(account => {
        if (!current) {
          return;
        }
        if (account.role === 'admin') {
          throw new Error(copy.editor.protected);
        }
        setForm({
          ...account,
          role: account.role,
          password: '',
        });
      })
      .catch(failure => {
        if (current) {
          setLoadError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
        }
      })
      .finally(() => {
        if (current) {
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [service, section, id, revision]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      await service.save(section, form, id);
      onDone(id ? copy.panel.saved : copy.panel.created);
    } catch (failure) {
      if (failure instanceof ApiError) {
        setErrors(failure.fields);
      }
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setSaving(false);
    }
  }
  const title =
    section === 'clubs'
      ? id
        ? copy.editor.editClub
        : copy.editor.createClub
      : id
      ? copy.editor.editUser
      : copy.editor.createUser;
  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="editor-title"
      onCancel={event => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
    >
      <header className="editor-header">
        <div>
          <p className="eyebrow">{copy.editor.details}</p>
          <h2 id="editor-title">{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          disabled={busy}
          aria-label={copy.form.close}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="editor-body">
        {loading ? (
          <p role="status">{copy.form.loading}</p>
        ) : loadError ? (
          <>
            <Feedback message={loadError} />
            <Button onClick={() => setRevision(value => value + 1)}>
              {copy.form.retry}
            </Button>
          </>
        ) : (
          <>
            <form onSubmit={save} className="form-stack">
              <AccountFields
                form={form}
                onChange={setForm}
                section={section}
                editing={!!id}
                busy={busy}
                errors={errors}
              />
              <Feedback message={error} />
              <div className="action-row">
                <Button type="submit" busy={saving} disabled={actionBusy}>
                  {id ? copy.editor.save : copy.editor.create}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={onClose}>
                  {copy.form.cancel}
                </Button>
              </div>
            </form>
            {id && (
              <AccountSecurityActions
                service={service}
                section={section}
                id={id}
                disabled={busy}
                onBusy={setActionBusy}
                onDeleted={() => onDone(copy.panel.deleted)}
              />
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
