import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { League, Page } from '../domain/models';
import type { LeagueService } from '../application/league-service';
import { LeagueEditor } from './LeagueEditor';
import { LeagueWorkspace } from './LeagueWorkspace';

export function LeaguesPanel({ service }: { service: LeagueService }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Page<League> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ league?: League } | null>(null);
  const [selected, setSelected] = useState<League | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setData(null);
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
  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.leagues.eyebrow}</p>
          <h1>{copy.panel.leagues}</h1>
          <p className="muted">{copy.leagues.hint}</p>
        </div>
        <Button onClick={() => setEditor({})}>{copy.leagues.create}</Button>
      </header>
      <section className="list-panel" aria-label={copy.panel.leagues}>
        <div className="toolbar">
          <span>{data ? copy.panel.total(data.total) : copy.form.loading}</span>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => setRevision(value => value + 1)}
          >
            {copy.leagues.refresh}
          </Button>
        </div>
        {loading ? (
          <div className="empty" role="status">
            {copy.form.loading}
          </div>
        ) : error ? (
          <div className="empty">
            <Feedback message={error} />
            <Button onClick={() => setRevision(value => value + 1)}>
              {copy.form.retry}
            </Button>
          </div>
        ) : data?.items.length ? (
          <div className="league-list">
            {data.items.map(item => (
              <article className="league-list-card" key={item.id}>
                <div className="league-list-main">
                  <span className={'league-status ' + item.status}>
                    {copy.leagues[item.status]}
                  </span>
                  <h2>{item.name}</h2>
                  <p>{item.season}</p>
                  {item.description && (
                    <p className="muted">{item.description}</p>
                  )}
                </div>
                <div className="action-row">
                  <Button
                    variant="secondary"
                    className="button-small"
                    onClick={() => setEditor({ league: item })}
                  >
                    {copy.leagues.edit}
                  </Button>
                  <Button
                    className="button-small"
                    onClick={() => setSelected(item)}
                  >
                    {copy.leagues.open}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>{copy.leagues.empty}</h2>
            <p>{copy.leagues.emptyHint}</p>
          </div>
        )}
        {data && (
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
      </section>
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
