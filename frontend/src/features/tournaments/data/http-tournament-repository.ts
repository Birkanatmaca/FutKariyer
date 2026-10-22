import { ApiError } from '../../../shared/api/client';
import { organizerRequest as request } from '../../../shared/api/organizer-session';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import type {
  Candidate,
  Entry,
  Match,
  Standing,
  Team,
  Tournament,
  TournamentRepository,
  TournamentTable,
} from '../domain/models';

const id = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const text = (value: unknown) => typeof value === 'string';
const time = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;
function fail(): never {
  throw new ApiError(organizerCopy.form.unexpected);
}

function tournament(value: unknown): value is Tournament {
  const item = value as Tournament;
  return (
    !!item &&
    id(item.id) &&
    text(item.name) &&
    ['halisaha', 'seven_a_side', 'eleven_a_side'].includes(item.format) &&
    Array.isArray(item.eligibleTypes) &&
    item.eligibleTypes.every(text) &&
    text(item.district) &&
    text(item.venue) &&
    text(item.description) &&
    text(item.startsOn) &&
    text(item.endsOn) &&
    text(item.applicationDeadline) &&
    count(item.teamCapacity) &&
    ['open', 'closed', 'finished', 'cancelled'].includes(item.status) &&
    count(item.acceptedTeams) &&
    count(item.pendingEntries)
  );
}
function entry(value: unknown): value is Entry {
  const item = value as Entry;
  return (
    !!item &&
    id(item.id) &&
    id(item.clubId) &&
    text(item.clubName) &&
    text(item.clubDistrict) &&
    text(item.message) &&
    [
      'pending',
      'accepted',
      'rejected',
      'withdrawn',
      'invited',
      'declined',
    ].includes(item.status) &&
    (item.players === null ||
      (Array.isArray(item.players) &&
        item.players.every(player => !!player && text(player.name)))) &&
    time(item.createdAt)
  );
}
function team(value: unknown): value is Team {
  const item = value as Team;
  return !!item && id(item.entryId) && text(item.name) && count(item.players);
}
function match(value: unknown): value is Match {
  const item = value as Match;
  return (
    !!item &&
    id(item.id) &&
    Number.isInteger(item.round) &&
    id(item.homeEntryId) &&
    id(item.awayEntryId) &&
    text(item.homeName) &&
    text(item.awayName) &&
    (item.kickoffAt === null || time(item.kickoffAt)) &&
    text(item.venue) &&
    ((item.homeGoals === null && item.awayGoals === null) ||
      (count(item.homeGoals) && count(item.awayGoals)))
  );
}
function standing(value: unknown): value is Standing {
  const item = value as Standing;
  return (
    !!item &&
    id(item.entryId) &&
    text(item.teamName) &&
    [
      item.position,
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
function table(value: unknown): value is TournamentTable {
  const item = value as TournamentTable;
  return (
    !!item &&
    tournament(item.tournament) &&
    Array.isArray(item.teams) &&
    item.teams.every(team) &&
    Array.isArray(item.matches) &&
    item.matches.every(match) &&
    Array.isArray(item.standings) &&
    item.standings.every(standing)
  );
}
function candidate(value: unknown): value is Candidate {
  const item = value as Candidate;
  return !!item && id(item.id) && text(item.name) && text(item.district);
}

const root = '/v1/me/tournaments';
const path = (tournamentId: string, ...rest: string[]) =>
  [root, tournamentId, ...rest].map(encodeURI).join('/');

export const tournamentRepository: TournamentRepository = {
  async mine() {
    const result = await request<{ items?: unknown }>(root);
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(tournament)
    )
      fail();
    return result.items as Tournament[];
  },
  async create(form) {
    const result = await request<{
      tournament?: unknown;
      notifiedClubs?: unknown;
    }>(root, {
      method: 'POST',
      body: {
        ...form,
        name: form.name.trim(),
        district: form.district.trim(),
        venue: form.venue.trim(),
        description: form.description.trim(),
      },
    });
    if (!result || !tournament(result.tournament)) fail();
    return {
      tournament: result.tournament,
      notified: count(result.notifiedClubs)
        ? (result.notifiedClubs as number)
        : 0,
    };
  },
  async setStatus(tournamentId, status) {
    const result = await request<{ tournament?: unknown }>(
      path(tournamentId, 'status'),
      { method: 'PUT', body: { status } },
    );
    if (!result || !tournament(result.tournament)) fail();
    return result.tournament;
  },
  async table(tournamentId) {
    const result = await request<unknown>(path(tournamentId, 'table'));
    if (!table(result) || result.tournament.id !== tournamentId) fail();
    return result;
  },
  async entries(tournamentId) {
    const result = await request<{ items?: unknown }>(
      path(tournamentId, 'entries'),
    );
    if (!result || !Array.isArray(result.items) || !result.items.every(entry))
      fail();
    return (result.items as Entry[]).map(item => ({
      ...item,
      players: item.players ?? [],
    }));
  },
  async decide(tournamentId, entryId, accept) {
    await request<unknown>(path(tournamentId, 'entries', entryId), {
      method: 'PUT',
      body: { decision: accept ? 'accept' : 'reject' },
    });
  },
  async generateFixture(tournamentId, legs) {
    await request<unknown>(path(tournamentId, 'fixture'), {
      method: 'POST',
      body: { legs },
    });
  },
  async clearFixture(tournamentId) {
    await request<unknown>(path(tournamentId, 'fixture'), { method: 'DELETE' });
  },
  async saveMatch(tournamentId, form, matchId) {
    const result = await request<{ match?: unknown }>(
      matchId
        ? path(tournamentId, 'matches', matchId)
        : path(tournamentId, 'matches'),
      { method: matchId ? 'PUT' : 'POST', body: form },
    );
    if (!result || !match(result.match)) fail();
  },
  async removeMatch(tournamentId, matchId) {
    await request<void>(path(tournamentId, 'matches', matchId), {
      method: 'DELETE',
    });
  },
  async candidates(tournamentId, search) {
    const result = await request<{ items?: unknown }>(
      path(tournamentId, 'candidates') + '?q=' + encodeURIComponent(search),
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(candidate)
    )
      fail();
    return result.items as Candidate[];
  },
  async invite(tournamentId, clubId, message) {
    await request<unknown>(path(tournamentId, 'invites'), {
      method: 'POST',
      body: { clubId, message: message.trim() },
    });
  },
  async cancelInvite(tournamentId, entryId) {
    await request<unknown>(path(tournamentId, 'invites', entryId), {
      method: 'DELETE',
    });
  },
};
