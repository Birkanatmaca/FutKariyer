import type { FootballType } from '../../../shared/domain/football';

// Character limits mirror the server contract for club profile and club news writes.
export const clubProfileLimits = {
  district: 80,
  description: 1000,
  venueName: 120,
  venueAddress: 240,
  trainingGroundName: 120,
  trainingGroundAddress: 240,
  trainingSchedule: 240,
} as const;

export const clubArticleLimits = {
  title: { min: 2, max: 120 },
  summary: { min: 2, max: 300 },
  body: { min: 2, max: 20000 },
} as const;

export type ClubProfile = {
  userId: string;
  name: string;
  footballType: FootballType;
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
  // The club's team on the TFF Ankara standings page; null until linked.
  tff: ClubTffLink | null;
  updatedAt: string;
};

// Ids are the federation page's sezon, lig and grup values; team is the name
// exactly as the page's table writes it.
export type ClubTffLink = {
  season: string;
  league: string;
  group: string;
  team: string;
  label: string;
};

export type ClubTffInput = Omit<ClubTffLink, 'label'>;

export type ClubProfileInput = {
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
};

export type ClubReviewStatus = 'pending' | 'approved' | 'rejected';

export type ClubArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageId: string;
  published: boolean;
  showOnHome: boolean;
  reviewStatus: ClubReviewStatus;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

export type ClubArticleInput = {
  title: string;
  summary: string;
  body: string;
};

export type ClubLeagueStatus = 'active' | 'finished';

export type ClubMatchResult = 'win' | 'draw' | 'loss';

// Upcoming fixtures carry no score; the server sends null scores and an empty result.
// dateOnly: the day is set but the kick-off time is not announced yet.
export type ClubUpcomingFixture = {
  id: string;
  round: number;
  opponentName: string;
  // The rival club's account in Fut Career leagues, for its crest; empty for
  // TFF teams. A version of 0 means no photo.
  opponentId: string;
  opponentAvatarVersion: number;
  isHome: boolean;
  kickoffAt: string | null;
  dateOnly: boolean;
  venue: string;
};

export type ClubRecentFixture = ClubUpcomingFixture & {
  goalsFor: number;
  goalsAgainst: number;
  result: ClubMatchResult;
};

export type ClubStanding = {
  position: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  points: number;
  own: boolean;
};

// "tff": the club's TFF Ankara group; "futcareer": a league run in the app.
export type ClubLeagueSource = 'tff' | 'futcareer';

export type ClubCenterLeague = {
  leagueId: string;
  source: ClubLeagueSource;
  leagueName: string;
  season: string;
  status: ClubLeagueStatus;
  teamCount: number;
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  upcoming: ClubUpcomingFixture[];
  recent: ClubRecentFixture[];
  standings: ClubStanding[];
};

// A club match on the Maçlarım page: played ones carry the score and result.
export type ClubMatch = ClubUpcomingFixture & {
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: ClubMatchResult | '';
};

// One match of a week in the club's group, both sides named.
export type ClubWeekMatch = {
  id: string;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  kickoffAt: string | null;
  dateOnly: boolean;
  venue: string;
  own: boolean;
};

export type ClubWeek = { number: number; matches: ClubWeekMatch[] };

// Maçlarım (20 Oct 2026): the league summary plus every club match oldest
// week first and every week of the group.
export type ClubLeagueDetail = ClubCenterLeague & {
  matches: ClubMatch[];
  weeks: ClubWeek[];
  currentWeek: number;
};

export type ClubLeagues = {
  tffLinked: boolean;
  leagues: ClubLeagueDetail[];
};

// Takımım (20 Oct 2026): a club the coach works for, with its main league.
export type CoachTeam = {
  clubId: string;
  clubName: string;
  avatarVersion: number;
  district: string;
  role: string;
  permissions: string[];
  // Counted only for coaches with the applications right.
  pendingApplications: number;
  squadCount: number;
  tffLinked: boolean;
  league: ClubCenterLeague | null;
};

export type CoachTeams = { teams: CoachTeam[]; invitations: number };

export type ClubCenter = {
  completenessPercent: number;
  missingFields: string[];
  pendingApplications: number;
  pendingNews: number;
  publishedNews: number;
  // True once the club picked its TFF team, even if the page could not be read.
  tffLinked: boolean;
  leagues: ClubCenterLeague[];
};

export interface ClubRepository {
  profile(token: string): Promise<ClubProfile>;
  updateProfile(token: string, input: ClubProfileInput): Promise<ClubProfile>;
  news(token: string): Promise<ClubArticle[]>;
  createNews(token: string, input: ClubArticleInput): Promise<ClubArticle>;
  center(token: string): Promise<ClubCenter>;
  leagues(token: string): Promise<ClubLeagues>;
  coachTeams(token: string): Promise<CoachTeams>;
  setTff(token: string, input: ClubTffInput): Promise<ClubProfile>;
  clearTff(token: string): Promise<ClubProfile>;
}
