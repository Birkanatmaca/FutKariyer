import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { ConfirmDialog, Modal } from '../../../shared/ui/Modal';
import { copy } from '../../../shared/lib/copy';
import type {
  Prize,
  RatingTask,
  Season,
  SeasonDraft,
  Standing,
} from '../domain/models';
import {
  ratingLimits,
  validateSeasonDraft,
  validateTask,
  type RatingService,
} from '../application/rating-service';

const text = copy.rating;
const places = [1, 2, 3] as const;

// datetime-local works in the admin's local time; the API takes ISO instants.
function toInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}
function fromInput(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}
function day(value: string) {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// How far a season is: elapsed percent and a human line.
function timing(season: Season, now = Date.now()) {
  const start = Date.parse(season.startsAt);
  const end = Date.parse(season.endsAt);
  const percent = Math.min(
    100,
    Math.max(0, Math.round(((now - start) / Math.max(1, end - start)) * 100)),
  );
  let line: string;
  if (now < start) line = text.startsIn(Math.floor((start - now) / 86400000));
  else if (now >= end) line = text.endedOn(day(season.endsAt));
  else {
    const left = end - now;
    line = text.timeLeft(
      Math.floor(left / 86400000),
      Math.floor((left % 86400000) / 3600000),
    );
  }
  return { percent, line };
}

type FormState = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  prizes: Record<1 | 2 | 3, string>;
  published: boolean;
};

// A new season starts at the next full hour and runs for 30 days.
function blankForm(): FormState {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 30 * 86400000);
  return {
    title: '',
    description: '',
    startsAt: toInput(start.toISOString()),
    endsAt: toInput(end.toISOString()),
    prizes: { 1: '', 2: '', 3: '' },
    published: false,
  };
}
function formFrom(season: Season): FormState {
  const prizes = { 1: '', 2: '', 3: '' };
  season.prizes.forEach(p => (prizes[p.place] = p.title));
  return {
    title: season.title,
    description: season.description,
    startsAt: toInput(season.startsAt),
    endsAt: toInput(season.endsAt),
    prizes,
    published: season.published,
  };
}
function draftFrom(form: FormState): SeasonDraft {
  return {
    title: form.title,
    description: form.description,
    startsAt: fromInput(form.startsAt),
    endsAt: fromInput(form.endsAt),
    prizes: places.map(place => ({
      place,
      title: form.prizes[place],
    })) as Prize[],
    published: form.published,
  };
}

// Global Rating (21 Oct 2026 design): the season in focus with countdown and
// prize podium, every season as a card, tasks as switchable cards; creating,
// editing, the leaderboard and deleting open in modals.
export function RatingPanel({ service }: { service: RatingService }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [tasks, setTasks] = useState<RatingTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<{ season: Season | null } | null>(null);
  const [board, setBoard] = useState<Season | null>(null);
  const [removing, setRemoving] = useState<Season | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    Promise.all([service.seasons(), service.tasks()])
      .then(([seasonList, taskList]) => {
        if (!current) return;
        setSeasons(seasonList);
        setTasks(taskList);
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

  const spotlight =
    seasons?.find(s => s.status === 'active') ??
    seasons?.find(s => s.status === 'upcoming') ??
    null;
  const openTasks = tasks?.filter(t => t.active).length ?? 0;

  return (
    <main className="panel-content rt">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <div className="action-row">
          <Button
            variant="secondary"
            busy={loading && seasons !== null}
            onClick={() => setRevision(value => value + 1)}
          >
            {text.refresh}
          </Button>
          <Button
            onClick={() => {
              setNotice(null);
              setForm({ season: null });
            }}
          >
            + {text.newSeasonButton}
          </Button>
        </div>
      </header>

      <Feedback message={notice} success />
      <Feedback message={error} />

      <section className="rt-overview">
        <div className="rt-stat">
          <span>{text.overview.seasons}</span>
          <strong>{seasons?.length ?? '—'}</strong>
        </div>
        <div className="rt-stat">
          <span>{text.overview.active}</span>
          <strong className="rt-ellipsis">
            {seasons?.find(s => s.status === 'active')?.title ?? '—'}
          </strong>
        </div>
        <div className="rt-stat">
          <span>{text.overview.participants}</span>
          <strong>
            {spotlight ? spotlight.players.toLocaleString('tr-TR') : '—'}
          </strong>
        </div>
        <div className="rt-stat">
          <span>{text.overview.tasks}</span>
          <strong>{tasks ? openTasks + ' / ' + tasks.length : '—'}</strong>
        </div>
      </section>

      {seasons === null ? (
        <div className="empty" role="status">
          {loading ? <span className="spinner" /> : null}
          <p>{loading ? copy.form.loading : text.loadError}</p>
        </div>
      ) : (
        <>
          <Spotlight
            season={spotlight}
            onBoard={setBoard}
            onEdit={season => {
              setNotice(null);
              setForm({ season });
            }}
          />

          <section className="rt-block" aria-labelledby="rt-seasons">
            <div className="rt-block-head">
              <h2 id="rt-seasons">{text.seasons}</h2>
              <span className="count-badge">{seasons.length}</span>
            </div>
            {seasons.length ? (
              <div className="rt-season-grid">
                {seasons.map(season => (
                  <SeasonCard
                    key={season.id}
                    season={season}
                    onEdit={() => {
                      setNotice(null);
                      setForm({ season });
                    }}
                    onBoard={() => setBoard(season)}
                    onDelete={() => setRemoving(season)}
                  />
                ))}
              </div>
            ) : (
              <div className="rt-empty">
                <h3>{text.empty}</h3>
                <p className="muted">{text.emptyHint}</p>
                <Button onClick={() => setForm({ season: null })}>
                  + {text.newSeasonButton}
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      <section className="rt-block" aria-labelledby="rt-tasks">
        <div className="rt-block-head">
          <div>
            <h2 id="rt-tasks">{text.tasks}</h2>
            <p className="muted">{text.tasksHint}</p>
          </div>
        </div>
        {tasks ? (
          <div className="rt-task-grid">
            {tasks.map(task => (
              <TaskCard
                key={task.kind}
                task={task}
                service={service}
                onSaved={saved =>
                  setTasks(list =>
                    (list ?? []).map(item =>
                      item.kind === saved.kind ? saved : item,
                    ),
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="empty" role="status">
            {loading ? <span className="spinner" /> : null}
          </div>
        )}
      </section>

      {form && (
        <SeasonFormModal
          service={service}
          season={form.season}
          onClose={() => setForm(null)}
          onSaved={() => {
            setNotice(form.season ? text.updated : text.created);
            setForm(null);
            setRevision(value => value + 1);
          }}
        />
      )}
      {board && (
        <LeaderboardModal
          service={service}
          season={board}
          onClose={() => setBoard(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={text.deleteTitle}
          message={text.deleteConfirm(removing.title)}
          confirm={text.delete}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await service.remove(removing.id);
            setRemoving(null);
            setNotice(text.deleted);
            setRevision(value => value + 1);
          }}
        />
      )}
    </main>
  );
}

function StatusPill({ season }: { season: Season }) {
  return (
    <span className={'rating-status ' + season.status}>
      {text.statuses[season.status]}
    </span>
  );
}

function Podium({ prizes }: { prizes: Prize[] }) {
  const order: (1 | 2 | 3)[] = [2, 1, 3];
  return (
    <div className="rt-podium">
      {order.map(place => {
        const prize = prizes.find(p => p.place === place);
        return (
          <div key={place} className={'rt-step rt-step-' + place}>
            <span className="rt-medal">{text.medal[place - 1]}</span>
            <strong>{prize?.title || text.noPrizes}</strong>
            <span className="rt-step-base">{place}</span>
          </div>
        );
      })}
    </div>
  );
}

function Spotlight({
  season,
  onBoard,
  onEdit,
}: {
  season: Season | null;
  onBoard(season: Season): void;
  onEdit(season: Season): void;
}) {
  if (!season) {
    return (
      <section className="rt-spotlight rt-spotlight-empty">
        <p className="eyebrow">{text.spotlight}</p>
        <h2>{text.noSpotlight}</h2>
        <p className="muted">{text.noSpotlightHint}</p>
      </section>
    );
  }
  const { percent, line } = timing(season);
  return (
    <section className="rt-spotlight" aria-label={text.spotlight}>
      <div className="rt-spotlight-main">
        <p className="eyebrow">{text.spotlight}</p>
        <div className="title-row">
          <h2>{season.title}</h2>
          <StatusPill season={season} />
        </div>
        {season.description && (
          <p className="muted rt-description">{season.description}</p>
        )}
        <p className="rt-dates">
          {dateTime(season.startsAt)} – {dateTime(season.endsAt)}
        </p>
        <div className="rt-progress" aria-label={text.progress(percent)}>
          <span style={{ width: percent + '%' }} />
        </div>
        <div className="rt-progress-meta">
          <strong>{line}</strong>
          <span>
            {text.participantsCount(season.players.toLocaleString('tr-TR'))}
          </span>
        </div>
        <div className="action-row">
          <Button onClick={() => onBoard(season)}>{text.leaderboard}</Button>
          <Button variant="secondary" onClick={() => onEdit(season)}>
            {text.edit}
          </Button>
        </div>
      </div>
      <div className="rt-spotlight-prizes">
        <h3>{text.prizesTitle}</h3>
        <Podium prizes={season.prizes} />
      </div>
    </section>
  );
}

function SeasonCard({
  season,
  onEdit,
  onBoard,
  onDelete,
}: {
  season: Season;
  onEdit(): void;
  onBoard(): void;
  onDelete(): void;
}) {
  const { percent, line } = timing(season);
  return (
    <article className={'rt-season rt-season-' + season.status}>
      <div className="rt-season-head">
        <StatusPill season={season} />
        <span className="rt-players">
          {text.participantsCount(season.players.toLocaleString('tr-TR'))}
        </span>
      </div>
      <h3>{season.title}</h3>
      <p className="rt-dates">
        {day(season.startsAt)} – {day(season.endsAt)}
      </p>
      {season.published && (
        <>
          <div className="rt-progress rt-progress-thin">
            <span style={{ width: percent + '%' }} />
          </div>
          <p className="hint">{line}</p>
        </>
      )}
      <ul className="rt-prize-list">
        {season.prizes.length ? (
          season.prizes.map(prize => (
            <li key={prize.place}>
              <span>{text.medal[prize.place - 1]}</span>
              {prize.title}
            </li>
          ))
        ) : (
          <li className="muted">{text.noPrizes}</li>
        )}
      </ul>
      <div className="rt-season-actions">
        <Button variant="secondary" className="button-small" onClick={onBoard}>
          {text.leaderboard}
        </Button>
        <Button variant="secondary" className="button-small" onClick={onEdit}>
          {text.edit}
        </Button>
        {!season.published && (
          <Button variant="danger" className="button-small" onClick={onDelete}>
            {text.delete}
          </Button>
        )}
      </div>
    </article>
  );
}

function SeasonFormModal({
  service,
  season,
  onClose,
  onSaved,
}: {
  service: RatingService;
  season: Season | null;
  onClose(): void;
  onSaved(): void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    season ? formFrom(season) : blankForm(),
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const draft = draftFrom(form);
    const problems = validateSeasonDraft({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
    });
    setError(null);
    setFields(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      if (season) await service.update(season.id, draft);
      else await service.create(draft);
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.saveError);
      if (failure instanceof ApiError) setFields(failure.fields);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={season ? text.editTitle(season.title) : text.formTitle}
      eyebrow={text.eyebrow}
      size="lg"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {copy.form.cancel}
          </Button>
          <Button busy={busy} onClick={() => submit()}>
            {season ? text.save : text.create}
          </Button>
        </>
      }
    >
      <p className="hint">{text.formHint}</p>
      <form className="rt-form" onSubmit={submit} noValidate>
        <Field
          label={text.seasonTitle}
          value={form.title}
          required
          autoFocus
          minLength={ratingLimits.titleMin}
          maxLength={ratingLimits.titleMax}
          disabled={busy}
          error={fields.title}
          placeholder={text.titlePlaceholder}
          onChange={event => change('title', event.target.value)}
        />
        <div className="field">
          <span>{text.visibility}</span>
          <div
            className="rt-segment"
            role="radiogroup"
            aria-label={text.visibility}
          >
            {[false, true].map(value => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={form.published === value}
                disabled={busy}
                onClick={() => change('published', value)}
              >
                {value ? text.published : text.draft}
              </button>
            ))}
          </div>
          <span className="hint">{text.publishHint}</span>
        </div>
        <Field
          label={text.startsAt}
          type="datetime-local"
          value={form.startsAt}
          required
          disabled={busy}
          error={fields.startsAt}
          onChange={event => change('startsAt', event.target.value)}
        />
        <Field
          label={text.endsAt}
          type="datetime-local"
          value={form.endsAt}
          required
          disabled={busy}
          error={fields.endsAt}
          onChange={event => change('endsAt', event.target.value)}
        />
        <label className="field rt-wide">
          <span>{text.description}</span>
          <textarea
            value={form.description}
            maxLength={ratingLimits.descriptionMax}
            rows={3}
            disabled={busy}
            aria-invalid={!!fields.description}
            onChange={event => change('description', event.target.value)}
          />
          <span
            className={fields.description ? 'field-error' : 'hint'}
            role={fields.description ? 'alert' : undefined}
          >
            {fields.description || text.descriptionHint}
          </span>
        </label>
        <div className="rt-wide rt-prize-inputs">
          <span className="rt-label">{text.prizesTitle}</span>
          {places.map(place => (
            <div key={place} className="rt-prize-input">
              <span className="rt-medal">{text.medal[place - 1]}</span>
              <Field
                label={text.prizeLabel(place)}
                value={form.prizes[place]}
                maxLength={ratingLimits.prizeMax}
                disabled={busy}
                placeholder={text.prizePlaceholder[place - 1]}
                onChange={event =>
                  change('prizes', {
                    ...form.prizes,
                    [place]: event.target.value,
                  })
                }
              />
            </div>
          ))}
          {fields.prizes && (
            <span className="field-error" role="alert">
              {fields.prizes}
            </span>
          )}
        </div>
        <button type="submit" hidden />
      </form>
      <Feedback message={error} />
    </Modal>
  );
}

function LeaderboardModal({
  service,
  season,
  onClose,
}: {
  service: RatingService;
  season: Season;
  onClose(): void;
}) {
  const [rows, setRows] = useState<Standing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    service
      .leaderboard(season.id)
      .then(value => current && setRows(value))
      .catch(failure => {
        if (!current) return;
        setRows([]);
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
      });
    return () => {
      current = false;
    };
  }, [service, season.id]);
  const top = rows?.slice(0, 3) ?? [];
  return (
    <Modal
      title={season.title}
      eyebrow={text.leaderboardEyebrow}
      size="lg"
      onClose={onClose}
    >
      <p className="hint">{text.boardHint}</p>
      <Feedback message={error} />
      {rows === null ? (
        <div className="empty" role="status">
          <span className="spinner" />
        </div>
      ) : rows.length ? (
        <>
          <div className="rt-top3">
            {[1, 0, 2].map(index =>
              top[index] ? (
                <div
                  key={top[index].userId}
                  className={'rt-top rt-top-' + (index + 1)}
                >
                  <span className="rt-medal">{text.medal[index]}</span>
                  <strong>{top[index].fullName}</strong>
                  <span>{text.roles[top[index].role]}</span>
                  <em>{top[index].points.toLocaleString('tr-TR')}</em>
                </div>
              ) : (
                <div key={index} className="rt-top rt-top-empty" />
              ),
            )}
          </div>
          <ol className="rt-board">
            {rows.map(row => (
              <li key={row.userId}>
                <span className="rt-rank">{row.rank}</span>
                <span className="rt-board-name">
                  <strong>{row.fullName}</strong>
                  <span>{text.roles[row.role]}</span>
                </span>
                <strong className="rt-board-points">
                  {row.points.toLocaleString('tr-TR')}
                </strong>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="rt-empty">
          <p className="muted">{text.boardEmpty}</p>
        </div>
      )}
    </Modal>
  );
}

function TaskCard({
  task,
  service,
  onSaved,
}: {
  task: RatingTask;
  service: RatingService;
  onSaved(task: RatingTask): void;
}) {
  const [draft, setDraft] = useState({
    active: task.active,
    target: String(task.target),
    points: String(task.points),
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const changed =
    draft.active !== task.active ||
    draft.target !== String(task.target) ||
    draft.points !== String(task.points);

  async function save() {
    const next: RatingTask = {
      kind: task.kind,
      active: draft.active,
      target: Number(draft.target),
      points: Number(draft.points),
    };
    const problems = validateTask(next);
    setError(Object.values(problems)[0] ?? null);
    setSaved(false);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      onSaved(await service.updateTask(next));
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={'rt-task' + (draft.active ? ' rt-task-on' : '')}>
      <div className="rt-task-head">
        <div>
          <h3>{text.taskKinds[task.kind]}</h3>
          <p className="muted">{text.taskHints[task.kind]}</p>
        </div>
        <label className="rt-switch">
          <input
            type="checkbox"
            checked={draft.active}
            disabled={busy}
            onChange={event =>
              setDraft(d => ({ ...d, active: event.target.checked }))
            }
          />
          <span aria-hidden="true" />
          <em>{draft.active ? text.taskOn : text.taskOff}</em>
        </label>
      </div>
      <div className="rt-task-fields">
        <label>
          <span>{text.taskTarget}</span>
          <input
            type="number"
            min={1}
            max={ratingLimits.targetMax}
            value={draft.target}
            disabled={busy}
            onChange={event =>
              setDraft(d => ({ ...d, target: event.target.value }))
            }
          />
        </label>
        <label>
          <span>{text.taskPoints}</span>
          <input
            type="number"
            min={1}
            max={ratingLimits.pointsMax}
            value={draft.points}
            disabled={busy}
            onChange={event =>
              setDraft(d => ({ ...d, points: event.target.value }))
            }
          />
        </label>
        <Button
          className="button-small"
          busy={busy}
          disabled={!changed}
          onClick={save}
        >
          {text.saveTask}
        </Button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {saved && !changed && <p className="rt-saved">{text.taskSaved}</p>}
    </article>
  );
}
