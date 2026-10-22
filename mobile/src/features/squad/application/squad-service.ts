import type { SquadInviteDecision, SquadRepository } from '../domain/models';

export function createSquadService(repository: SquadRepository) {
  return {
    candidates: (token: string, query: string) =>
      repository.candidates(token, query.trim()),
    clubInvites: (token: string) => repository.clubInvites(token),
    invite: (token: string, playerId: string, message: string) =>
      repository.invite(token, playerId, message.trim()),
    cancelInvite: (token: string, id: string) =>
      repository.cancelInvite(token, id),
    playerInvites: (token: string) => repository.playerInvites(token),
    respondInvite: (token: string, id: string, decision: SquadInviteDecision) =>
      repository.respondInvite(token, id, decision),
    squad: (token: string) => repository.squad(token),
    removeMember: (token: string, playerId: string) =>
      repository.removeMember(token, playerId),
    memberships: (token: string) => repository.memberships(token),
    leaveClub: (token: string, clubId: string) =>
      repository.leaveClub(token, clubId),
  };
}

export type SquadService = ReturnType<typeof createSquadService>;
