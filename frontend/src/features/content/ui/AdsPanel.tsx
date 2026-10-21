import { useEffect, useMemo, useState } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { FilterTabs, Pager, StatCards, slice } from '../../../shared/ui/kit';
import type { ContentService } from '../application/content-service';
import type { Advertisement } from '../domain/models';
import { AdEditor, adForm } from './AdEditor';
import {
  AdPhone,
  LoopList,
  StatePill,
  itemState,
  windowLabel,
  type ItemState,
} from './parts';

const text = copy.content;
const pageSize = 12;
// The app shows the first twenty live ads.
const loopSize = 20;
type Filter = 'all' | Exclude<ItemState, 'pending'>;

function byOrder(a: Advertisement, b: Advertisement) {
  return (
    a.sortOrder - b.sortOrder ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    (a.id < b.id ? 1 : -1)
  );
}

export function AdsPanel({ service }: { service: ContentService }) {
  const [items, setItems] = useState<Advertisement[] | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [filter, setFilter] = useState<Filter>('all'),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<{ item?: Advertisement } | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [moving, setMoving] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .listAll('ads')
      .then(value => {
        if (current) setItems(value as Advertisement[]);
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
  const all = useMemo(() => [...(items ?? [])].sort(byOrder), [items]);
  const stateOf = (item: Advertisement) =>
    itemState(item.active, item, now) as Exclude<ItemState, 'pending'>;
  const loop = all.filter(item => stateOf(item) === 'live').slice(0, loopSize);
  const counts: Record<Filter, number> = {
    all: all.length,
    live: 0,
    scheduled: 0,
    expired: 0,
    draft: 0,
  };
  for (const item of all) counts[stateOf(item)]++;
  const visible = all.filter(
    item => filter === 'all' || stateOf(item) === filter,
  );
  const lastPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, lastPage);
  const shown = loop.find(item => item.id === selected) ?? loop[0];
  const shownIndex = shown ? loop.indexOf(shown) : -1;
  const loopSeconds = loop.reduce((sum, item) => sum + item.displaySeconds, 0);
  const nextOrder = all.length ? all[all.length - 1].sortOrder + 10 : 10;
  const endingSoon = all.filter(
    item =>
      stateOf(item) === 'live' &&
      item.endsAt &&
      Date.parse(item.endsAt) - now < 3 * 86400000,
  ).length;

  function done(message: string) {
    setEditor(null);
    setNotice(message);
    setRevision(v => v + 1);
  }

  async function move(from: number, to: number) {
    if (moving) return;
    const next = [...loop];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMoving(true);
    setError(null);
    try {
      for (const [index, ad] of next.entries()) {
        const order = (index + 1) * 10;
        if (ad.sortOrder !== order)
          await service.save('ads', { ...adForm(ad), sortOrder: order }, ad.id);
      }
      setSelected(item.id);
      setNotice(text.reordered);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setMoving(false);
      setRevision(v => v + 1);
    }
  }

  return (
    <main className="panel-content kit-screen">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{copy.panel.ads}</h1>
          <p className="muted">{text.adsHint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && items !== null}
            onClick={() => setRevision(v => v + 1)}
          >
            {copy.panel.refresh}
          </Button>
          <Button onClick={() => setEditor({})}>+ {text.newAd}</Button>
        </div>
      </header>
      <StatCards
        loading={!items}
        items={[
          {
            label: text.stats.liveAds,
            value: counts.live,
            sub: text.stats.ofTotal(all.length),
            tone: 'accent',
          },
          {
            label: text.stats.loop,
            value: copy.kit.seconds(loopSeconds),
            sub: text.stats.adLoopSub,
            tone: 'brand',
          },
          {
            label: text.stats.scheduled,
            value: counts.scheduled,
            sub: text.stats.endingSoon(endingSoon),
            tone: 'info',
          },
          {
            label: text.stats.offAds,
            value: counts.draft + counts.expired,
            sub: text.stats.expiredSub(counts.expired),
            tone: 'muted',
          },
        ]}
      />
      <Feedback message={notice} success />
      <Feedback message={error} />
      <section className="ct-showcase" aria-labelledby="ad-loop-title">
        <div className="ct-showcase-list">
          <div className="ct-showcase-head">
            <div>
              <h2 id="ad-loop-title">{text.adLoopTitle}</h2>
              <p className="muted">{text.adLoopHint}</p>
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
                  <span className="ct-loop-thumb ct-loop-thumb-wide">
                    <img src={service.imageUrl(item.imageId)} alt="" />
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
              {items ? text.adLoopEmpty : copy.form.loading}
            </p>
          )}
        </div>
        <AdPhone
          imageSrc={shown ? service.imageUrl(shown.imageId) : null}
          seconds={shown?.displaySeconds ?? 5}
          index={Math.max(0, shownIndex)}
          count={Math.max(1, loop.length)}
          caption={text.previewCaption}
        />
      </section>
      <section className="kit-panel" aria-label={copy.panel.ads}>
        <div className="kit-toolbar">
          <FilterTabs
            label={text.status}
            value={filter}
            options={(
              ['all', 'live', 'scheduled', 'expired', 'draft'] as Filter[]
            ).map(value => ({
              value,
              label: value === 'all' ? copy.kit.all : text.adStates[value],
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
            <div className="ct-grid">
              {slice(visible, current, pageSize).map(item => {
                const rank = loop.indexOf(item);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="ct-card"
                    onClick={() => setEditor({ item })}
                  >
                    <span className="ct-card-image">
                      <img
                        src={service.imageUrl(item.imageId)}
                        alt=""
                        loading="lazy"
                      />
                      {rank >= 0 && (
                        <span className="ct-card-rank">#{rank + 1}</span>
                      )}
                    </span>
                    <span className="ct-card-body">
                      <span className="ct-card-head">
                        <strong>{item.title}</strong>
                        <StatePill ad state={stateOf(item)} />
                      </span>
                      <span className="ct-card-meta">
                        <span>
                          {text.order}: {item.sortOrder}
                        </span>
                        <span>{copy.kit.seconds(item.displaySeconds)}</span>
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
            <h2>{text.adsEmpty}</h2>
            <p className="muted">{text.adsEmptyHint}</p>
          </div>
        )}
      </section>
      {editor && (
        <AdEditor
          key={editor.item?.id || 'new'}
          item={editor.item}
          service={service}
          nextOrder={nextOrder}
          position={editor.item ? loop.indexOf(editor.item) : -1}
          count={loop.length}
          onClose={() => setEditor(null)}
          onDone={done}
        />
      )}
    </main>
  );
}
