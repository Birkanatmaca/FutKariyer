export type LeagueStatus = 'draft' | 'active' | 'finished';
export type League = {
  id: string;
  name: string;
  season: string;
  description: string;
  status: LeagueStatus;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  createdAt: string;
  updatedAt: string;
};
export type ClubOption = { id: string; fullName: string };
export type LeagueTeam = {
  id: string;
  clubId: string;
  name: string;
  district: string;
};
export type LeagueMatch = {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  kickoffAt: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
};
export type Standing = {
  position: number;
  teamId: string;
  clubId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
export type LeagueStatistics = {
  teamCount: number;
  matchCount: number;
  playedMatches: number;
  scheduledMatches: number;
  totalGoals: number;
  averageGoals: number;
  homeWins: number;
  draws: number;
  awayWins: number;
};
export type LeagueDetail = {
  league: League;
  teams: LeagueTeam[];
  matches: LeagueMatch[];
  standings: Standing[];
  statistics: LeagueStatistics;
};
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type LeagueForm = Omit<League, 'id' | 'createdAt' | 'updatedAt'>;
export type MatchForm = {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
};
export interface LeagueRepository {
  list(page: number): Promise<Page<League>>;
  detail(id: string): Promise<LeagueDetail>;
  save(form: LeagueForm, id?: string): Promise<League>;
  remove(id: string): Promise<void>;
  clubs(search: string, page: number): Promise<Page<ClubOption>>;
  addTeam(leagueId: string, clubId: string): Promise<void>;
  removeTeam(leagueId: string, teamId: string): Promise<void>;
  saveMatch(leagueId: string, form: MatchForm, id?: string): Promise<void>;
  removeMatch(leagueId: string, matchId: string): Promise<void>;
}
