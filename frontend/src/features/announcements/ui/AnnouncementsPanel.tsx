import { useEffect, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Modal } from '../../../shared/ui/Modal';
import { copy } from '../../../shared/lib/copy';
import {
  FilterTabs,
  Pager,
  Pill,
  StatCards,
  ago,
  dateTime,
  slice,
  type Tone,
} from '../../../shared/ui/kit';
import type { Announcement, AnnouncementAudience } from '../domain/models';
import type { AnnouncementService } from '../application/announcements-service';
import {
  AnnouncementComposer,
  NotificationPhone,
  audiences,
} from './AnnouncementComposer';

const text = copy.announcements;
const pageSize = 12;
const audienceTone: Record<AnnouncementAudience, Tone> = {
  all: 'brand',
  player: 'accent',
  club: 'warning',
  coach: 'info',
  account: 'muted',
};

function target(item: Announcement) {
  return item.audience === 'account'
    ? item.targetEmail || text.audiences.account
    : text.audiences[item.audience];
}

export function AnnouncementsPanel({
  service,
}: {
  service: AnnouncementService;
}) {
  const [items, setItems] = useState<Announcement[] | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [filter, setFilter] = useState<'' | AnnouncementAudience>(''),
    [page, setPage] = useState(1),
    [composing, setComposing] = useState(false),
    [open, setOpen] = useState<Announcement | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .list()
      .then(value => {
        if (current) setItems(value);
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
  }, [service, revision]);

  const all = items ?? [];
  const now = Date.now();
  const recent = all.filter(
    item => now - Date.parse(item.createdAt) < 30 * 86400000,
  );
  const reached = all.reduce((sum, item) => sum + item.recipients, 0);
  const visible = all.filter(item => !filter || item.audience === filter);
  const lastPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, lastPage);

  return (
    <main className="panel-content kit-screen">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && items !== null}
            onClick={() => setRevision(v => v + 1)}
          >
            {text.refresh}
          </Button>
          <Button onClick={() => setComposing(true)}>+ {text.newButton}</Button>
        </div>
      </header>
      <StatCards
        loading={!items}
        items={[
          {
            label: text.stats.total,
            value: all.length,
            sub: text.stats.last(all[0] ? ago(all[0].createdAt) : '—'),
            tone: 'brand',
          },
          {
            label: text.stats.reached,
            value: reached,
            sub: text.stats.average(
              all.length ? Math.round(reached / all.length) : 0,
            ),
            tone: 'accent',
          },
          {
            label: text.stats.month,
            value: recent.length,
            sub: text.stats.monthReach(
              recent.reduce((sum, item) => sum + item.recipients, 0),
            ),
            tone: 'info',
          },
          {
            label: text.stats.direct,
            value: all.filter(item => item.audience === 'account').length,
            sub: text.stats.directSub,
            tone: 'warning',
          },
        ]}
      />
      <Feedback message={notice} success />
      <section className="kit-panel" aria-label={text.history}>
        <div className="kit-toolbar">
          <FilterTabs
            label={text.audience}
            value={filter}
            options={[
              {
                value: '' as const,
                label: copy.kit.all,
                count: items ? all.length : undefined,
              },
              ...audiences.map(value => ({
                value,
                label: text.audienceShort[value],
                count: items
                  ? all.filter(item => item.audience === value).length
                  : undefined,
              })),
            ]}
            onChange={value => {
              setFilter(value);
              setPage(1);
            }}
          />
        </div>
        <Feedback message={error} />
        {!items && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : visible.length ? (
          <>
            <div className="table-scroll">
              <table className="kit-table">
                <thead>
                  <tr>
                    <th>{text.columns.title}</th>
                    <th>{text.columns.target}</th>
                    <th>{text.columns.recipients}</th>
                    <th>{text.columns.date}</th>
                    <th className="align-right">{copy.panel.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {slice(visible, current, pageSize).map(item => (
                    <tr
                      key={item.id}
                      className="kit-row-link"
                      onClick={() => setOpen(item)}
                    >
                      <td className="kit-wrap">
                        <div className="ct-loop-text an-row">
                          <strong>{item.title}</strong>
                          <span className="muted">{item.body}</span>
                        </div>
                      </td>
                      <td>
                        <Pill tone={audienceTone[item.audience]}>
                          {target(item)}
                        </Pill>
                      </td>
                      <td className="kit-soft">
                        <strong className="an-count">
                          {item.recipients.toLocaleString('tr-TR')}
                        </strong>{' '}
                        {text.accounts}
                      </td>
                      <td className="kit-soft" title={dateTime(item.createdAt)}>
                        {ago(item.createdAt)}
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
                          {text.view}
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
            <h2>{text.empty}</h2>
            <p className="muted">{text.emptyHint}</p>
          </div>
        )}
      </section>
      {composing && (
        <AnnouncementComposer
          service={service}
          onClose={() => setComposing(false)}
          onSent={recipients => {
            setComposing(false);
            setNotice(text.sent(recipients));
            setRevision(v => v + 1);
          }}
        />
      )}
      {open && (
        <Modal
          title={open.title}
          eyebrow={text.detailEyebrow}
          size="lg"
          onClose={() => setOpen(null)}
        >
          <div className="ct-editor">
            <div className="kit-form">
              <dl className="kit-details">
                <div>
                  <dt>{text.audience}</dt>
                  <dd>{target(open)}</dd>
                </div>
                <div>
                  <dt>{text.columns.recipients}</dt>
                  <dd>
                    {open.recipients.toLocaleString('tr-TR')} {text.accounts}
                  </dd>
                </div>
                <div>
                  <dt>{text.columns.date}</dt>
                  <dd>{dateTime(open.createdAt)}</dd>
                </div>
              </dl>
              <div className="kit-note">
                <span className="kit-form-title">{text.body}</span>
                <p>{open.body}</p>
              </div>
              <p className="hint">{text.locked}</p>
            </div>
            <aside className="ct-preview">
              <NotificationPhone title={open.title} body={open.body} />
            </aside>
          </div>
        </Modal>
      )}
    </main>
  );
}
