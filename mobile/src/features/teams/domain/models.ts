export type Team = {
  id: string;
  name: string;
  footballType: 'unknown' | 'amateur' | 'professional' | 'halisaha';
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
};
export type TeamQuota = {
  included: 3;
  purchased: number;
  earned: number;
  // Rights from Pro periods (+3 per paid or granted period), shown as "Pro hakkı".
  pro: number;
  used: number;
  remaining: number;
  limit: number;
};
export type TeamDetail = {
  team: Team;
  requestStatus: '' | 'pending' | 'accepted' | 'rejected';
  quota?: TeamQuota;
};
export type TeamJoinRequest = {
  id: string;
  playerId?: string;
  playerName?: string;
  clubId?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
};
export type TeamApplication = {
  id: string;
  teamId: string;
  teamName: string;
  teamDistrict: string;
  teamAvailable: boolean;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
};
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type TeamApplicationPage = Page<TeamApplication> & {
  quota: TeamQuota;
};
export interface TeamsRepository {
  list(token: string, page: number, search: string): Promise<Page<Team>>;
  detail(token: string, id: string): Promise<TeamDetail>;
  request(token: string, id: string): Promise<TeamQuota>;
  requests(
    token: string,
    status: string,
    page: number,
  ): Promise<Page<TeamJoinRequest>>;
  applications(token: string, page: number): Promise<TeamApplicationPage>;
  decide(
    token: string,
    id: string,
    decision: 'accepted' | 'rejected',
  ): Promise<void>;
}
