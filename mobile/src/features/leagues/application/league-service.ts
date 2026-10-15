import type { LeagueRepository } from '../domain/models';
export function createLeagueService(repository: LeagueRepository) {
  return {
    list: (token: string, page: number) => repository.list(token, page),
    detail: (token: string, id: string) => repository.detail(token, id),
  };
}
export type LeagueService = ReturnType<typeof createLeagueService>;
