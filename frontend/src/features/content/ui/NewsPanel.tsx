import { useEffect, useMemo, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Modal } from '../../../shared/ui/Modal';
import {
  FilterTabs,
  Pager,
  StatCards,
  ago,
  slice,
} from '../../../shared/ui/kit';
import type { ContentService } from '../application/content-service';
import type { Article, ReviewDecision } from '../domain/models';
import { NewsEditor, articleForm } from './NewsEditor';
import {
  LoopList,
  NewsPhone,
  StatePill,
  itemState,
  windowLabel,
  type ItemState,
} from './parts';

const text = copy.content;
const pageSize = 12;
// The app's home loop plays the first page of live news.
const loopSize = 20;
type Filter = 'all' | ItemState;

function stateOf(item: Article, now: number): ItemState {
  return item.reviewStatus === 'pending'
    ? 'pending'
    : itemState(item.published, item, now);
}

function byPriority(a: Article, b: Article) {
  return (
    a.sortOrder - b.sortOrder ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    (a.id < b.id ? 1 : -1)
  );
}

export function NewsPanel({ service }: { service: ContentService }) {
  const [items, setItems] = useState<Article[] | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [filter, setFilter] = useState<Filter>('all'),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<{ item?: Article } | null>(null),
    [reviewing, setReviewing] = useState<Article | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [moving, setMoving] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .listAll('news')
      .then(value => {
        if (current) setItems(value as Article[]);
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

  const now = Date.now();
  const all = useMemo(() => [...(items ?? [])].sort(byPriority), [items]);
  const loop = useMemo(
    () => all.filter(item => stateOf(item, now) === 'live').slice(0, loopSize),
    // now changes every render; the loop only needs to follow the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all],
  );
  const counts = useMemo(() => {
    const out: Record<Filter, number> = {
      all: all.length,
      live: 0,
      scheduled: 0,
      expired: 0,
      draft: 0,
      pending: 0,
    };
    for (const item of all) out[stateOf(item, now)]++;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return all.filter(
      item =>
        (filter === 'all' || stateOf(item, now) === filter) &&
        (!term ||
          (item.title + ' ' + item.summary + ' ' + (item.authorName || ''))
            .toLocaleLowerCase('tr-TR')
            .includes(term)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, filter, search]);
  const lastPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, lastPage);
  const shown = loop.find(item => item.id === selected) ?? loop[0];
  const shownIndex = shown ? loop.indexOf(shown) : -1;
  const loopSeconds = loop.reduce((sum, item) => sum + item.displaySeconds, 0);
  const firstOrder = Math.max(0, (all[0]?.sortOrder ?? 100) - 10);

  function done(message: string) {
    setEditor(null);
    setReviewing(null);
    setNotice(message);
    setRevision(v => v + 1);
  }

  // Moving an item renumbers the loop in steps of ten and saves only the
  // articles whose priority changed.
  async function move(from: number, to: number) {
    if (moving) return;
    const next = [...loop];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMoving(true);
    setError(null);
    try {
      for (const [index, article] of next.entries()) {
        const order = (index + 1) * 10;
        if (article.sortOrder !== order)
          await service.save(
            'news',
            { ...articleForm(article), sortOrder: order },
            article.id,
          );
      }
      setSelected(item.id);
      setNotice(text.reordered);
      setRevision(v => v + 1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      setRevision(v => v + 1);
    } finally {
      setMoving(false);
    }
  }

  return (
    <main className="panel-content kit-screen">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{copy.panel.news}</h1>
          <p className="muted">{text.newsHint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && items !== null}
            onClick={() => setRevision(v => v + 1)}
          >
            {copy.panel.refresh}
          </Button>
          <Button onClick={() => setEditor({})}>+ {text.newNews}</Button>
        </div>
      </header>
      <StatCards
        loading={!items}
        items={[
          {
            label: text.stats.live,
            value: counts.live,
            sub: text.stats.inLoop(loop.length),
            tone: 'accent',
          },
          {
            label: text.stats.loop,
            value: copy.kit.seconds(loopSeconds),
            sub: text.stats.loopSub,
            tone: 'brand',
          },
          {
            label: text.stats.scheduled,
            value: counts.scheduled,
            sub: text.stats.expiredSub(counts.expired),
            tone: 'info',
          },
          {
            label: text.stats.drafts,
            value: counts.draft,
            tone: 'muted',
          },
          {
            label: text.stats.pending,
            value: counts.pending,
            sub: text.stats.pendingSub,
            tone: 'warning',
          },
        ]}
      />
      <Feedback message={notice} success />
      <Feedback message={error} />
      <section className="ct-showcase" aria-labelledby="news-loop-title">
        <div className="ct-showcase-list">
          <div className="ct-showcase-head">
            <div>
              <h2 id="news-loop-title">{text.loopTitle}</h2>
              <p className="muted">{text.newsLoopHint}</p>
            </div>
          </div>
          {loop.length ? (
            <LoopList
              items={loop}
              selected={shown?.id ?? null}
              busy={moving}
              onSelect={item => setSelected(item.id)}
              onMove={move}
              render={item => (
                <>
                  <span className="ct-loop-thumb">
                    {item.imageId ? (
                      <img src={service.imageUrl(item.imageId)} alt="" />
                    ) : (
                      <span className="ct-news-art" />
                    )}
                  </span>
                  <span className="ct-loop-text">
                    <strong>{item.title}</strong>
                    <span className="muted">
                      {copy.kit.seconds(item.displaySeconds)}
                      {item.endsAt ? ' · ' + windowLabel(item) : ''}
                    </span>
                  </span>
                </>
              )}
            />
          ) : (
            <p className="muted ct-empty-loop">
              {items ? text.loopEmpty : copy.form.loading}
            </p>
          )}
        </div>
        <NewsPhone
          title={shown?.title ?? ''}
          imageSrc={shown?.imageId ? service.imageUrl(shown.imageId) : null}
          seconds={shown?.displaySeconds ?? 6}
          index={Math.max(0, shownIndex)}
          count={Math.max(1, loop.length)}
          caption={text.previewCaption}
        />
      </section>
      <section className="kit-panel" aria-label={copy.panel.news}>
        <div className="kit-toolbar">
          <FilterTabs
            label={text.status}
            value={filter}
            options={(
              [
                'all',
                'live',
                'scheduled',
                'expired',
                'draft',
                'pending',
              ] as Filter[]
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
          <input
            className="kit-search-input"
            type="search"
            aria-label={text.searchNews}
            placeholder={text.searchNews}
            value={search}
            maxLength={100}
            onChange={event => {
              setSearch(event.target.value);
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
            <div className="table-scroll">
              <table className="kit-table">
                <thead>
                  <tr>
                    <th>{text.columns.news}</th>
                    <th>{text.status}</th>
                    <th>{text.columns.priority}</th>
                    <th>{text.columns.seconds}</th>
                    <th>{text.columns.window}</th>
                    <th>{text.columns.updated}</th>
                    <th className="align-right">{copy.panel.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {slice(visible, current, pageSize).map(item => {
                    const state = stateOf(item, now);
                    const rank = loop.indexOf(item);
                    const open = () =>
                      state === 'pending'
                        ? setReviewing(item)
                        : setEditor({ item });
                    return (
                      <tr key={item.id} className="kit-row-link" onClick={open}>
                        <td className="kit-wrap">
                          <div className="ct-row-news">
                            <span className="ct-loop-thumb">
                              {item.imageId ? (
                                <img
                                  src={service.imageUrl(item.imageId)}
                                  alt=""
                                  loading="lazy"
                                />
                              ) : (
                                <span className="ct-news-art" />
                              )}
                            </span>
                            <span className="ct-loop-text">
                              <strong>{item.title}</strong>
                              <span className="muted">
                                {item.authorName
                                  ? text.club(item.authorName)
                                  : item.summary}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="kit-badges">
                            <StatePill state={state} />
                            {item.showOnHome && (
                              <span className="kit-pill tone-brand">
                                {text.featured}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="kit-soft">
                          {rank >= 0 ? (
                            <strong className="ct-rank-inline">
                              #{rank + 1}
                            </strong>
                          ) : null}{' '}
                          {item.sortOrder}
                        </td>
                        <td className="kit-soft">
                          {copy.kit.seconds(item.displaySeconds)}
                        </td>
                        <td className="kit-soft">{windowLabel(item)}</td>
                        <td className="kit-soft">{ago(item.updatedAt)}</td>
                        <td className="align-right">
                          <button
                            type="button"
                            className="kit-action kit-action-primary"
                            onClick={event => {
                              event.stopPropagation();
                              open();
                            }}
                          >
                            {state === 'pending'
                              ? text.review
                              : copy.panel.edit}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
            <h2>{search ? copy.panel.emptySearch : text.empty}</h2>
            <p className="muted">
              {search ? copy.panel.emptyFilterBody : text.emptyHint}
            </p>
          </div>
        )}
      </section>
      {editor && (
        <NewsEditor
          key={editor.item?.id || 'new'}
          item={editor.item}
          service={service}
          firstOrder={firstOrder}
          position={editor.item ? loop.indexOf(editor.item) : -1}
          count={loop.length}
          onClose={() => setEditor(null)}
          onDone={done}
        />
      )}
      {reviewing && (
        <ReviewDialog
          article={reviewing}
          onClose={() => setReviewing(null)}
          onDecide={async decision => {
            await service.review(reviewing.id, decision);
            done(
              decision === 'approve'
                ? text.reviewApproved
                : text.reviewRejected,
            );
          }}
        />
      )}
    </main>
  );
}

function ReviewDialog({
  article,
  onClose,
  onDecide,
}: {
  article: Article;
  onClose(): void;
  onDecide(decision: ReviewDecision): Promise<void>;
}) {
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function decide(decision: ReviewDecision) {
    setBusy(decision);
    setError(null);
    try {
      await onDecide(decision);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      setBusy(null);
    }
  }
  return (
    <Modal
      title={article.title}
      eyebrow={text.reviewTitle.toLocaleUpperCase('tr-TR')}
      size="md"
      busy={!!busy}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            busy={busy === 'reject'}
            disabled={!!busy}
            onClick={() => decide('reject')}
          >
            {text.reviewReject}
          </Button>
          <Button
            busy={busy === 'approve'}
            disabled={!!busy}
            onClick={() => decide('approve')}
          >
            {text.reviewApprove}
          </Button>
        </>
      }
    >
      <div className="kit-editor">
        <p className="notice">
          {text.club(article.authorName || '')} · {ago(article.createdAt)}
        </p>
        <div className="kit-note">
          <span className="kit-form-title">{text.summary}</span>
          <p>{article.summary}</p>
        </div>
        <div className="kit-note">
          <span className="kit-form-title">{text.body}</span>
          <p>{article.body}</p>
        </div>
        <p className="hint">{text.reviewHint}</p>
        <Feedback message={error} />
      </div>
    </Modal>
  );
}
