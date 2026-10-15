export type League = {
  id: string;
  name: string;
  season: string;
  description: string;
  status: 'active' | 'finished';
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  createdAt: string;
  updatedAt: string;
};
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
export interface LeagueRepository {
  list(token: string, page: number): Promise<Page<League>>;
  detail(token: string, id: string): Promise<LeagueDetail>;
}
