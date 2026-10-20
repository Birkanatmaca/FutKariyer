import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { PopupService } from '../application/popup-service';
import { popupSizes, type Popup, type PopupPage } from '../domain/models';
import { PopupEditor } from './PopupEditor';

const text = copy.popups;

export function PopupPanel({ service }: { service: PopupService }) {
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<PopupPage | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [editor, setEditor] = useState<{ item?: Popup } | null>(null);
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
  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.content.eyebrow}</p>
          <h1>{copy.panel.popups}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <Button onClick={() => setEditor({})}>{text.create}</Button>
      </header>
      <section className="list-panel" aria-label={copy.panel.popups}>
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
                  <th>{text.format}</th>
                  <th>{copy.content.status}</th>
                  <th>{text.frequency}</th>
                  <th>{text.stats}</th>
                  <th>{copy.panel.actions}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="content-identity">
                        <img
                          className="content-thumb"
                          src={service.imageUrl(item.imageId)}
                          alt=""
                        />
                        <strong>{item.title}</strong>
                      </div>
                    </td>
                    <td>
                      {text.formats[item.format]}
                      <span className="muted popup-size">
                        {popupSizes[item.format].width}×
                        {popupSizes[item.format].height}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          'status-badge ' +
                          (item.active ? 'active' : 'inactive')
                        }
                      >
                        {item.active ? copy.content.live : copy.content.draft}
                      </span>
                    </td>
                    <td>{text.summary(item.intervalMinutes, item.maxViews)}</td>
                    <td>{text.reach(item.views, item.viewers)}</td>
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
            <h2>{text.empty}</h2>
            <p>{text.emptyHint}</p>
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
        <PopupEditor
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
