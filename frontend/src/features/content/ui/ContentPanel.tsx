import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { ContentService } from '../application/content-service';
import type {
  ContentItem,
  ContentPage,
  ContentSection,
} from '../domain/models';
import { ContentEditor } from './ContentEditor';
import { ReviewQueue } from './ReviewQueue';
export function ContentPanel({
  section,
  service,
}: {
  section: ContentSection;
  service: ContentService;
}) {
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<ContentPage | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [editor, setEditor] = useState<{ item?: ContentItem } | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setData(null);
    service
      .list(section, page)
      .then(value => {
        if (current) {
          if (page > Math.max(1, value.totalPages))
            setPage(Math.max(1, value.totalPages));
          else setData(value);
        }
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
  }, [service, section, page, revision]);
  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.content.eyebrow}</p>
          <h1>{copy.panel[section]}</h1>
          <p className="muted">
            {copy.content[(section + 'Hint') as 'adsHint' | 'newsHint']}
          </p>
        </div>
        <Button onClick={() => setEditor({})}>
          {section === 'ads' ? copy.content.newAd : copy.content.newNews}
        </Button>
      </header>
      {section === 'news' && (
        <ReviewQueue
          service={service}
          revision={revision}
          onDecided={() => setRevision(v => v + 1)}
        />
      )}
      <section className="list-panel" aria-label={copy.panel[section]}>
        <div className="toolbar">
          <span>{data ? copy.panel.total(data.total) : copy.form.loading}</span>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => setRevision(v => v + 1)}
          >
            {copy.panel.refresh}
          </Button>
        </div>
        {loading ? (
          <div className="empty" role="status">
            {copy.form.loading}
          </div>
        ) : error ? (
          <div className="empty">
            <Feedback message={error} />
            <Button onClick={() => setRevision(v => v + 1)}>
              {copy.form.retry}
            </Button>
          </div>
        ) : data?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{copy.content.title}</th>
                  <th>{copy.content.status}</th>
                  <th>
                    {section === 'ads'
                      ? copy.content.order
                      : copy.content.showOnHome}
                  </th>
                  <th>{copy.panel.actions}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="content-identity">
                        {item.imageId && (
                          <img
                            className="content-thumb"
                            src={service.imageUrl(item.imageId)}
                            alt=""
                          />
                        )}
                        <div>
                          <strong>{item.title}</strong>
                          {'body' in item && item.authorName && (
                            <span className="content-club">
                              {copy.content.club(item.authorName)}
                              {item.reviewStatus && (
                                <span
                                  className={
                                    'status-badge ' + item.reviewStatus
                                  }
                                >
                                  {copy.content.reviewStatus[item.reviewStatus]}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {('active' in item ? item.active : item.published)
                        ? copy.content.live
                        : copy.content.draft}
                    </td>
                    <td>
                      {'sortOrder' in item
                        ? item.sortOrder
                        : item.showOnHome
                        ? copy.content.yes
                        : copy.content.no}
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        className="button-small"
                        onClick={() => setEditor({ item })}
                      >
                        {copy.content.edit}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h2>{copy.content.empty}</h2>
            <p>{copy.content.emptyHint}</p>
          </div>
        )}
        {data && (
          <footer className="pagination">
            <span>{copy.panel.page(page, data.totalPages)}</span>
            <div className="action-row">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(v => v - 1)}
              >
                {copy.panel.previous}
              </Button>
              <Button
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage(v => v + 1)}
              >
                {copy.panel.next}
              </Button>
            </div>
          </footer>
        )}
      </section>
      {editor && (
        <ContentEditor
          section={section}
          service={service}
          item={editor.item}
          onClose={() => setEditor(null)}
          onDone={() => {
            setEditor(null);
            setRevision(v => v + 1);
          }}
        />
      )}
    </main>
  );
}
