import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  League,
  LeagueDetail,
  LeagueMatch,
  LeagueRepository,
  LeagueStatistics,
  LeagueTeam,
  Page,
  Standing,
} from '../domain/models';
const id = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
function league(value: unknown): value is League {
  const item = value as League;
  return (
    !!item &&
    id(item.id) &&
    typeof item.name === 'string' &&
    typeof item.season === 'string' &&
    typeof item.description === 'string' &&
    ['active', 'finished'].includes(item.status) &&
    [item.winPoints, item.drawPoints, item.lossPoints].every(
      point => Number.isInteger(point) && point >= 0 && point <= 10,
    ) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt))
  );
}
function validPage<T>(
  value: unknown,
  current: number,
  valid: (item: unknown) => item is T,
): value is Page<T> {
  const result = value as Page<T>;
  return (
    !!result &&
    Array.isArray(result.items) &&
    result.items.length <= 20 &&
    result.items.every(valid) &&
    result.page === current &&
    result.pageSize === 20 &&
    Number.isSafeInteger(result.total) &&
    result.total >= 0 &&
    result.totalPages === Math.ceil(result.total / 20)
  );
}
function team(value: unknown): value is LeagueTeam {
  const item = value as LeagueTeam;
  return (
    !!item &&
    id(item.id) &&
    id(item.clubId) &&
    typeof item.name === 'string' &&
    typeof item.district === 'string'
  );
}
function match(value: unknown): value is LeagueMatch {
  const item = value as LeagueMatch;
  return (
    !!item &&
    id(item.id) &&
    Number.isInteger(item.round) &&
    id(item.homeTeamId) &&
    id(item.awayTeamId) &&
    typeof item.homeName === 'string' &&
    typeof item.awayName === 'string' &&
    (item.kickoffAt === null ||
      (typeof item.kickoffAt === 'string' &&
        Number.isFinite(Date.parse(item.kickoffAt)))) &&
    ((item.homeGoals === null && item.awayGoals === null) ||
      (Number.isInteger(item.homeGoals) &&
        Number.isInteger(item.awayGoals) &&
        item.homeGoals! >= 0 &&
        item.homeGoals! <= 50 &&
        item.awayGoals! >= 0 &&
        item.awayGoals! <= 50))
  );
}
function standing(value: unknown): value is Standing {
  const item = value as Standing;
  return (
    !!item &&
    Number.isInteger(item.position) &&
    id(item.teamId) &&
    id(item.clubId) &&
    typeof item.teamName === 'string' &&
    [
      item.played,
      item.wins,
      item.draws,
      item.losses,
      item.goalsFor,
      item.goalsAgainst,
      item.goalDifference,
      item.points,
    ].every(Number.isSafeInteger)
  );
}
function statistics(value: unknown): value is LeagueStatistics {
  const item = value as LeagueStatistics;
  return (
    !!item &&
    [
      item.teamCount,
      item.matchCount,
      item.playedMatches,
      item.scheduledMatches,
      item.totalGoals,
      item.homeWins,
      item.draws,
      item.awayWins,
    ].every(Number.isSafeInteger) &&
    Number.isFinite(item.averageGoals)
  );
}
function detail(value: unknown): value is LeagueDetail {
  const item = value as LeagueDetail;
  return (
    !!item &&
    league(item.league) &&
    Array.isArray(item.teams) &&
    item.teams.every(team) &&
    Array.isArray(item.matches) &&
    item.matches.every(match) &&
    Array.isArray(item.standings) &&
    item.standings.every(standing) &&
    statistics(item.statistics)
  );
}
export const leagueRepository: LeagueRepository = {
  async list(token, current) {
    const result = await request<Page<League>>('/v1/leagues?page=' + current, {
      token,
    });
    if (!validPage(result, current, league))
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async detail(token, leagueId) {
    const result = await request<unknown>(
      '/v1/leagues/' + encodeURIComponent(leagueId),
      { token },
    );
    if (!detail(result) || result.league.id !== leagueId)
      throw new ApiError(copy.form.unexpected);
    return result;
  },
};
