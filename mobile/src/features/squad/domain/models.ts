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

export interface SquadRepository {
  squad(token: string): Promise<SquadMember[]>;
  removeMember(token: string, playerId: string): Promise<void>;
  memberships(token: string): Promise<Membership[]>;
  leaveClub(token: string, clubId: string): Promise<void>;
}
