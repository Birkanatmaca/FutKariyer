import type { SquadRepository } from '../domain/models';

export function createSquadService(repository: SquadRepository) {
  return {
    squad: (token: string) => repository.squad(token),
    removeMember: (token: string, playerId: string) =>
      repository.removeMember(token, playerId),
    memberships: (token: string) => repository.memberships(token),
    leaveClub: (token: string, clubId: string) =>
      repository.leaveClub(token, clubId),
  };
}

export type SquadService = ReturnType<typeof createSquadService>;
