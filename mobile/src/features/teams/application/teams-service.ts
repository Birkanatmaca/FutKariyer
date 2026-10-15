import type { TeamsRepository } from '../domain/models';
export function createTeamsService(repository: TeamsRepository) {
  return {
    list: (token: string, page: number, search: string) =>
      repository.list(token, page, search),
    detail: (token: string, id: string) => repository.detail(token, id),
    request: (token: string, id: string) => repository.request(token, id),
    requests: (token: string, status: string, page: number) =>
      repository.requests(token, status, page),
    applications: (token: string, page: number) =>
      repository.applications(token, page),
    // Total available team application rights for the header badge.
    rightsBalance: (token: string) =>
      repository.applications(token, 1).then(page => page.quota.remaining),
    decide: (token: string, id: string, decision: 'accepted' | 'rejected') =>
      repository.decide(token, id, decision),
  };
}
export type TeamsService = ReturnType<typeof createTeamsService>;
