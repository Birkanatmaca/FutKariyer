import { useEffect, useState } from 'react';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { Tournament } from '../domain/models';
import type { TournamentService } from '../application/tournament-service';
import { TournamentCreateModal } from './TournamentCreateModal';
import { dayLabel } from './format';

const text = organizerCopy.list;

// Turnuvalarım: the organizer's own tournaments as cards; a card opens the
// tournament workspace, "Turnuva aç" opens the create form in a modal.
export function TournamentsPanel({
  service,
  onOpen,
}: {
  service: TournamentService;
  onOpen(id: string): void;
}) {
  const [items, setItems] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .mine()
      .then(value => current && setItems(value))
      .catch(failure => {
        if (current)
          setError(
            failure instanceof Error
              ? failure.message
              : organizerCopy.form.unexpected,
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, revision]);
  return (
    <main className="panel-content lg">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{organizerCopy.shell.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && items !== null}
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
            {organizerCopy.form.retry}
          </Button>
        </div>
      ) : items === null ? (
        <div className="empty" role="status">
          <span className="spinner" />
          <p>{organizerCopy.form.loading}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rt-empty">
          <h3>{text.empty}</h3>
          <p className="muted">{text.emptyHint}</p>
          <Button onClick={() => setCreating(true)}>+ {text.create}</Button>
        </div>
      ) : (
        <div className="lg-grid">
          {items.map(item => (
            <article
              key={item.id}
              className={
                'lg-card' + (item.status === 'closed' ? ' lg-card-active' : '')
              }
            >
              <a
                className="lg-card-open"
                href={'/organizasyon/' + item.id}
                onClick={event => {
                  if (
                    event.button === 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey
                  ) {
                    event.preventDefault();
                    onOpen(item.id);
                  }
                }}
              >
                <span className="lg-card-head">
                  <span className={'org-status org-status-' + item.status}>
                    {organizerCopy.status[item.status]}
                  </span>
                  <span className="lg-season">
                    {organizerCopy.formats[item.format]}
                  </span>
                </span>
                <strong className="lg-card-title">{item.name}</strong>
                <span className="lg-card-rules">
                  {text.dates(dayLabel(item.startsOn), dayLabel(item.endsOn))}
                  {(item.district || item.venue) &&
                    ' · ' +
                      [item.district, item.venue].filter(Boolean).join(', ')}
                </span>
                <span className="lg-card-rules">
                  {text.teams(item.acceptedTeams, item.teamCapacity)}
                  {item.status === 'open' &&
                    ' · ' + text.deadline(dayLabel(item.applicationDeadline))}
                </span>
                {item.pendingEntries > 0 && (
                  <span className="org-pending">
                    {text.pending(item.pendingEntries)}
                  </span>
                )}
              </a>
            </article>
          ))}
        </div>
      )}
      {creating && (
        <TournamentCreateModal
          service={service}
          onClose={() => setCreating(false)}
          onDone={notified => {
            setCreating(false);
            setSuccess(organizerCopy.create.created(notified));
            setRevision(value => value + 1);
          }}
        />
      )}
    </main>
  );
}
