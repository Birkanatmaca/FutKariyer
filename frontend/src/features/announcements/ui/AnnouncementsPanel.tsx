import { useEffect, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { copy } from '../../../shared/lib/copy';
import type { Announcement } from '../domain/models';
import type { AnnouncementService } from '../application/announcements-service';
import { AnnouncementForm } from './AnnouncementForm';

const excerptLength = 120;

function date(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function excerpt(value: string) {
  return value.length > excerptLength
    ? value.slice(0, excerptLength - 1) + '…'
    : value;
}

export function AnnouncementsPanel({
  service,
}: {
  service: AnnouncementService;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .list()
      .then(value => {
        if (current) setAnnouncements(value);
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

  function handleSent(recipients: number) {
    setNotice(copy.announcements.sent(recipients));
    setRevision(value => value + 1);
  }

  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.announcements.eyebrow}</p>
          <h1>{copy.announcements.title}</h1>
          <p className="muted">{copy.announcements.hint}</p>
        </div>
        <Button
          variant="secondary"
          busy={loading && announcements !== null}
          onClick={() => setRevision(value => value + 1)}
        >
          {copy.announcements.refresh}
        </Button>
      </header>

      <section
        className="gift-section"
        aria-labelledby="announcement-form-title"
      >
        <div className="league-section-header">
          <div>
            <h2 id="announcement-form-title">{copy.announcements.formTitle}</h2>
            <p className="muted">{copy.announcements.formHint}</p>
          </div>
        </div>
        <Feedback message={notice} success />
        <AnnouncementForm service={service} onSent={handleSent} />
      </section>

      <section
        className="list-panel announcement-history"
        aria-labelledby="announcement-history"
      >
        <div className="league-section-header">
          <div>
            <h2 id="announcement-history">{copy.announcements.history}</h2>
            <p className="muted">
              {announcements
                ? copy.panel.total(announcements.length)
                : copy.form.loading}
            </p>
          </div>
        </div>
        {announcements === null && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : announcements === null ? (
          <div className="empty">
            <Feedback message={error} />
            <Button
              variant="secondary"
              onClick={() => setRevision(value => value + 1)}
            >
              {copy.form.retry}
            </Button>
          </div>
        ) : announcements.length ? (
          <>
            <Feedback message={error} />
            <AnnouncementTable items={announcements} />
          </>
        ) : (
          <div className="empty">
            <Feedback message={error} />
            <h2>{copy.announcements.empty}</h2>
            <p className="muted">{copy.announcements.emptyHint}</p>
          </div>
        )}
      </section>
    </main>
  );
}

function AnnouncementTable({ items }: { items: Announcement[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{copy.announcements.columns.title}</th>
            <th>{copy.announcements.columns.body}</th>
            <th>{copy.announcements.columns.target}</th>
            <th>{copy.announcements.columns.recipients}</th>
            <th>{copy.announcements.columns.date}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>
                <strong>{item.title}</strong>
              </td>
              <td className="announcement-body">{excerpt(item.body)}</td>
              <td>
                {item.audience === 'account'
                  ? item.targetEmail || copy.announcements.audiences.account
                  : copy.announcements.audiences[item.audience]}
              </td>
              <td>{item.recipients.toLocaleString('tr-TR')}</td>
              <td>{date(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
