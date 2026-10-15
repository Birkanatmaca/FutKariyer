import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { headToHeadMetrics } from '../domain/head-to-head';
import type {
  HeadToHeadRecord,
  HeadToHeadRepository,
  HeadToHeadResult,
  HeadToHeadRound,
  HeadToHeadRun,
  HeadToHeadTeam,
} from '../domain/head-to-head';

const id = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const count = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const int = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v);
const text = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
// Crests load straight from the source; RemoteLogo shows initials otherwise.
const logo = (v: unknown) => typeof v === 'string' && v.length <= 2048;

function team(v: unknown): v is HeadToHeadTeam {
  const t = v as HeadToHeadTeam;
  return !!t && text(t.name, 120) && logo(t.logoUrl);
}
function round(v: unknown): v is HeadToHeadRound {
  const r = v as HeadToHeadRound;
  return (
    !!r &&
    id(r.id) &&
    !!r.league &&
    text(r.league.name, 120) &&
    logo(r.league.logoUrl) &&
    !!r.question &&
    (headToHeadMetrics as readonly string[]).includes(r.question.metric) &&
    text(r.question.label, 80) &&
    team(r.left) &&
    team(r.right) &&
    r.left.name !== r.right.name &&
    // A round must never carry the answer.
    !('value' in r.left) &&
    !('value' in r.right) &&
    !('values' in r)
  );
}
function record(value: unknown): HeadToHeadRecord {
  const r = value as HeadToHeadRecord;
  if (!r || !count(r.best) || !count(r.plays))
    throw new ApiError(copy.form.unexpected);
  return { best: r.best, plays: r.plays };
}
function run(value: unknown): HeadToHeadRun {
  const r = value as HeadToHeadRun;
  if (
    !r ||
    !id(r.id) ||
    !count(r.streak) ||
    !count(r.best) ||
    !count(r.plays) ||
    r.plays < 1 ||
    !round(r.round)
  )
    throw new ApiError(copy.form.unexpected);
  return r;
}
function result(value: unknown, roundId: string): HeadToHeadResult {
  const r = value as HeadToHeadResult;
  if (
    !r ||
    r.roundId !== roundId ||
    (r.pick !== 'left' && r.pick !== 'right') ||
    typeof r.correct !== 'boolean' ||
    typeof r.gameOver !== 'boolean' ||
    r.gameOver === r.correct ||
    !r.values ||
    !int(r.values.left) ||
    !int(r.values.right) ||
    r.values.left === r.values.right ||
    !count(r.streak) ||
    !count(r.best) ||
    r.best < r.streak ||
    (r.correct ? !round(r.nextRound) : r.nextRound !== null)
  )
    throw new ApiError(copy.form.unexpected);
  return r;
}

const path = '/v1/games/head-to-head';
export const headToHeadRepository: HeadToHeadRepository = {
  async record(token) {
    return record(await request<unknown>(path, { token }));
  },
  async start(token) {
    return run(
      await request<unknown>(path + '/runs', { token, method: 'POST' }),
    );
  },
  async answer(token, runId, roundId, pick) {
    return result(
      await request<unknown>(
        path + '/runs/' + encodeURIComponent(runId) + '/answers',
        { token, method: 'POST', body: { roundId, pick } },
      ),
      roundId,
    );
  },
};
