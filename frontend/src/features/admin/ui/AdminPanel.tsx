import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { copy } from '../../../shared/lib/copy';
import {
  FilterTabs,
  Pager,
  StatCards,
  type Stat,
} from '../../../shared/ui/kit';
import {
  accountPageSize,
  type AccountQuery,
  type AccountRoleFilter,
  type AccountStats,
  type AccountStatusFilter,
  type AdminSection,
} from '../domain/models';
import type { AdminService } from '../application/admin-service';
import { useAccountPage, useAccountStats } from '../application/useAccountPage';
import { AccountTable } from './AccountTable';
import { AccountEditor } from './AccountEditor';

const text = copy.panel;
const fresh = (): AccountQuery => ({
  page: 1,
  search: '',
  role: '',
  status: '',
});

function share(part: number, total: number) {
  return total ? part / total : 0;
}

function userStats(stats: AccountStats | null): Stat[] {
  const s = stats;
  const role = (key: string) => s?.byRole[key] ?? 0;
  const total = s?.total ?? 0;
  return [
    {
      label: text.stats.totalUsers,
      value: total,
      sub: text.stats.newThisWeek(s?.newLast7Days ?? 0),
      tone: 'brand',
    },
    {
      label: copy.roles.player,
      value: role('player'),
      share: share(role('player'), total),
      tone: 'accent',
    },
    {
      label: copy.roles.coach,
      value: role('coach'),
      share: share(role('coach'), total),
      tone: 'info',
    },
    {
      label: copy.roles.club,
      value: role('club'),
      share: share(role('club'), total),
      tone: 'brand',
    },
    {
      label: text.stats.pro,
      value: s?.pro ?? 0,
      sub: text.stats.ofAll(Math.round(share(s?.pro ?? 0, total) * 100)),
      tone: 'warning',
    },
    {
      label: text.stats.closed,
      value: (s?.inactive ?? 0) + (s?.pending ?? 0),
      sub: text.stats.pendingSub(s?.pending ?? 0),
      tone: 'danger',
    },
  ];
}

function clubStats(stats: AccountStats | null): Stat[] {
  const s = stats;
  const total = s?.total ?? 0;
  const type = (key: string) => s?.byFootballType[key] ?? 0;
  return [
    {
      label: text.stats.totalClubs,
      value: total,
      sub: text.stats.newThisMonth(s?.newLast30Days ?? 0),
      tone: 'brand',
    },
    {
      label: text.stats.verified,
      value: s?.verified ?? 0,
      share: share(s?.verified ?? 0, total),
      tone: 'accent',
    },
    {
      label: text.stats.inLeagues,
      value: s?.inLeagues ?? 0,
      share: share(s?.inLeagues ?? 0, total),
      tone: 'info',
    },
    {
      label: text.stats.byType,
      value: type('halisaha'),
      sub: text.stats.typeSplit(type('amateur'), type('professional')),
      tone: 'warning',
    },
    {
      label: text.stats.pendingClubs,
      value: s?.pending ?? 0,
      sub: text.stats.closedSub(s?.inactive ?? 0),
      tone: 'danger',
    },
  ];
}

export function AdminPanel({
  service,
  section,
  onOpenClub,
}: {
  service: AdminService;
  section: AdminSection;
  logoutBusy?: boolean;
  onOpenClub(id: string): void;
}) {
  const [query, setQuery] = useState<AccountQuery>(fresh);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const { data, loading, error, reload, revision } = useAccountPage(
    service,
    section,
    query,
  );
  const stats = useAccountStats(service, section, revision);
  useEffect(() => {
    setQuery(fresh());
    setDraft('');
    setNotice(null);
    setEditing(null);
  }, [section]);
  useEffect(() => {
    if (!loading && data && query.page > Math.max(1, data.totalPages)) {
      setQuery(current => ({
        ...current,
        page: Math.max(1, data.totalPages),
      }));
    }
  }, [data, loading, query.page]);
  function search(event: FormEvent) {
    event.preventDefault();
    setQuery(current => ({ ...current, page: 1, search: draft.trim() }));
  }
  const clubs = section === 'clubs';
  const filtered = !!(query.search || query.role || query.status);
  const roleOptions: {
    value: AccountRoleFilter;
    label: string;
    count?: number;
  }[] = [
    { value: '', label: copy.kit.all, count: stats?.total },
    {
      value: 'player',
      label: copy.roles.player,
      count: stats?.byRole.player ?? 0,
    },
    {
      value: 'coach',
      label: copy.roles.coach,
      count: stats?.byRole.coach ?? 0,
    },
    { value: 'club', label: copy.roles.club, count: stats?.byRole.club ?? 0 },
    {
      value: 'organizer',
      label: copy.roles.organizer,
      count: stats?.byRole.organizer ?? 0,
    },
  ];
  const statusOptions: { value: AccountStatusFilter; label: string }[] = [
    { value: '', label: text.statusAll },
    { value: 'active', label: text.active },
    { value: 'inactive', label: text.inactive },
    { value: 'pending', label: text.pending },
  ];
  return (
    <>
      <main className="panel-content kit-screen">
        <header className="panel-header">
          <div>
            <p className="eyebrow">
              {copy.panel.groups.accounts.toLocaleUpperCase('tr-TR')}
            </p>
            <h1>{copy.panel[section]}</h1>
            <p className="muted">{clubs ? text.clubsHint : text.usersHint}</p>
          </div>
          <Button variant="secondary" disabled={loading} onClick={reload}>
            {text.refresh}
          </Button>
        </header>
        <StatCards
          items={clubs ? clubStats(stats) : userStats(stats)}
          loading={!stats}
        />
        <Feedback message={notice} success />
        <section className="kit-panel" aria-label={copy.panel[section]}>
          <div className="kit-toolbar">
            {clubs ? (
              <FilterTabs
                label={text.status}
                value={query.status}
                options={statusOptions.map(option => ({
                  ...option,
                  count:
                    stats === null
                      ? undefined
                      : option.value === ''
                      ? stats.total
                      : option.value === 'active'
                      ? stats.active
                      : option.value === 'inactive'
                      ? stats.inactive
                      : stats.pending,
                }))}
                onChange={status =>
                  setQuery(current => ({ ...current, status, page: 1 }))
                }
              />
            ) : (
              <FilterTabs
                label={text.role}
                value={query.role}
                options={roleOptions}
                onChange={role =>
                  setQuery(current => ({ ...current, role, page: 1 }))
                }
              />
            )}
            <div className="kit-toolbar-end">
              {!clubs && (
                <select
                  className="kit-select"
                  aria-label={text.status}
                  value={query.status}
                  onChange={event =>
                    setQuery(current => ({
                      ...current,
                      status: event.target.value as AccountStatusFilter,
                      page: 1,
                    }))
                  }
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              <form onSubmit={search} className="kit-search" role="search">
                <input
                  aria-label={text.search}
                  placeholder={text.search}
                  value={draft}
                  onChange={event => {
                    setDraft(event.target.value);
                    if (!event.target.value && query.search)
                      setQuery(current => ({
                        ...current,
                        search: '',
                        page: 1,
                      }));
                  }}
                  maxLength={100}
                  type="search"
                />
                <Button type="submit" variant="secondary" disabled={loading}>
                  {text.searchButton}
                </Button>
              </form>
            </div>
          </div>
          {loading && !data ? (
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
                    clubs={clubs}
                    busy={loading}
                    onEdit={account => setEditing(account.id)}
                    onOverview={account => onOpenClub(account.id)}
                  />
                ) : (
                  <div className="empty">
                    <h2>{filtered ? text.emptySearch : text.empty}</h2>
                    <p className="muted">
                      {filtered ? text.emptyFilterBody : text.emptyBody}
                    </p>
                  </div>
                )}
                <Pager
                  page={query.page}
                  pageSize={accountPageSize}
                  total={data.total}
                  disabled={loading}
                  onPage={page => setQuery(current => ({ ...current, page }))}
                />
              </>
            )
          )}
        </section>
      </main>
      {editing && (
        <AccountEditor
          key={editing}
          service={service}
          section={section}
          id={editing}
          onClose={() => setEditing(null)}
          onDone={message => {
            setEditing(null);
            setNotice(message);
            reload();
          }}
        />
      )}
    </>
  );
}
