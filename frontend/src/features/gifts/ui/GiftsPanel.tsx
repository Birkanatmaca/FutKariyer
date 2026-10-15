import { useEffect, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { copy } from '../../../shared/lib/copy';
import type { Gift } from '../domain/models';
import type { GiftService } from '../application/gifts-service';
import { GiftForm } from './GiftForm';

function date(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function GiftsPanel({ service }: { service: GiftService }) {
  const [gifts, setGifts] = useState<Gift[] | null>(null);
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
        if (current) setGifts(value);
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
    setNotice(copy.gifts.sent(recipients));
    setRevision(value => value + 1);
  }

  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.gifts.eyebrow}</p>
          <h1>{copy.gifts.title}</h1>
          <p className="muted">{copy.gifts.hint}</p>
        </div>
        <Button
          variant="secondary"
          busy={loading && gifts !== null}
          onClick={() => setRevision(value => value + 1)}
        >
          {copy.gifts.refresh}
        </Button>
      </header>

      <section className="gift-section" aria-labelledby="gift-form-title">
        <div className="league-section-header">
          <div>
            <h2 id="gift-form-title">{copy.gifts.formTitle}</h2>
            <p className="muted">{copy.gifts.formHint}</p>
          </div>
        </div>
        <Feedback message={notice} success />
        <GiftForm service={service} onSent={handleSent} />
      </section>

      <section
        className="list-panel gift-history"
        aria-labelledby="gift-history"
      >
        <div className="league-section-header">
          <div>
            <h2 id="gift-history">{copy.gifts.history}</h2>
            <p className="muted">
              {gifts ? copy.panel.total(gifts.length) : copy.form.loading}
            </p>
          </div>
        </div>
        {gifts === null && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : gifts === null ? (
          <div className="empty">
            <Feedback message={error} />
            <Button
              variant="secondary"
              onClick={() => setRevision(value => value + 1)}
            >
              {copy.form.retry}
            </Button>
          </div>
        ) : gifts.length ? (
          <>
            <Feedback message={error} />
            <GiftTable items={gifts} />
          </>
        ) : (
          <div className="empty">
            <Feedback message={error} />
            <h2>{copy.gifts.empty}</h2>
            <p className="muted">{copy.gifts.emptyHint}</p>
          </div>
        )}
      </section>
    </main>
  );
}

function GiftTable({ items }: { items: Gift[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{copy.gifts.columns.title}</th>
            <th>{copy.gifts.columns.kind}</th>
            <th>{copy.gifts.columns.target}</th>
            <th>{copy.gifts.columns.validity}</th>
            <th>{copy.gifts.columns.recipients}</th>
            <th>{copy.gifts.columns.claimed}</th>
            <th>{copy.gifts.columns.date}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>
                <strong>{item.title}</strong>
              </td>
              <td>{copy.gifts.kinds[item.kind]}</td>
              <td>
                {item.audience === 'all'
                  ? copy.gifts.audienceAll
                  : item.targetEmail || copy.gifts.audienceAccount}
              </td>
              <td>{copy.gifts.days(item.validityDays)}</td>
              <td>{item.recipients.toLocaleString('tr-TR')}</td>
              <td>{item.claimed.toLocaleString('tr-TR')}</td>
              <td>{date(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
