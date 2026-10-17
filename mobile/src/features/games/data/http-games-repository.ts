import { ApiError, apiUrl, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { passingScore, questionCount } from '../domain/models';
import type {
  GameFeedback,
  GameQuestion,
  GameRun,
  GameState,
  GamesRepository,
  PenaltyMatch,
  PlayCount,
  Side,
} from '../domain/models';
const id = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const count = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v));
function question(v: unknown): v is GameQuestion {
  const q = v as GameQuestion;
  return (
    !!q &&
    id(q.id) &&
    ['easy', 'medium', 'hard'].includes(q.difficulty) &&
    Array.isArray(q.clubs) &&
    // New runs have 3-5 clues; runs saved before the large pool may have 2.
    q.clubs.length >= 2 &&
    q.clubs.length <= 5 &&
    q.clubs.every(
      c =>
        !!c &&
        /^[a-z0-9-]{1,40}$/.test(c.id) &&
        typeof c.name === 'string' &&
        c.name.length > 0 &&
        typeof c.hasCrest === 'boolean',
    ) &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every(
      o => !!o && id(o.id) && typeof o.name === 'string' && o.name.length > 0,
    ) &&
    new Set(q.options.map(o => o.id)).size === 4
  );
}
function feedback(v: unknown): v is GameFeedback {
  const f = v as GameFeedback;
  return (
    !!f &&
    id(f.questionId) &&
    id(f.selectedOptionId) &&
    id(f.correctOptionId) &&
    typeof f.correctName === 'string' &&
    typeof f.correct === 'boolean' &&
    f.correct === (f.selectedOptionId === f.correctOptionId)
  );
}
function run(v: unknown): v is GameRun {
  const r = v as GameRun;
  return (
    !!r &&
    id(r.id) &&
    ['active', 'finished'].includes(r.status) &&
    count(r.answered) &&
    r.answered <= questionCount &&
    count(r.score) &&
    r.score <= r.answered &&
    typeof r.passed === 'boolean' &&
    r.passed === (r.status === 'finished' && r.score >= passingScore) &&
    (r.status === 'active'
      ? r.answered < questionCount && question(r.question)
      : r.answered === questionCount && r.question === null) &&
    (r.answered === 0 ? r.feedback === null : feedback(r.feedback))
  );
}
const side = (v: unknown): v is Side =>
  v === 'left' || v === 'center' || v === 'right';
function penalty(v: unknown): v is PenaltyMatch {
  const m = v as PenaltyMatch;
  return (
    !!m &&
    id(m.id) &&
    ['active', 'finished'].includes(m.status) &&
    Array.isArray(m.kicks) &&
    m.kicks.length <= 1000 &&
    m.kicks.every(
      k =>
        !!k &&
        ['shooter', 'keeper'].includes(k.role) &&
        side(k.userSide) &&
        side(k.cpuSide) &&
        typeof k.scored === 'boolean',
    ) &&
    !!m.goals &&
    count(m.goals.user) &&
    count(m.goals.cpu) &&
    (m.winner === null || m.winner === 'user' || m.winner === 'cpu') &&
    (m.status === 'active' ? m.winner === null : m.winner !== null) &&
    ['shooter', 'keeper', ''].includes(m.nextRole)
  );
}
const plays = (v: unknown): v is PlayCount => {
  const p = v as PlayCount;
  return (
    !!p && count(p.used) && count(p.limit) && p.limit > 0 && p.used <= p.limit
  );
};
function checked(value: unknown): GameState {
  const s = value as GameState;
  if (
    !s ||
    !s.plays ||
    !plays(s.plays.footballGuess) ||
    !plays(s.plays.penalty) ||
    !plays(s.plays.headToHead) ||
    !date(s.serverTime) ||
    !date(s.nextResetAt) ||
    typeof s.ratingActive !== 'boolean' ||
    !s.stats ||
    ![
      s.stats.played,
      s.stats.wins,
      s.stats.bestScore,
      s.stats.seasonPoints,
    ].every(count) ||
    s.stats.wins > s.stats.played ||
    s.stats.bestScore > 10 ||
    (s.run !== null && !run(s.run)) ||
    (s.penalty !== null && !penalty(s.penalty))
  )
    throw new ApiError(copy.form.unexpected);
  if (s.run?.question) {
    s.run.question.clubs = s.run.question.clubs.map(c => ({
      ...c,
      logoUrl: c.hasCrest ? apiUrl('/v1/games/logos/' + c.id) : '',
    }));
  }
  return s;
}
const path = '/v1/games/football-guess';
const penaltyPath = '/v1/games/penalty';
export const gamesRepository: GamesRepository = {
  async state(token) {
    return checked(await request<unknown>(path, { token }));
  },
  async start(token) {
    return checked(
      await request<unknown>(path + '/runs', { token, method: 'POST' }),
    );
  },
  async penaltyStart(token) {
    return checked(
      await request<unknown>(penaltyPath + '/shootouts', {
        token,
        method: 'POST',
      }),
    );
  },
  async penaltyKick(token, matchId, index, kickSide) {
    return checked(
      await request<unknown>(
        penaltyPath + '/shootouts/' + encodeURIComponent(matchId) + '/kicks',
        { token, method: 'POST', body: { index, side: kickSide } },
      ),
    );
  },
  async answer(token, runId, questionId, optionId) {
    return checked(
      await request<unknown>(
        path + '/runs/' + encodeURIComponent(runId) + '/answers',
        { token, method: 'POST', body: { questionId, optionId } },
      ),
    );
  },
};
