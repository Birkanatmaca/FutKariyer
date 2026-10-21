import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Modal } from '../../../shared/ui/Modal';
import { FilterTabs, Initials, Pill, shortDate } from '../../../shared/ui/kit';
import {
  proEligibleRoles,
  type AccountForm,
  type AdminSection,
  type ManagedAccount,
} from '../domain/models';
import type { AdminService } from '../application/admin-service';
import { AccountFields } from './AccountFields';
import { AccountProActions } from './AccountProActions';
import { AccountSecurityActions } from './AccountSecurityActions';

type Tab = 'details' | 'pro' | 'security';

export function AccountEditor({
  service,
  section,
  id,
  onClose,
  onDone,
}: {
  service: AdminService;
  section: AdminSection;
  id: string;
  onClose(): void;
  onDone(message: string): void;
}) {
  const [account, setAccount] = useState<ManagedAccount | null>(null);
  const [form, setForm] = useState<AccountForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<Tab>('details');
  const busy = saving || actionBusy;
  useEffect(() => {
    let current = true;
    setLoadError(null);
    service
      .get(section, id)
      .then(value => {
        if (!current) return;
        if (value.role === 'admin') throw new Error(copy.editor.protected);
        setAccount(value);
        setForm({
          ...value,
          footballType: value.footballType || 'unknown',
          role: value.role,
        });
      })
      .catch(failure => {
        if (current)
          setLoadError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      });
    return () => {
      current = false;
    };
  }, [service, section, id, revision]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !form) return;
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      await service.save(section, form, id);
      onDone(copy.panel.saved);
    } catch (failure) {
      if (failure instanceof ApiError) setErrors(failure.fields);
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setSaving(false);
    }
  }
  const tabs: { value: Tab; label: string }[] = [
    { value: 'details', label: copy.editor.tabs.details },
  ];
  if (form && proEligibleRoles.includes(form.role))
    tabs.push({ value: 'pro', label: copy.editor.tabs.pro });
  tabs.push({ value: 'security', label: copy.editor.tabs.security });
  return (
    <Modal
      title={section === 'clubs' ? copy.editor.editClub : copy.editor.editUser}
      eyebrow={copy.editor.details.toLocaleUpperCase('tr-TR')}
      size="lg"
      busy={busy}
      onClose={onClose}
      footer={
        tab === 'details' && form ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {copy.form.cancel}
            </Button>
            <Button
              type="submit"
              form="account-editor-form"
              busy={saving}
              disabled={actionBusy}
            >
              {copy.editor.save}
            </Button>
          </>
        ) : undefined
      }
    >
      {loadError ? (
        <div className="kit-center">
          <Feedback message={loadError} />
          <Button
            variant="secondary"
            onClick={() => setRevision(value => value + 1)}
          >
            {copy.form.retry}
          </Button>
        </div>
      ) : !account || !form ? (
        <div className="empty" role="status">
          <span className="spinner" />
          <p>{copy.form.loading}</p>
        </div>
      ) : (
        <div className="kit-editor">
          <div className="kit-profile">
            <Initials name={account.fullName} />
            <div>
              <strong>{account.fullName}</strong>
              <span className="muted">
                {account.username || account.email}
                {' · '}
                {copy.panel.joined(shortDate(account.createdAt))}
              </span>
            </div>
            <div className="kit-profile-pills">
              <Pill tone={roleTone(account.role)}>
                {copy.roles[account.role]}
              </Pill>
              {account.pro && <Pill tone="warning">PRO</Pill>}
            </div>
          </div>
          <FilterTabs
            label={copy.editor.details}
            value={tab}
            options={tabs}
            onChange={value => setTab(value)}
            disabled={busy}
          />
          {tab === 'details' ? (
            <form id="account-editor-form" onSubmit={save}>
              <AccountFields
                form={form}
                onChange={setForm}
                section={section}
                busy={busy}
                errors={errors}
              />
              <Feedback message={error} />
            </form>
          ) : tab === 'pro' ? (
            <AccountProActions
              service={service}
              id={id}
              disabled={busy}
              onBusy={setActionBusy}
            />
          ) : (
            <AccountSecurityActions
              service={service}
              section={section}
              id={id}
              disabled={busy}
              onBusy={setActionBusy}
              onDeleted={() => onDone(copy.panel.deleted)}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

export function roleTone(role: ManagedAccount['role']) {
  return role === 'club'
    ? 'brand'
    : role === 'coach'
    ? 'info'
    : role === 'organizer'
    ? 'warning'
    : role === 'admin'
    ? 'danger'
    : 'accent';
}
