import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  ClubOption,
  League,
  LeagueDetail,
  LeagueForm,
  LeagueMatch,
  LeagueRepository,
  LeagueTeam,
  LeagueStatistics,
  MatchForm,
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
    ['draft', 'active', 'finished'].includes(item.status) &&
    [item.winPoints, item.drawPoints, item.lossPoints].every(
      point => Number.isInteger(point) && point >= 0 && point <= 10,
    ) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt))
  );
}
function page<T>(
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
function club(value: unknown): value is ClubOption {
  const item = value as ClubOption;
  return !!item && id(item.id) && typeof item.fullName === 'string';
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
function validDetail(value: unknown): value is LeagueDetail {
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
const root = '/v1/admin/leagues';

export const leagueRepository: LeagueRepository = {
  async list(current) {
    const result = await request<Page<League>>(root + '?page=' + current);
    if (!page(result, current, league))
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async detail(leagueId) {
    const result = await request<unknown>(
      root + '/' + encodeURIComponent(leagueId),
    );
    if (!validDetail(result) || result.league.id !== leagueId)
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async save(form: LeagueForm, leagueId?: string) {
    const result = await request<{ league: unknown }>(
      root + (leagueId ? '/' + encodeURIComponent(leagueId) : ''),
      { method: leagueId ? 'PUT' : 'POST', body: form },
    );
    if (
      !result ||
      !league(result.league) ||
      (leagueId && result.league.id !== leagueId)
    )
      throw new ApiError(copy.form.unexpected);
    return result.league;
  },
  async remove(leagueId) {
    await request<void>(root + '/' + encodeURIComponent(leagueId), {
      method: 'DELETE',
    });
  },
  async clubs(search, current) {
    const result = await request<Page<ClubOption>>(
      root + '/clubs?search=' + encodeURIComponent(search) + '&page=' + current,
    );
    if (!page(result, current, club)) throw new ApiError(copy.form.unexpected);
    return result;
  },
  async addTeam(leagueId, clubId) {
    const result = await request<{ team: unknown }>(
      root + '/' + encodeURIComponent(leagueId) + '/teams',
      { method: 'POST', body: { clubId } },
    );
    if (!result || !team(result.team)) throw new ApiError(copy.form.unexpected);
  },
  async removeTeam(leagueId, teamId) {
    await request<void>(
      root +
        '/' +
        encodeURIComponent(leagueId) +
        '/teams/' +
        encodeURIComponent(teamId),
      { method: 'DELETE' },
    );
  },
  async saveMatch(leagueId, form: MatchForm, matchId?: string) {
    const result = await request<{ match: unknown }>(
      root +
        '/' +
        encodeURIComponent(leagueId) +
        '/matches' +
        (matchId ? '/' + encodeURIComponent(matchId) : ''),
      { method: matchId ? 'PUT' : 'POST', body: form },
    );
    if (
      !result ||
      !match(result.match) ||
      (matchId && result.match.id !== matchId)
    )
      throw new ApiError(copy.form.unexpected);
  },
  async removeMatch(leagueId, matchId) {
    await request<void>(
      root +
        '/' +
        encodeURIComponent(leagueId) +
        '/matches/' +
        encodeURIComponent(matchId),
      { method: 'DELETE' },
    );
  },
};
