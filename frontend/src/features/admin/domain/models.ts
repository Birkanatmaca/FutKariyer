import type { Account } from '../../../shared/domain/account';
export type AdminSection = 'users' | 'clubs';
export type ManagedAccount = Account & {
  footballType: '' | 'unknown' | 'amateur' | 'professional' | 'halisaha';
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
};
export type AccountPage = {
  items: ManagedAccount[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type AccountForm = {
  fullName: string;
  email: string;
  username: string;
  footballType: 'unknown' | 'amateur' | 'professional' | 'halisaha';
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
  password: string;
  role: 'player' | 'coach' | 'club' | 'organizer';
  active: boolean;
  verified: boolean;
};
export type ClubOverviewProfile = {
  userId: string;
  name: string;
  footballType: 'unknown' | 'amateur' | 'professional' | 'halisaha';
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
  updatedAt: string;
};
export type ClubOverviewNews = {
  id: string;
  title: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  published: boolean;
  createdAt: string;
};
export type ClubOverviewApplication = {
  id: string;
  playerName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};
export type ClubOverviewFixture = {
  id: string;
  round: number;
  opponentName: string;
  isHome: boolean;
  kickoffAt: string | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: '' | 'win' | 'draw' | 'loss';
};
export type ClubOverviewLeague = {
  leagueId: string;
  leagueName: string;
  season: string;
  status: 'active' | 'finished';
  teamCount: number;
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  upcoming: ClubOverviewFixture[];
  recent: ClubOverviewFixture[];
};
export type ClubOverview = {
  profile: ClubOverviewProfile;
  email: string;
  active: boolean;
  news: ClubOverviewNews[];
  applications: ClubOverviewApplication[];
  leagues: ClubOverviewLeague[];
};
export type ProStatus = {
  active: boolean;
  expiresAt: string | null;
  privateBrowsing: boolean;
  bonusCredits: number;
};
export type ProAction = 'grant' | 'revoke';
export const proEligibleRoles: readonly string[] = ['player', 'club', 'coach'];
export interface AdminRepository {
  list(
    section: AdminSection,
    page: number,
    search: string,
  ): Promise<AccountPage>;
  get(section: AdminSection, id: string): Promise<ManagedAccount>;
  clubOverview(id: string): Promise<ClubOverview>;
  create(section: AdminSection, form: AccountForm): Promise<ManagedAccount>;
  update(
    section: AdminSection,
    id: string,
    form: AccountForm,
  ): Promise<ManagedAccount>;
  remove(section: AdminSection, id: string): Promise<void>;
  resetPassword(
    section: AdminSection,
    id: string,
    password: string,
  ): Promise<void>;
  proStatus(id: string): Promise<ProStatus>;
  changePro(id: string, action: ProAction): Promise<ProStatus>;
}
