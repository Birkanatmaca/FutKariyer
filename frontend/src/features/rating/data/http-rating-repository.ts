import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  RatingRepository,
  RatingTask,
  Season,
  SeasonDraft,
  Standing,
  TaskKind,
} from '../domain/models';

const statuses = ['draft', 'upcoming', 'active', 'finished'];
const roles = ['player', 'club', 'coach'];
const taskKinds: TaskKind[] = [
  'play_games',
  'share_post',
  'follow_accounts',
  'h2h_streak',
];
const id = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const date = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;

function validSeason(value: unknown): value is Season {
  const s = value as Season;
  return (
    !!s &&
    id(s.id) &&
    typeof s.title === 'string' &&
    typeof s.description === 'string' &&
    date(s.startsAt) &&
    date(s.endsAt) &&
    Array.isArray(s.prizes) &&
    s.prizes.every(
      p => [1, 2, 3].includes(p.place) && typeof p.title === 'string',
    ) &&
    typeof s.published === 'boolean' &&
    statuses.includes(s.status) &&
    count(s.players)
  );
}
function validStanding(value: unknown): value is Standing {
  const s = value as Standing;
  return (
    !!s &&
    count(s.rank) &&
    id(s.userId) &&
    typeof s.fullName === 'string' &&
    roles.includes(s.role) &&
    count(s.points)
  );
}
function validTask(value: unknown): value is RatingTask {
  const t = value as RatingTask;
  return (
    !!t &&
    taskKinds.includes(t.kind) &&
    typeof t.active === 'boolean' &&
    count(t.target) &&
    count(t.points)
  );
}
function list<T>(value: unknown, valid: (item: unknown) => item is T): T[] {
  const items = (value as { items?: unknown })?.items;
  if (!Array.isArray(items) || !items.every(valid))
    throw new ApiError(copy.form.unexpected);
  return items;
}
function body(draft: SeasonDraft) {
  return {
    title: draft.title,
    description: draft.description,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    prizes: draft.prizes,
    published: draft.published,
  };
}
function season(value: unknown) {
  if (!validSeason(value)) throw new ApiError(copy.form.unexpected);
  return value;
}

export const ratingRepository: RatingRepository = {
  async seasons() {
    return list(
      await request<unknown>('/v1/admin/rating/seasons'),
      validSeason,
    );
  },
  async create(draft) {
    return season(
      await request<unknown>('/v1/admin/rating/seasons', {
        method: 'POST',
        body: body(draft),
      }),
    );
  },
  async update(seasonId, draft) {
    return season(
      await request<unknown>('/v1/admin/rating/seasons/' + seasonId, {
        method: 'PUT',
        body: body(draft),
      }),
    );
  },
  async remove(seasonId) {
    await request<void>('/v1/admin/rating/seasons/' + seasonId, {
      method: 'DELETE',
    });
  },
  async leaderboard(seasonId) {
    const result = await request<{ leaderboard?: unknown }>(
      '/v1/admin/rating/seasons/' + seasonId + '/leaderboard',
    );
    return list({ items: result?.leaderboard }, validStanding);
  },
  async tasks() {
    return list(await request<unknown>('/v1/admin/rating/tasks'), validTask);
  },
  async updateTask(task) {
    const result = await request<unknown>(
      '/v1/admin/rating/tasks/' + task.kind,
      {
        method: 'PUT',
        body: { active: task.active, target: task.target, points: task.points },
      },
    );
    if (!validTask(result)) throw new ApiError(copy.form.unexpected);
    return result;
  },
};
