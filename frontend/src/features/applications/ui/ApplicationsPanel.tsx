import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import {
  FilterTabs,
  Initials,
  Pager,
  Pill,
  StatCards,
  ago,
  slice,
} from '../../../shared/ui/kit';
import type { ApplicationService } from '../application/applications-service';
import type {
  AccountApplication,
  ApplicationDecision,
  ApplicationRole,
  ApplicationStatus,
} from '../domain/models';
import { ApplicationDetail, statusTone } from './ApplicationDetail';

const text = copy.applications;
const statuses: ApplicationStatus[] = ['pending', 'approved', 'rejected'];
const pageSize = 12;
type Lists = Record<ApplicationStatus, AccountApplication[]>;

function message(failure: unknown) {
  return failure instanceof Error ? failure.message : copy.form.unexpected;
}

function hoursWaiting(items: AccountApplication[], now = Date.now()) {
  const oldest = items.reduce(
    (min, item) => Math.min(min, Date.parse(item.submittedAt)),
    now,
  );
  return Math.round((now - oldest) / 3600000);
}

export function ApplicationsPanel({
  service,
  onPendingCount,
}: {
  service: ApplicationService;
  onPendingCount(count: number): void;
}) {
  const [lists, setLists] = useState<Lists | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<string | null>(null),
    [reload, setReload] = useState(0),
    [status, setStatus] = useState<ApplicationStatus>('pending'),
    [role, setRole] = useState<'' | ApplicationRole>(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [open, setOpen] = useState<AccountApplication | null>(null),
    [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    Promise.all(statuses.map(value => service.list(value)))
      .then(([pending, approved, rejected]) => {
        if (current) setLists({ pending, approved, rejected });
      })
      .catch(failure => {
        if (current) setLoadError(message(failure));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, reload]);

  useEffect(() => {
    if (lists) onPendingCount(lists.pending.length);
  }, [lists, onPendingCount]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return (lists?.[status] ?? []).filter(
      item =>
        (!role || item.role === role) &&
        (!term ||
          [item.fullName, item.contactName, item.email, item.username]
            .join(' ')
            .toLocaleLowerCase('tr-TR')
            .includes(term)),
    );
  }, [lists, status, role, search]);
  const lastPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, lastPage);

  async function decide(
    application: AccountApplication,
    decision: ApplicationDecision,
    reason: string,
  ) {
    try {
      await service.decide(application.userId, decision, reason);
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        (failure.status === 409 || failure.status === 404)
      ) {
        setOpen(null);
        setNotice(null);
        setLoadError(
          failure.status === 409 ? text.alreadyDecided : text.notFound,
        );
        setReload(v => v + 1);
        return;
      }
      throw failure;
    }
    setOpen(null);
    setNotice(
      decision === 'approve'
        ? text.approved(application.fullName)
        : text.rejected(application.fullName),
    );
    setReload(v => v + 1);
  }

  const pending = lists?.pending ?? [];
  const decided = (lists?.approved.length ?? 0) + (lists?.rejected.length ?? 0);
  return (
    <main className="panel-content kit-screen">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <Button
          variant="secondary"
          busy={loading && lists !== null}
          onClick={() => setReload(v => v + 1)}
        >
          {text.refresh}
        </Button>
      </header>
      <StatCards
        loading={!lists}
        items={[
          {
            label: text.stats.pending,
            value: pending.length,
            sub: pending.length
              ? text.stats.oldest(hoursWaiting(pending))
              : text.stats.none,
            tone: 'warning',
          },
          {
            label: text.stats.pendingClubs,
            value: pending.filter(item => item.role === 'club').length,
            sub: text.stats.pendingOrganizers(
              pending.filter(item => item.role === 'organizer').length,
            ),
            tone: 'brand',
          },
          {
            label: text.stats.approved,
            value: lists?.approved.length ?? 0,
            share: decided ? (lists?.approved.length ?? 0) / decided : 0,
            tone: 'accent',
          },
          {
            label: text.stats.rejected,
            value: lists?.rejected.length ?? 0,
            share: decided ? (lists?.rejected.length ?? 0) / decided : 0,
            tone: 'danger',
          },
        ]}
      />
      <Feedback message={notice} success />
      <section className="kit-panel" aria-label={text.title}>
        <div className="kit-toolbar">
          <FilterTabs
            label={text.title}
            value={status}
            options={statuses.map(value => ({
              value,
              label: text.tabs[value],
              count: lists?.[value].length,
            }))}
            onChange={value => {
              setStatus(value);
              setPage(1);
            }}
          />
          <div className="kit-toolbar-end">
            <select
              className="kit-select"
              aria-label={text.roleFilter}
              value={role}
              onChange={event => {
                setRole(event.target.value as '' | ApplicationRole);
                setPage(1);
              }}
            >
              <option value="">{text.allRoles}</option>
              <option value="club">{text.roles.club}</option>
              <option value="organizer">{text.roles.organizer}</option>
            </select>
            <input
              className="kit-search-input"
              type="search"
              aria-label={text.search}
              placeholder={text.search}
              value={search}
              maxLength={100}
              onChange={event => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <Feedback message={loadError} />
        {!lists && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : !lists ? (
          <div className="empty">
            <Button variant="secondary" onClick={() => setReload(v => v + 1)}>
              {copy.form.retry}
            </Button>
          </div>
        ) : visible.length ? (
          <>
            <div className="table-scroll">
              <table className="kit-table">
                <thead>
                  <tr>
                    <th>{text.columns.applicant}</th>
                    <th>{text.columns.type}</th>
                    <th>{text.columns.contact}</th>
                    <th>{text.district}</th>
                    <th>{text.columns.submitted}</th>
                    <th>{text.columns.status}</th>
                    <th className="align-right">{copy.panel.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {slice(visible, current, pageSize).map(item => (
                    <tr
                      key={item.userId}
                      className="kit-row-link"
                      onClick={() => setOpen(item)}
                    >
                      <td>
                        <div className="kit-identity">
                          <Initials name={item.fullName} />
                          <div>
                            <strong>{item.fullName}</strong>
                            <span>{item.contactName || text.missing}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="kit-badges">
                          <Pill
                            tone={item.role === 'club' ? 'brand' : 'warning'}
                          >
                            {text.roles[item.role]}
                          </Pill>
                          {item.footballType && (
                            <Pill tone="muted">
                              {copy.football.types[item.footballType]}
                            </Pill>
                          )}
                        </div>
                      </td>
                      <td className="kit-soft">
                        <div className="kit-stack">
                          <span>{item.email || text.missing}</span>
                          <span className="muted">{item.phone}</span>
                        </div>
                      </td>
                      <td className="kit-soft">
                        {item.district || text.missing}
                      </td>
                      <td className="kit-soft">{ago(item.submittedAt)}</td>
                      <td>
                        <Pill tone={statusTone(item.status)}>
                          {text.tabs[item.status]}
                        </Pill>
                      </td>
                      <td className="align-right">
                        <button
                          type="button"
                          className="kit-action kit-action-primary"
                          onClick={event => {
                            event.stopPropagation();
                            setOpen(item);
                          }}
                        >
                          {item.status === 'pending' ? text.review : text.view}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={current}
              pageSize={pageSize}
              total={visible.length}
              onPage={setPage}
            />
          </>
        ) : (
          <div className="empty">
            <h2>
              {search || role ? copy.panel.emptySearch : text.empty[status]}
            </h2>
            <p className="muted">
              {search || role
                ? copy.panel.emptyFilterBody
                : text.emptyHint[status]}
            </p>
          </div>
        )}
      </section>
      {open && (
        <ApplicationDetail
          application={open}
          onClose={() => setOpen(null)}
          onDecide={(decision, reason) => decide(open, decision, reason)}
        />
      )}
    </main>
  );
}
