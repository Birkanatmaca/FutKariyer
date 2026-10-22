import type { FootballType } from '../../../shared/domain/football';

// A player in the club's squad. The squad list is visible to the club only.
export type SquadMember = {
  playerId: string;
  name: string;
  position: string;
  footballType: FootballType;
  joinedAt: string;
};

// A club whose squad the signed-in player belongs to.
export type Membership = {
  clubId: string;
  clubName: string;
  district: string;
  joinedAt: string;
};

// Club squad invitations (22 Oct 2026): the club invites a discoverable
// player; accepting adds the player to the squad.
export type SquadInviteStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled';
export type SquadInviteDecision = 'accept' | 'decline';

export const squadInviteStatuses: SquadInviteStatus[] = [
  'pending',
  'accepted',
  'declined',
  'cancelled',
];

export const squadInviteLimits = {
  message: 300,
  search: { min: 2, max: 80 },
} as const;

export type SquadInvite = {
  id: string;
  clubId: string;
  clubName: string;
  playerId: string;
  playerName: string;
  position: string;
  message: string;
  status: SquadInviteStatus;
  createdAt: string;
  decidedAt: string | null;
};

// A discoverable player who is not in the squad and has no open invitation.
export type PlayerCandidate = { id: string; name: string; position: string };

// The club's list keeps open invitations first, then recently answered ones.
export function splitClubInvites(invites: SquadInvite[]) {
  return {
    open: invites.filter(invite => invite.status === 'pending'),
    answered: invites.filter(invite => invite.status !== 'pending'),
  };
}

export interface SquadRepository {
  candidates(token: string, query: string): Promise<PlayerCandidate[]>;
  clubInvites(token: string): Promise<SquadInvite[]>;
  invite(
    token: string,
    playerId: string,
    message: string,
  ): Promise<SquadInvite>;
  cancelInvite(token: string, id: string): Promise<SquadInvite>;
  playerInvites(token: string): Promise<SquadInvite[]>;
  respondInvite(
    token: string,
    id: string,
    decision: SquadInviteDecision,
  ): Promise<SquadInvite>;
  squad(token: string): Promise<SquadMember[]>;
  removeMember(token: string, playerId: string): Promise<void>;
  memberships(token: string): Promise<Membership[]>;
  leaveClub(token: string, clubId: string): Promise<void>;
}
