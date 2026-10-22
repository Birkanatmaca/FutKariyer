import { ApiError } from '../../../shared/api/client';
import type {
  EntryDecision,
  EntryInput,
  FixtureLegs,
  InviteDecision,
  MatchInput,
  TournamentInput,
  TournamentStatus,
  TournamentsRepository,
} from '../domain/models';

const trimInput = (input: TournamentInput): TournamentInput => ({
  ...input,
  name: input.name.trim(),
  district: input.district.trim(),
  venue: input.venue.trim(),
  description: input.description.trim(),
  startsOn: input.startsOn.trim(),
  endsOn: input.endsOn.trim(),
  applicationDeadline: input.applicationDeadline.trim(),
});

const trimMatch = (input: MatchInput): MatchInput => ({
  ...input,
  venue: input.venue.trim(),
});

export function createTournamentsService(repository: TournamentsRepository) {
  return {
    open: (token: string, page: number) => repository.open(token, page),
    halisaha: (token: string, page: number) => repository.halisaha(token, page),
    table: (token: string, id: string) => repository.table(token, id),
    // A declined invitation carries no roster.
    respond: (
      token: string,
      entryId: string,
      decision: InviteDecision,
      playerIds: string[] = [],
    ) =>
      repository.respond(
        token,
        entryId,
        decision,
        decision === 'accept' ? playerIds : [],
      ),
    organizerTable: (token: string, id: string) =>
      repository.organizerTable(token, id),
    generateFixture: (token: string, id: string, legs: FixtureLegs) =>
      repository.generateFixture(token, id, legs),
    clearFixture: (token: string, id: string) =>
      repository.clearFixture(token, id),
    saveMatch: (
      token: string,
      id: string,
      matchId: string | null,
      input: MatchInput,
    ) =>
      matchId
        ? repository.updateMatch(token, id, matchId, trimMatch(input))
        : repository.createMatch(token, id, trimMatch(input)),
    deleteMatch: (token: string, id: string, matchId: string) =>
      repository.deleteMatch(token, id, matchId),
    candidates: (token: string, id: string, query: string) =>
      repository.candidates(token, id, query.trim()),
    invite: (token: string, id: string, clubId: string, message: string) =>
      repository.invite(token, id, clubId, message.trim()),
    cancelInvite: (token: string, id: string, entryId: string) =>
      repository.cancelInvite(token, id, entryId),
    // Organizer notifications about entries and invitations carry an entry
    // id; the tournament is found among the organizer's own tournaments.
    organizerTournamentOf: async (token: string, resourceId: string) => {
      const mine = await repository.mine(token);
      if (mine.some(item => item.id === resourceId)) return resourceId;
      for (const tournament of mine) {
        const entries = await repository.entries(token, tournament.id);
        if (entries.some(entry => entry.id === resourceId)) {
          return tournament.id;
        }
      }
      return null;
    },
    detail: (token: string, id: string) => repository.detail(token, id),
    // Resolves to null when the tournament was cancelled or the id is not a
    // tournament, e.g. an entry id carried by a decision notification.
    find: async (token: string, id: string) => {
      try {
        return await repository.detail(token, id);
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 404) return null;
        throw failure;
      }
    },
    enter: (token: string, id: string, input: EntryInput) =>
      repository.enter(token, id, {
        message: input.message.trim(),
        playerIds: input.playerIds,
      }),
    myEntries: (token: string) => repository.myEntries(token),
    withdraw: (token: string, entryId: string) =>
      repository.withdraw(token, entryId),
    mine: (token: string) => repository.mine(token),
    create: (token: string, input: TournamentInput) =>
      repository.create(token, trimInput(input)),
    setStatus: (token: string, id: string, status: TournamentStatus) =>
      repository.setStatus(token, id, status),
    entries: (token: string, id: string) => repository.entries(token, id),
    decide: (
      token: string,
      id: string,
      entryId: string,
      decision: EntryDecision,
    ) => repository.decide(token, id, entryId, decision),
  };
}

export type TournamentsService = ReturnType<typeof createTournamentsService>;
