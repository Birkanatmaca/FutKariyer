import { useEffect, useState, type FormEvent } from 'react';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { copy } from '../../../shared/lib/copy';
import type { Account } from '../../../shared/domain/account';
import type { AdminSection } from '../domain/models';
import type { AdminService } from '../application/admin-service';
import { useAccountPage } from '../application/useAccountPage';
import { AccountTable } from './AccountTable';
import { AccountEditor } from './AccountEditor';

export function AdminPanel({
  service,
  section,
  onSection,
  user,
  onLogout,
  logoutBusy,
  logoutError,
}: {
  service: AdminService;
  section: AdminSection;
  onSection(section: AdminSection): void;
  user: Account;
  onLogout(): void;
  logoutBusy: boolean;
  logoutError: string | null;
}) {
  const [query, setQuery] = useState({ section, page: 1, search: '' });
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    section: AdminSection;
    id?: string;
  } | null>(null);
  const current =
    query.section === section ? query : { section, page: 1, search: '' };
  const { data, loading, error, reload } = useAccountPage(
    service,
    section,
    current.page,
    current.search,
  );
  useEffect(() => {
    setQuery({ section, page: 1, search: '' });
    setDraft('');
    setNotice(null);
    setEditor(null);
  }, [section]);
  useEffect(() => {
    if (!loading && data && current.page > Math.max(1, data.totalPages)) {
      setQuery({
        section,
        search: current.search,
        page: Math.max(1, data.totalPages),
      });
    }
  }, [data, loading, current.page, current.search, section]);
  function search(event: FormEvent) {
    event.preventDefault();
    setQuery({ section, page: 1, search: draft.trim() });
    reload();
  }
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">{copy.panel.eyebrow}</p>
        <nav aria-label={copy.panel.eyebrow}>
          {(['users', 'clubs'] as const).map(value => (
            <a
              key={value}
              href={'/securityadmin/' + value}
              aria-current={section === value ? 'page' : undefined}
              onClick={event => {
                if (
                  event.button === 0 &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  onSection(value);
                }
              }}
            >
              <span aria-hidden="true">{value === 'users' ? '◎' : '▱'}</span>
              {copy.panel[value]}
              <span className="nav-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="avatar">{user.fullName.slice(0, 1)}</span>
          <div>
            <strong>{user.fullName}</strong>
            <span>{copy.admin}</span>
          </div>
        </div>
        <Button variant="secondary" busy={logoutBusy} onClick={onLogout}>
          {copy.panel.logout}
          <span aria-hidden="true">↗</span>
        </Button>
      </aside>
      <main className="panel-content">
        <header className="panel-header">
          <div>
            <p className="eyebrow">{copy.pilot}</p>
            <div className="title-row">
              <h1>{copy.panel[section]}</h1>
              {!loading && data && (
                <span className="count-badge">
                  {copy.panel.total(data.total)}
                </span>
              )}
            </div>
            <p className="muted">
              {section === 'clubs'
                ? copy.panel.clubsHint
                : copy.panel.usersHint}
            </p>
          </div>
          <Button disabled={logoutBusy} onClick={() => setEditor({ section })}>
            <span aria-hidden="true">＋</span>
            {section === 'clubs' ? copy.panel.newClub : copy.panel.newUser}
          </Button>
        </header>
        <Feedback message={logoutError} />
        <Feedback message={notice} success />
        {section === 'clubs' && <p className="notice">{copy.panel.clubNote}</p>}
        <section className="list-panel" aria-label={copy.panel[section]}>
          <div className="toolbar">
            <form onSubmit={search} className="search-form">
              <input
                aria-label={copy.panel.search}
                placeholder={copy.panel.search}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                maxLength={100}
                type="search"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={loading || logoutBusy}
              >
                {copy.panel.searchButton}
              </Button>
            </form>
            <Button
              variant="secondary"
              disabled={loading || logoutBusy}
              onClick={reload}
            >
              {copy.panel.refresh}
            </Button>
          </div>
          {loading ? (
            <div className="empty" role="status">
              <span className="spinner" />
              <p>{copy.form.loading}</p>
            </div>
          ) : error ? (
            <div className="empty">
              <Feedback message={error} />
              <Button variant="secondary" onClick={reload}>
                {copy.form.retry}
              </Button>
            </div>
          ) : (
            data && (
              <>
                {data.items.length ? (
                  <AccountTable
                    accounts={data.items}
                    onEdit={account =>
                      setEditor({
                        section: account.role === 'club' ? 'clubs' : 'users',
                        id: account.id,
                      })
                    }
                  />
                ) : (
                  <div className="empty">
                    <h2>
                      {current.search
                        ? copy.panel.emptySearch
                        : copy.panel.empty}
                    </h2>
                    {!current.search && (
                      <p className="muted">{copy.panel.emptyBody}</p>
                    )}
                  </div>
                )}
                <footer className="pagination">
                  <span className="muted">{copy.panel.pageSize}</span>
                  <div className="action-row">
                    <Button
                      variant="secondary"
                      className="button-small"
                      disabled={current.page <= 1}
                      onClick={() =>
                        setQuery({ ...current, page: current.page - 1 })
                      }
                    >
                      {copy.panel.previous}
                    </Button>
                    <span aria-live="polite">
                      {copy.panel.page(data.page, data.totalPages)}
                    </span>
                    <Button
                      variant="secondary"
                      className="button-small"
                      disabled={current.page >= data.totalPages}
                      onClick={() =>
                        setQuery({ ...current, page: current.page + 1 })
                      }
                    >
                      {copy.panel.next}
                    </Button>
                  </div>
                </footer>
              </>
            )
          )}
        </section>
      </main>
      {editor && (
        <AccountEditor
          key={editor.id || 'new-' + editor.section}
          service={service}
          section={editor.section}
          id={editor.id}
          onClose={() => setEditor(null)}
          onDone={message => {
            setEditor(null);
            setNotice(message);
            setQuery({ ...current, page: 1 });
            reload();
          }}
        />
      )}
    </div>
  );
}
