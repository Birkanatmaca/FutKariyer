import { useEffect, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import {
  FilterTabs,
  Pager,
  Pill,
  StatCards,
  slice,
} from '../../../shared/ui/kit';
import { windowLabel } from '../../../shared/ui/media';
import type { PopupService } from '../application/popup-service';
import { popupSizes, type Popup } from '../domain/models';
import { PopupEditor } from './PopupEditor';
import {
  PopupPhone,
  popupState,
  stateTone,
  type PopupState,
} from './PopupParts';

const text = copy.popups;
const pageSize = 12;
type Filter = 'all' | PopupState;

export function PopupPanel({ service }: { service: PopupService }) {
  const [items, setItems] = useState<Popup[] | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [filter, setFilter] = useState<Filter>('all'),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<{ item?: Popup } | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .listAll()
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
  const counts: Record<Filter, number> = {
    all: all.length,
    live: 0,
    scheduled: 0,
    expired: 0,
    off: 0,
  };
  for (const item of all) counts[popupState(item)]++;
  // The app shows the most recently updated live popup at launch.
  const showing = all
    .filter(item => popupState(item) === 'live')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  const views = all.reduce((sum, item) => sum + item.views, 0);
  const viewers = all.reduce((sum, item) => sum + item.viewers, 0);
  const visible = all.filter(
    item => filter === 'all' || popupState(item) === filter,
  );
  const lastPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, lastPage);

  function done(message: string) {
    setEditor(null);
    setNotice(message);
    setRevision(v => v + 1);
  }

  return (
    <main className="panel-content kit-screen">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.content.eyebrow}</p>
          <h1>{copy.panel.popups}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && items !== null}
            onClick={() => setRevision(v => v + 1)}
          >
            {copy.panel.refresh}
          </Button>
          <Button onClick={() => setEditor({})}>+ {text.create}</Button>
        </div>
      </header>
      <StatCards
        loading={!items}
        items={[
          {
            label: text.statsLive,
            value: counts.live,
            sub: text.statsScheduled(counts.scheduled),
            tone: 'accent',
          },
          {
            label: text.statsViews,
            value: views,
            sub: text.statsAll,
            tone: 'brand',
          },
          {
            label: text.statsViewers,
            value: viewers,
            sub: viewers
              ? text.statsPerViewer((views / viewers).toFixed(1))
              : text.statsNone,
            tone: 'info',
          },
          {
            label: text.statsOff,
            value: counts.off + counts.expired,
            sub: text.statsExpired(counts.expired),
            tone: 'muted',
          },
        ]}
      />
      <Feedback message={notice} success />
      <Feedback message={error} />
      <section className="ct-showcase" aria-labelledby="popup-now-title">
        <div className="ct-showcase-list">
          <div className="ct-showcase-head">
            <div>
              <h2 id="popup-now-title">{text.nowTitle}</h2>
              <p className="muted">{text.nowHint}</p>
            </div>
          </div>
          {showing ? (
            <div className="pp-now">
              <dl className="kit-details">
                <div>
                  <dt>{text.name}</dt>
                  <dd>{showing.title}</dd>
                </div>
                <div>
                  <dt>{text.format}</dt>
                  <dd>
                    {text.formats[showing.format]} ·{' '}
                    {popupSizes[showing.format].width}×
                    {popupSizes[showing.format].height}
                  </dd>
                </div>
                <div>
                  <dt>{text.frequency}</dt>
                  <dd>
                    {text.summary(showing.intervalMinutes, showing.maxViews)}
                  </dd>
                </div>
                <div>
                  <dt>{text.window}</dt>
                  <dd>{windowLabel(showing)}</dd>
                </div>
                <div>
                  <dt>{text.stats}</dt>
                  <dd>{text.reach(showing.views, showing.viewers)}</dd>
                </div>
              </dl>
              <div className="kit-row-actions">
                <button
                  type="button"
                  className="kit-action kit-action-primary"
                  onClick={() => setEditor({ item: showing })}
                >
                  {copy.panel.edit}
                </button>
              </div>
              {counts.live > 1 && (
                <p className="hint">{text.othersWaiting(counts.live - 1)}</p>
              )}
            </div>
          ) : (
            <p className="muted ct-empty-loop">
              {items ? text.nothingLive : copy.form.loading}
            </p>
          )}
        </div>
        <PopupPhone
          imageSrc={showing ? service.imageUrl(showing.imageId) : null}
          format={showing?.format ?? null}
          caption={text.previewCaption}
        />
      </section>
      <section className="kit-panel" aria-label={copy.panel.popups}>
        <div className="kit-toolbar">
          <FilterTabs
            label={copy.content.status}
            value={filter}
            options={(
              ['all', 'live', 'scheduled', 'expired', 'off'] as Filter[]
            ).map(value => ({
              value,
              label: value === 'all' ? copy.kit.all : text.states[value],
              count: items ? counts[value] : undefined,
            }))}
            onChange={value => {
              setFilter(value);
              setPage(1);
            }}
          />
        </div>
        {!items && loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : visible.length ? (
          <>
            <div className="ct-grid pp-grid">
              {slice(visible, current, pageSize).map(item => {
                const state = popupState(item);
                const cap = item.viewers * item.maxViews;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="ct-card pp-card"
                    onClick={() => setEditor({ item })}
                  >
                    <span className="pp-card-image">
                      <img
                        src={service.imageUrl(item.imageId)}
                        alt=""
                        loading="lazy"
                        style={{
                          aspectRatio:
                            popupSizes[item.format].width +
                            ' / ' +
                            popupSizes[item.format].height,
                        }}
                      />
                      {item === showing && (
                        <span className="ct-card-rank">{text.showingNow}</span>
                      )}
                    </span>
                    <span className="ct-card-body">
                      <span className="ct-card-head">
                        <strong>{item.title}</strong>
                        <Pill tone={stateTone[state]}>
                          {text.states[state]}
                        </Pill>
                      </span>
                      <span className="ct-card-meta">
                        <span>{text.formats[item.format]}</span>
                        <span>{text.reach(item.views, item.viewers)}</span>
                      </span>
                      <span
                        className="kit-stat-bar tone-brand"
                        aria-hidden="true"
                      >
                        <span
                          style={{
                            width:
                              (cap
                                ? Math.min(100, (item.views / cap) * 100)
                                : 0) + '%',
                          }}
                        />
                      </span>
                      <span className="muted ct-card-window">
                        {text.summary(item.intervalMinutes, item.maxViews)}
                      </span>
                      <span className="muted ct-card-window">
                        {windowLabel(item)}
                      </span>
                    </span>
                  </button>
                );
              })}
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
      {editor && (
        <PopupEditor
          key={editor.item?.id || 'new'}
          item={editor.item}
          service={service}
          onClose={() => setEditor(null)}
          onDone={done}
        />
      )}
    </main>
  );
}
