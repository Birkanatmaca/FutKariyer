import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { League, LeagueStatus, Page } from '../domain/models';
import type { LeagueService } from '../application/league-service';
import { LeagueEditor } from './LeagueEditor';
import { LeagueWorkspace } from './LeagueWorkspace';

const filters: ('all' | LeagueStatus)[] = [
  'all',
  'active',
  'draft',
  'finished',
];

// Ligler (21 Oct 2026 design): leagues as cards with a status filter; a card
// opens the league, creating and editing happen in a modal.
export function LeaguesPanel({ service }: { service: LeagueService }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Page<League> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | LeagueStatus>('all');
  const [editor, setEditor] = useState<{ league?: League } | null>(null);
  const [selected, setSelected] = useState<League | null>(null);
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
  if (selected)
    return (
      <LeagueWorkspace
        service={service}
        initial={selected}
        onBack={() => {
          setSelected(null);
          setRevision(value => value + 1);
        }}
      />
    );
  const items =
    data?.items.filter(item => filter === 'all' || item.status === filter) ??
    [];
  return (
    <main className="panel-content lg">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.leagues.eyebrow}</p>
          <h1>{copy.panel.leagues}</h1>
          <p className="muted">{copy.leagues.hint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && data !== null}
            onClick={() => setRevision(value => value + 1)}
          >
            {copy.leagues.refresh}
          </Button>
          <Button onClick={() => setEditor({})}>+ {copy.leagues.create}</Button>
        </div>
      </header>

      <div
        className="application-tabs"
        role="tablist"
        aria-label={copy.leagues.status}
      >
        {filters.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className="application-tab"
            onClick={() => setFilter(value)}
          >
            {copy.leagues.filters[value]}
            {data && (
              <span className="lg-tab-count">
                {value === 'all'
                  ? data.items.length
                  : data.items.filter(item => item.status === value).length}
              </span>
            )}
          </button>
        ))}
      </div>

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
          <h3>{copy.leagues.empty}</h3>
          <p className="muted">{copy.leagues.emptyHint}</p>
          <Button onClick={() => setEditor({})}>+ {copy.leagues.create}</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rt-empty">
          <p className="muted">{copy.leagues.filteredEmpty}</p>
        </div>
      ) : (
        <div className="lg-grid">
          {items.map(item => (
            <article className={'lg-card lg-card-' + item.status} key={item.id}>
              <button
                type="button"
                className="lg-card-open"
                onClick={() => setSelected(item)}
              >
                <span className="lg-card-head">
                  <span className={'league-status ' + item.status}>
                    {copy.leagues[item.status]}
                  </span>
                  <span className="lg-season">{item.season}</span>
                </span>
                <strong className="lg-card-title">{item.name}</strong>
                {item.description && (
                  <span className="lg-card-text">{item.description}</span>
                )}
                <span className="lg-card-rules">
                  {copy.leagues.rules(
                    item.winPoints,
                    item.drawPoints,
                    item.lossPoints,
                  )}
                </span>
              </button>
              <div className="lg-card-actions">
                <Button
                  variant="secondary"
                  className="button-small"
                  onClick={() => setEditor({ league: item })}
                >
                  {copy.content.edit}
                </Button>
                <Button
                  className="button-small"
                  onClick={() => setSelected(item)}
                >
                  {copy.leagues.open} →
                </Button>
              </div>
            </article>
          ))}
        </div>
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
      {editor && (
        <LeagueEditor
          league={editor.league}
          service={service}
          onClose={() => setEditor(null)}
          onDone={() => {
            setEditor(null);
            setRevision(value => value + 1);
          }}
        />
      )}
    </main>
  );
}
