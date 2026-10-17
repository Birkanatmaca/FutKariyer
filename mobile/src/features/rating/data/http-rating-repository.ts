import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  RatingBoard,
  RatingRepository,
  RatingSeason,
  RatingTask,
  Standing,
  TaskKind,
} from '../domain/models';

const kinds: TaskKind[] = [
  'play_games',
  'share_post',
  'follow_accounts',
  'h2h_streak',
];
const id = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const count = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v));

function season(v: unknown): v is RatingSeason {
  const s = v as RatingSeason;
  return (
    !!s &&
    id(s.id) &&
    typeof s.title === 'string' &&
    typeof s.description === 'string' &&
    date(s.startsAt) &&
    date(s.endsAt) &&
    ['upcoming', 'active', 'finished'].includes(s.status) &&
    Array.isArray(s.prizes) &&
    s.prizes.length <= 3 &&
    s.prizes.every(
      p => !!p && [1, 2, 3].includes(p.place) && typeof p.title === 'string',
    )
  );
}
function standing(v: unknown): v is Standing {
  const s = v as Standing;
  return (
    !!s &&
    count(s.rank) &&
    s.rank > 0 &&
    id(s.userId) &&
    typeof s.fullName === 'string' &&
    ['player', 'club', 'coach'].includes(s.role) &&
    count(s.points)
  );
}
function task(v: unknown): v is RatingTask {
  const t = v as RatingTask;
  return (
    !!t &&
    kinds.includes(t.kind) &&
    count(t.target) &&
    t.target > 0 &&
    count(t.points) &&
    count(t.progress) &&
    typeof t.claimed === 'boolean'
  );
}
function checked(value: unknown): RatingBoard {
  const b = value as RatingBoard;
  if (
    !b ||
    !(b.season === null || season(b.season)) ||
    !date(b.serverTime) ||
    !Array.isArray(b.leaderboard) ||
    b.leaderboard.length > 50 ||
    !b.leaderboard.every(standing) ||
    !(b.me === null || (!!b.me && count(b.me.rank) && count(b.me.points))) ||
    !Array.isArray(b.tasks) ||
    !b.tasks.every(task)
  )
    throw new ApiError(copy.form.unexpected);
  return b;
}

export const ratingRepository: RatingRepository = {
  async board(token) {
    return checked(await request<unknown>('/v1/rating', { token }));
  },
  async claim(token, kind) {
    return checked(
      await request<unknown>(
        '/v1/rating/tasks/' + encodeURIComponent(kind) + '/claim',
        { token, method: 'POST' },
      ),
    );
  },
};
