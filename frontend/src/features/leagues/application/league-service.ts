import type { LeagueForm, LeagueRepository, MatchForm } from '../domain/models';

export function createLeagueService(repository: LeagueRepository) {
  return {
    list: (page: number) => repository.list(page),
    detail: (id: string) => repository.detail(id),
    save: (form: LeagueForm, id?: string) => repository.save(form, id),
    remove: (id: string) => repository.remove(id),
    clubs: (search: string, page: number) => repository.clubs(search, page),
    addTeam: (leagueId: string, clubId: string) =>
      repository.addTeam(leagueId, clubId),
    removeTeam: (leagueId: string, teamId: string) =>
      repository.removeTeam(leagueId, teamId),
    saveMatch: (leagueId: string, form: MatchForm, id?: string) =>
      repository.saveMatch(leagueId, form, id),
    removeMatch: (leagueId: string, matchId: string) =>
      repository.removeMatch(leagueId, matchId),
  };
}
export type LeagueService = ReturnType<typeof createLeagueService>;
