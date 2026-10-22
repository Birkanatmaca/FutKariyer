import type {
  MatchForm,
  TournamentForm,
  TournamentRepository,
  TournamentStatus,
} from '../domain/models';

export function createTournamentService(repository: TournamentRepository) {
  return {
    mine: () => repository.mine(),
    create: (form: TournamentForm) => repository.create(form),
    setStatus: (id: string, status: TournamentStatus) =>
      repository.setStatus(id, status),
    table: (id: string) => repository.table(id),
    entries: (id: string) => repository.entries(id),
    decide: (id: string, entryId: string, accept: boolean) =>
      repository.decide(id, entryId, accept),
    generateFixture: (id: string, legs: 1 | 2) =>
      repository.generateFixture(id, legs),
    clearFixture: (id: string) => repository.clearFixture(id),
    saveMatch: (id: string, form: MatchForm, matchId?: string) =>
      repository.saveMatch(id, form, matchId),
    removeMatch: (id: string, matchId: string) =>
      repository.removeMatch(id, matchId),
    candidates: (id: string, search: string) =>
      repository.candidates(id, search),
    invite: (id: string, clubId: string, message: string) =>
      repository.invite(id, clubId, message),
    cancelInvite: (id: string, entryId: string) =>
      repository.cancelInvite(id, entryId),
  };
}
export type TournamentService = ReturnType<typeof createTournamentService>;
