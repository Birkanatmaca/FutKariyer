import type {
  AdminGateway,
  ClubOption,
  League,
  LeagueDetail,
  LeagueMatch,
  LeaguesRepository,
  LeagueTeam,
  Standing,
} from '../domain/models';
import {
  isId,
  isListOf,
  isOneOf,
  isPage,
  isRecord,
  isText,
  isTimestamp,
  segment,
  unexpected,
} from './validators';

const root = '/v1/admin/leagues';
const isPoint = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10;
const isGoal = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 50;

export function isLeague(value: unknown): value is League {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isText(value.name) &&
    isText(value.season) &&
    isText(value.description) &&
    isOneOf(value.status, ['draft', 'active', 'finished']) &&
    isPoint(value.winPoints) &&
    isPoint(value.drawPoints) &&
    isPoint(value.lossPoints) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}
function isClubOption(value: unknown): value is ClubOption {
  return isRecord(value) && isId(value.id) && isText(value.fullName);
}
function isTeam(value: unknown): value is LeagueTeam {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isId(value.clubId) &&
    isText(value.name) &&
    isText(value.district)
  );
}
export function isMatch(value: unknown): value is LeagueMatch {
  return (
    isRecord(value) &&
    isId(value.id) &&
    Number.isInteger(value.round) &&
    isId(value.homeTeamId) &&
    isId(value.awayTeamId) &&
    isText(value.homeName) &&
    isText(value.awayName) &&
    (value.kickoffAt === null || isTimestamp(value.kickoffAt)) &&
    // Scores are entered together or not at all.
    ((value.homeGoals === null && value.awayGoals === null) ||
      (isGoal(value.homeGoals) && isGoal(value.awayGoals)))
  );
}
function isStanding(value: unknown): value is Standing {
  return (
    isRecord(value) &&
    Number.isInteger(value.position) &&
    isId(value.teamId) &&
    isId(value.clubId) &&
    isText(value.teamName) &&
    [
      value.played,
      value.wins,
      value.draws,
      value.losses,
      value.goalsFor,
      value.goalsAgainst,
      value.goalDifference,
      value.points,
    ].every(Number.isSafeInteger)
  );
}
export function isLeagueDetail(value: unknown): value is LeagueDetail {
  if (!isRecord(value) || !isRecord(value.statistics)) return false;
  const stats = value.statistics;
  return (
    isLeague(value.league) &&
    isListOf(value.teams, isTeam) &&
    isListOf(value.matches, isMatch) &&
    isListOf(value.standings, isStanding) &&
    [
      stats.teamCount,
      stats.matchCount,
      stats.playedMatches,
      stats.scheduledMatches,
      stats.totalGoals,
      stats.homeWins,
      stats.draws,
      stats.awayWins,
    ].every(Number.isSafeInteger) &&
    Number.isFinite(stats.averageGoals)
  );
}
function leaguePath(id: string) {
  return root + '/' + segment(id);
}

export function createLeaguesRepository(
  gateway: AdminGateway,
): LeaguesRepository {
  return {
    async list(page) {
      const result = await gateway.request<unknown>(root + '?page=' + page);
      if (!isPage(result, isLeague, page, 20)) unexpected();
      return result;
    },
    async detail(id) {
      const result = await gateway.request<unknown>(leaguePath(id));
      if (!isLeagueDetail(result) || result.league.id !== id) unexpected();
      return result;
    },
    async save(form, id) {
      const result = await gateway.request<unknown>(
        id ? leaguePath(id) : root,
        { method: id ? 'PUT' : 'POST', body: form },
      );
      if (
        !isRecord(result) ||
        !isLeague(result.league) ||
        (id && result.league.id !== id)
      )
        unexpected();
      return result.league as League;
    },
    async remove(id) {
      await gateway.request<void>(leaguePath(id), { method: 'DELETE' });
    },
    async clubs(search, page) {
      const result = await gateway.request<unknown>(
        root + '/clubs?search=' + encodeURIComponent(search) + '&page=' + page,
      );
      if (!isPage(result, isClubOption, page, 20)) unexpected();
      return result;
    },
    async addTeam(leagueId, clubId) {
      const result = await gateway.request<unknown>(
        leaguePath(leagueId) + '/teams',
        { method: 'POST', body: { clubId } },
      );
      if (!isRecord(result) || !isTeam(result.team)) unexpected();
    },
    async removeTeam(leagueId, teamId) {
      await gateway.request<void>(
        leaguePath(leagueId) + '/teams/' + segment(teamId),
        { method: 'DELETE' },
      );
    },
    async saveMatch(leagueId, form, id) {
      const result = await gateway.request<unknown>(
        leaguePath(leagueId) + '/matches' + (id ? '/' + segment(id) : ''),
        { method: id ? 'PUT' : 'POST', body: form },
      );
      if (
        !isRecord(result) ||
        !isMatch(result.match) ||
        (id && result.match.id !== id)
      )
        unexpected();
    },
    async removeMatch(leagueId, matchId) {
      await gateway.request<void>(
        leaguePath(leagueId) + '/matches/' + segment(matchId),
        { method: 'DELETE' },
      );
    },
  };
}
