import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { ContentService } from '../application/content-service';
import type { Article, ReviewDecision } from '../domain/models';

const previewLength = 240;

function preview(text: string) {
  return text.length > previewLength
    ? text.slice(0, previewLength).trimEnd() + '…'
    : text;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ReviewQueue({
  service,
  revision,
  onDecided,
}: {
  service: ContentService;
  revision: number;
  onDecided(): void;
}) {
  const [items, setItems] = useState<Article[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<string | null>(null),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState<{
      id: string;
      decision: ReviewDecision;
    } | null>(null),
    [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    service
      .listPendingReviews()
      .then(value => {
        if (current) setItems(value);
      })
      .catch(failure => {
        if (current)
          setLoadError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, revision, reload]);

  async function decide(article: Article, decision: ReviewDecision) {
    if (busy) return;
    setBusy({ id: article.id, decision });
    setActionError(null);
    try {
      await service.review(article.id, decision);
      setItems(current => current.filter(item => item.id !== article.id));
      onDecided();
    } catch (failure) {
      setActionError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      setReload(v => v + 1);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="list-panel review-queue"
      aria-labelledby="review-queue-title"
    >
      <header className="toolbar">
        <div>
          <h2 id="review-queue-title">{copy.content.reviewTitle}</h2>
          <p className="hint">{copy.content.reviewHint}</p>
        </div>
      </header>
      <Feedback message={actionError} />
      {loading ? (
        <p className="muted" role="status">
          {copy.form.loading}
        </p>
      ) : loadError ? (
        <div className="review-empty">
          <Feedback message={loadError} />
          <Button variant="secondary" onClick={() => setReload(v => v + 1)}>
            {copy.form.retry}
          </Button>
        </div>
      ) : items.length ? (
        <ul className="review-list">
          {items.map(article => (
            <li key={article.id} className="review-item">
              <div className="review-meta">
                <strong>{article.title}</strong>
                {article.authorName && (
                  <span className="content-club">
                    {copy.content.club(article.authorName)}
                  </span>
                )}
                <time dateTime={article.createdAt}>
                  {formatDate(article.createdAt)}
                </time>
              </div>
              <p>{article.summary}</p>
              <p className="review-preview">
                <span className="hint">{copy.content.reviewBody}: </span>
                {preview(article.body)}
              </p>
              <div className="action-row">
                <Button
                  className="button-small"
                  busy={busy?.id === article.id && busy.decision === 'approve'}
                  disabled={!!busy}
                  onClick={() => decide(article, 'approve')}
                >
                  {copy.content.reviewApprove}
                </Button>
                <Button
                  variant="danger"
                  className="button-small"
                  busy={busy?.id === article.id && busy.decision === 'reject'}
                  disabled={!!busy}
                  onClick={() => decide(article, 'reject')}
                >
                  {copy.content.reviewReject}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted review-empty">{copy.content.reviewEmpty}</p>
      )}
    </section>
  );
}
