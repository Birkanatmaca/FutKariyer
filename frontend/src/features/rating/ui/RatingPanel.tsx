import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
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
function date(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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

export function RatingPanel({ service }: { service: RatingService }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [tasks, setTasks] = useState<RatingTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Season | null>(null);
  const [board, setBoard] = useState<{
    season: Season;
    rows: Standing[] | null;
    error: string | null;
  } | null>(null);

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

  function openBoard(season: Season) {
    setBoard({ season, rows: null, error: null });
    service
      .leaderboard(season.id)
      .then(rows => setBoard({ season, rows, error: null }))
      .catch(failure =>
        setBoard({
          season,
          rows: [],
          error:
            failure instanceof Error ? failure.message : copy.form.unexpected,
        }),
      );
  }

  async function remove(season: Season) {
    if (!window.confirm(text.deleteConfirm(season.title))) return;
    try {
      await service.remove(season.id);
      setNotice(text.deleted);
      if (editing?.id === season.id) setEditing(null);
      setRevision(value => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    }
  }

  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.hint}</p>
        </div>
        <Button
          variant="secondary"
          busy={loading && seasons !== null}
          onClick={() => setRevision(value => value + 1)}
        >
          {text.refresh}
        </Button>
      </header>

      <section className="gift-section" aria-labelledby="season-form-title">
        <div className="league-section-header">
          <div>
            <h2 id="season-form-title">
              {editing ? text.editTitle(editing.title) : text.formTitle}
            </h2>
            <p className="muted">{text.formHint}</p>
          </div>
          {editing && (
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {text.newSeason}
            </Button>
          )}
        </div>
        <Feedback message={notice} success />
        <SeasonForm
          key={editing?.id ?? 'new'}
          service={service}
          season={editing}
          onSaved={saved => {
            setNotice(editing ? text.updated : text.created);
            setEditing(null);
            setRevision(value => value + 1);
            if (board?.season.id === saved.id) openBoard(saved);
          }}
        />
      </section>

      <section className="list-panel gift-history" aria-labelledby="seasons">
        <div className="league-section-header">
          <div>
            <h2 id="seasons">{text.seasons}</h2>
            <p className="muted">
              {seasons ? copy.panel.total(seasons.length) : copy.form.loading}
            </p>
          </div>
        </div>
        <Feedback message={error} />
        {seasons === null ? (
          <div className="empty" role="status">
            {loading ? <span className="spinner" /> : null}
            <p>{loading ? copy.form.loading : text.loadError}</p>
          </div>
        ) : seasons.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{text.columns.title}</th>
                  <th>{text.columns.window}</th>
                  <th>{text.columns.status}</th>
                  <th>{text.columns.players}</th>
                  <th>{text.columns.prizes}</th>
                  <th>{text.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map(season => (
                  <tr key={season.id}>
                    <td>
                      <strong>{season.title}</strong>
                    </td>
                    <td>
                      {date(season.startsAt)} – {date(season.endsAt)}
                    </td>
                    <td>
                      <span className={'rating-status ' + season.status}>
                        {text.statuses[season.status]}
                      </span>
                    </td>
                    <td>{season.players.toLocaleString('tr-TR')}</td>
                    <td className="rating-prizes">
                      {season.prizes.length
                        ? season.prizes
                            .map(p => text.place(p.place) + ': ' + p.title)
                            .join(' · ')
                        : text.noPrizes}
                    </td>
                    <td className="rating-actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setNotice(null);
                          setEditing(season);
                        }}
                      >
                        {text.edit}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => openBoard(season)}
                      >
                        {text.leaderboard}
                      </Button>
                      {!season.published && (
                        <Button
                          variant="secondary"
                          onClick={() => remove(season)}
                        >
                          {text.delete}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h2>{text.empty}</h2>
            <p className="muted">{text.emptyHint}</p>
          </div>
        )}
      </section>

      {board && (
        <section
          className="list-panel gift-history"
          aria-labelledby="rating-board"
        >
          <div className="league-section-header">
            <div>
              <h2 id="rating-board">{text.boardTitle(board.season.title)}</h2>
              <p className="muted">{text.boardHint}</p>
            </div>
            <Button variant="secondary" onClick={() => setBoard(null)}>
              {text.close}
            </Button>
          </div>
          <Feedback message={board.error} />
          {board.rows === null ? (
            <div className="empty" role="status">
              <span className="spinner" />
            </div>
          ) : board.rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{text.columns.rank}</th>
                    <th>{text.columns.name}</th>
                    <th>{text.columns.role}</th>
                    <th>{text.columns.points}</th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map(row => (
                    <tr key={row.userId}>
                      <td>
                        <strong>{row.rank}</strong>
                        {row.rank <= 3 ? ' ' + text.medal[row.rank - 1] : ''}
                      </td>
                      <td>{row.fullName}</td>
                      <td>{text.roles[row.role]}</td>
                      <td>{row.points.toLocaleString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <p className="muted">{text.boardEmpty}</p>
            </div>
          )}
        </section>
      )}

      <section className="list-panel gift-history" aria-labelledby="tasks">
        <div className="league-section-header">
          <div>
            <h2 id="tasks">{text.tasks}</h2>
            <p className="muted">{text.tasksHint}</p>
          </div>
        </div>
        {tasks ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{text.columns.task}</th>
                  <th>{text.columns.active}</th>
                  <th>{text.columns.target}</th>
                  <th>{text.columns.reward}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <TaskRow
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
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty" role="status">
            {loading ? <span className="spinner" /> : null}
          </div>
        )}
      </section>
    </main>
  );
}

function SeasonForm({
  service,
  season,
  onSaved,
}: {
  service: RatingService;
  season: Season | null;
  onSaved(season: Season): void;
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

  async function submit(event: FormEvent) {
    event.preventDefault();
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
      const saved = season
        ? await service.update(season.id, draft)
        : await service.create(draft);
      if (!season) setForm(blankForm());
      onSaved(saved);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.saveError);
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="gift-form" onSubmit={submit} noValidate>
      <Field
        label={text.seasonTitle}
        value={form.title}
        required
        minLength={ratingLimits.titleMin}
        maxLength={ratingLimits.titleMax}
        disabled={busy}
        error={fields.title}
        placeholder={text.titlePlaceholder}
        onChange={event => change('title', event.target.value)}
      />
      <label className="field rating-publish">
        <span>{text.visibility}</span>
        <span className="rating-toggle">
          <input
            type="checkbox"
            checked={form.published}
            disabled={busy}
            onChange={event => change('published', event.target.checked)}
          />
          {form.published ? text.published : text.draft}
        </span>
        <span className="hint">{text.publishHint}</span>
      </label>
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
      <label className="field gift-wide">
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
      <div className="rating-prize-grid gift-wide">
        {places.map(place => (
          <Field
            key={place}
            label={text.prizeLabel(place)}
            value={form.prizes[place]}
            maxLength={ratingLimits.prizeMax}
            disabled={busy}
            placeholder={text.prizePlaceholder[place - 1]}
            onChange={event =>
              change('prizes', { ...form.prizes, [place]: event.target.value })
            }
          />
        ))}
        {fields.prizes && (
          <span className="field-error" role="alert">
            {fields.prizes}
          </span>
        )}
      </div>
      <div className="gift-actions gift-wide">
        <Feedback message={error} />
        <Button type="submit" busy={busy}>
          {season ? text.save : text.create}
        </Button>
      </div>
    </form>
  );
}

function TaskRow({
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
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      onSaved(await service.updateTask(next));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <strong>{text.taskKinds[task.kind]}</strong>
        <div className="muted">{text.taskHints[task.kind]}</div>
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
      </td>
      <td>
        <input
          type="checkbox"
          aria-label={text.columns.active}
          checked={draft.active}
          disabled={busy}
          onChange={event =>
            setDraft(d => ({ ...d, active: event.target.checked }))
          }
        />
      </td>
      <td>
        <input
          className="rating-number"
          type="number"
          min={1}
          max={ratingLimits.targetMax}
          aria-label={text.columns.target}
          value={draft.target}
          disabled={busy}
          onChange={event =>
            setDraft(d => ({ ...d, target: event.target.value }))
          }
        />
      </td>
      <td>
        <input
          className="rating-number"
          type="number"
          min={1}
          max={ratingLimits.pointsMax}
          aria-label={text.columns.reward}
          value={draft.points}
          disabled={busy}
          onChange={event =>
            setDraft(d => ({ ...d, points: event.target.value }))
          }
        />
      </td>
      <td>
        <Button
          variant="secondary"
          busy={busy}
          disabled={!changed}
          onClick={save}
        >
          {text.saveTask}
        </Button>
      </td>
    </tr>
  );
}
