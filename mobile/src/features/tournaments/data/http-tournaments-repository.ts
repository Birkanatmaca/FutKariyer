import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  entryStatuses,
  tournamentFormats,
  tournamentLimits,
  tournamentPageSize,
  tournamentStatuses,
  tournamentTeamTypes,
  type CreatedTournament,
  type EntryPlayer,
  type Tournament,
  type TournamentEntry,
  type TournamentPage,
  type TournamentsRepository,
} from '../domain/models';

const idPattern = /^[a-f0-9]{32}$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const footballTypes = ['unknown', 'amateur', 'professional', 'halisaha'];

const validId = (value: unknown) =>
  typeof value === 'string' && idPattern.test(value);
const validDay = (value: unknown) =>
  typeof value === 'string' &&
  dayPattern.test(value) &&
  Number.isFinite(Date.parse(value));
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const isCount = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isText = (value: unknown) => typeof value === 'string';

function validTypes(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= tournamentTeamTypes.length &&
    new Set(value).size === value.length &&
    value.every(item => (tournamentTeamTypes as unknown[]).includes(item))
  );
}

export function isTournament(value: unknown): value is Tournament {
  const item = value as Tournament;
  const { min, max } = tournamentLimits.capacity;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.id) &&
    validId(item.organizerId) &&
    [
      item.organizerName,
      item.name,
      item.district,
      item.venue,
      item.description,
    ].every(isText) &&
    tournamentFormats.includes(item.format) &&
    validTypes(item.eligibleTypes) &&
    [item.startsOn, item.endsOn, item.applicationDeadline].every(validDay) &&
    Number.isInteger(item.teamCapacity) &&
    item.teamCapacity >= min &&
    item.teamCapacity <= max &&
    tournamentStatuses.includes(item.status) &&
    isCount(item.acceptedTeams) &&
    isCount(item.pendingEntries) &&
    validDate(item.createdAt)
  );
}

function isEntryPlayer(value: unknown): value is EntryPlayer {
  const item = value as EntryPlayer;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.id) &&
    isText(item.name) &&
    isText(item.position)
  );
}

export function isTournamentEntry(value: unknown): value is TournamentEntry {
  const item = value as TournamentEntry;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.id) &&
    validId(item.tournamentId) &&
    validId(item.clubId) &&
    [item.tournamentName, item.clubName, item.clubDistrict, item.message].every(
      isText,
    ) &&
    tournamentStatuses.includes(item.tournamentStatus) &&
    footballTypes.includes(item.clubFootballType) &&
    entryStatuses.includes(item.status) &&
    Array.isArray(item.players) &&
    item.players.length <= tournamentLimits.roster &&
    item.players.every(isEntryPlayer) &&
    validDate(item.createdAt) &&
    (item.decidedAt === null || validDate(item.decidedAt))
  );
}

const isOpenTournament = (value: unknown): value is Tournament =>
  isTournament(value) && value.status === 'open';

export function isTournamentPage(
  value: unknown,
  page: number,
): value is TournamentPage {
  const result = value as TournamentPage;
  return (
    !!result &&
    Array.isArray(result.items) &&
    result.items.every(isOpenTournament) &&
    result.page === page &&
    result.pageSize === tournamentPageSize &&
    isCount(result.total) &&
    result.totalPages === Math.ceil(result.total / tournamentPageSize)
  );
}

function invalid(): never {
  throw new ApiError(copy.form.unexpected);
}

function list<T>(result: unknown, valid: (item: unknown) => item is T): T[] {
  const items = (result as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || !items.every(valid)) invalid();
  return items;
}

function field(result: unknown, key: 'tournament' | 'entry'): unknown {
  return (result as Record<string, unknown> | null)?.[key];
}

const path = (id: string) => encodeURIComponent(id);

export const tournamentsRepository: TournamentsRepository = {
  async open(token, page) {
    const result = await request<unknown>('/v1/tournaments?page=' + page, {
      token,
    });
    if (!isTournamentPage(result, page)) invalid();
    return result;
  },
  async detail(token, id) {
    const tournament = field(
      await request<unknown>('/v1/tournaments/' + path(id), { token }),
      'tournament',
    );
    if (!isTournament(tournament) || tournament.id !== id) invalid();
    return tournament;
  },
  async enter(token, id, input) {
    const entry = field(
      await request<unknown>('/v1/tournaments/' + path(id) + '/entries', {
        method: 'POST',
        token,
        body: input,
      }),
      'entry',
    );
    if (
      !isTournamentEntry(entry) ||
      entry.tournamentId !== id ||
      entry.status !== 'pending'
    )
      invalid();
    return entry;
  },
  async myEntries(token) {
    return list(
      await request<unknown>('/v1/me/tournament-entries', { token }),
      isTournamentEntry,
    );
  },
  async withdraw(token, entryId) {
    const entry = field(
      await request<unknown>(
        '/v1/me/tournament-entries/' + path(entryId) + '/withdraw',
        { method: 'PUT', token },
      ),
      'entry',
    );
    if (
      !isTournamentEntry(entry) ||
      entry.id !== entryId ||
      entry.status !== 'withdrawn'
    )
      invalid();
    return entry;
  },
  async mine(token) {
    return list(
      await request<unknown>('/v1/me/tournaments', { token }),
      isTournament,
    );
  },
  async create(token, input) {
    const result = await request<unknown>('/v1/me/tournaments', {
      method: 'POST',
      token,
      body: input,
    });
    const created = result as CreatedTournament | null;
    if (
      !created ||
      !isOpenTournament(created.tournament) ||
      !isCount(created.notifiedClubs)
    )
      invalid();
    return created;
  },
  async setStatus(token, id, status) {
    const tournament = field(
      await request<unknown>('/v1/me/tournaments/' + path(id) + '/status', {
        method: 'PUT',
        token,
        body: { status },
      }),
      'tournament',
    );
    if (
      !isTournament(tournament) ||
      tournament.id !== id ||
      tournament.status !== status
    )
      invalid();
    return tournament;
  },
  async entries(token, id) {
    const items = list(
      await request<unknown>('/v1/me/tournaments/' + path(id) + '/entries', {
        token,
      }),
      isTournamentEntry,
    );
    if (!items.every(entry => entry.tournamentId === id)) invalid();
    return items;
  },
  async decide(token, id, entryId, decision) {
    const entry = field(
      await request<unknown>(
        '/v1/me/tournaments/' + path(id) + '/entries/' + path(entryId),
        { method: 'PUT', token, body: { decision } },
      ),
      'entry',
    );
    if (
      !isTournamentEntry(entry) ||
      entry.id !== entryId ||
      entry.tournamentId !== id ||
      // A repeated decision returns the entry as it already was.
      (entry.status !== 'accepted' && entry.status !== 'rejected')
    )
      invalid();
    return entry;
  },
};
