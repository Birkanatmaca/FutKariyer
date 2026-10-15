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
  updatedAt: string;
};

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
export type ClubUpcomingFixture = {
  id: string;
  round: number;
  opponentName: string;
  isHome: boolean;
  kickoffAt: string | null;
};

export type ClubRecentFixture = ClubUpcomingFixture & {
  goalsFor: number;
  goalsAgainst: number;
  result: ClubMatchResult;
};

export type ClubCenterLeague = {
  leagueId: string;
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
};

export type ClubCenter = {
  completenessPercent: number;
  missingFields: string[];
  pendingApplications: number;
  pendingNews: number;
  publishedNews: number;
  leagues: ClubCenterLeague[];
};

export interface ClubRepository {
  profile(token: string): Promise<ClubProfile>;
  updateProfile(token: string, input: ClubProfileInput): Promise<ClubProfile>;
  news(token: string): Promise<ClubArticle[]>;
  createNews(token: string, input: ClubArticleInput): Promise<ClubArticle>;
  center(token: string): Promise<ClubCenter>;
}
