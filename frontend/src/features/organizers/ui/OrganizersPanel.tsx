import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { Modal } from '../../../shared/ui/Modal';
import type { OrganizerForm, OrganizerPage } from '../domain/models';
import type { OrganizerService } from '../application/organizer-service';

const text = copy.organizers;

// Organizasyonlar (22 Oct 2026): organizer accounts, opened only by the
// admin. Password resets and suspension stay in Kullanıcılar.
export function OrganizersPanel({ service }: { service: OrganizerService }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<OrganizerPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .list(page)
      .then(value => {
        if (!current) return;
        if (page > Math.max(1, value.totalPages))
          setPage(Math.max(1, value.totalPages));
        else setData(value);
      })
      .catch(failure => {
        if (current)
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, page, revision]);
  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <div className="title-row">
            <h1>{copy.panel.organizers}</h1>
            {data && (
              <span className="count-badge">
                {copy.panel.total(data.total)}
              </span>
            )}
          </div>
          <p className="muted">{text.hint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && data !== null}
            onClick={() => setRevision(value => value + 1)}
          >
            {text.refresh}
          </Button>
          <Button
            onClick={() => {
              setSuccess(null);
              setCreating(true);
            }}
          >
            + {text.create}
          </Button>
        </div>
      </header>
      <Feedback message={success} success />
      {error ? (
        <div className="rt-empty">
          <Feedback message={error} />
          <Button onClick={() => setRevision(value => value + 1)}>
            {copy.form.retry}
          </Button>
        </div>
      ) : data === null ? (
        <div className="empty" role="status">
          <span className="spinner" />
          <p>{copy.form.loading}</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="rt-empty">
          <h3>{text.empty}</h3>
          <p className="muted">{text.emptyHint}</p>
          <Button onClick={() => setCreating(true)}>+ {text.create}</Button>
        </div>
      ) : (
        <section className="list-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{text.name}</th>
                  <th>{text.username}</th>
                  <th>{text.email}</th>
                  <th>{text.status}</th>
                  <th className="align-right">{text.tournaments}</th>
                  <th>{text.created}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-identity">
                        <span className="avatar">
                          {item.fullName.slice(0, 1).toLocaleUpperCase('tr-TR')}
                        </span>
                        <strong>{item.fullName}</strong>
                      </div>
                    </td>
                    <td className="login-identity">@{item.username}</td>
                    <td className="login-identity">
                      {item.email || (
                        <span className="muted">{text.noEmail}</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          'status-badge ' +
                          (item.active ? 'active' : 'inactive')
                        }
                      >
                        <span className="status-dot" />
                        {item.active ? copy.panel.active : copy.panel.inactive}
                      </span>
                    </td>
                    <td className="align-right">{item.tournaments}</td>
                    <td>
                      {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {data && data.totalPages > 1 && (
        <footer className="pagination">
          <span>{copy.panel.page(page, data.totalPages)}</span>
          <div className="action-row">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(value => value - 1)}
            >
              {copy.panel.previous}
            </Button>
            <Button
              variant="secondary"
              disabled={page >= data.totalPages}
              onClick={() => setPage(value => value + 1)}
            >
              {copy.panel.next}
            </Button>
          </div>
        </footer>
      )}
      {creating && (
        <CreateOrganizerModal
          service={service}
          onClose={() => setCreating(false)}
          onDone={name => {
            setCreating(false);
            setSuccess(text.createdMessage(name));
            setPage(1);
            setRevision(value => value + 1);
          }}
        />
      )}
    </main>
  );
}

const empty: OrganizerForm = {
  fullName: '',
  username: '',
  email: '',
  password: '',
};

function CreateOrganizerModal({
  service,
  onClose,
  onDone,
}: {
  service: OrganizerService;
  onClose(): void;
  onDone(name: string): void;
}) {
  const [form, setForm] = useState<OrganizerForm>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const change = (key: keyof OrganizerForm, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (form.password.length < 10) {
      setFields({ password: text.passwordShort });
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const created = await service.create(form);
      onDone(created.fullName);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={text.create}
      eyebrow={text.eyebrow}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {copy.form.cancel}
          </Button>
          <Button busy={busy} onClick={() => save()}>
            {text.save}
          </Button>
        </>
      }
    >
      <form className="lg-form" onSubmit={save} autoComplete="off">
        <div className="lg-wide">
          <Field
            label={text.fullName}
            value={form.fullName}
            required
            autoFocus
            maxLength={120}
            disabled={busy}
            error={fields.fullName}
            onChange={event => change('fullName', event.target.value)}
          />
        </div>
        <Field
          label={text.username}
          value={form.username}
          required
          maxLength={40}
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
          error={fields.username}
          onChange={event => change('username', event.target.value)}
        />
        <Field
          label={text.emailOptional}
          type="email"
          value={form.email}
          maxLength={254}
          autoComplete="off"
          disabled={busy}
          error={fields.email}
          onChange={event => change('email', event.target.value)}
        />
        <div className="lg-wide">
          <Field
            label={text.password}
            type="password"
            value={form.password}
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            disabled={busy}
            error={fields.password}
            hint={text.passwordHint}
            onChange={event => change('password', event.target.value)}
          />
        </div>
        <button type="submit" hidden />
      </form>
      <Feedback message={error} />
    </Modal>
  );
}
