import { ApiError } from '../../../shared/api/client';
import type {
  EntryDecision,
  EntryInput,
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

export function createTournamentsService(repository: TournamentsRepository) {
  return {
    open: (token: string, page: number) => repository.open(token, page),
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
