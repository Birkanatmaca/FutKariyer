import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  clubProfileLimits,
  type ClubArticle,
  type ClubArticleInput,
  type ClubCenter,
  type ClubCenterLeague,
  type ClubProfile,
  type ClubProfileInput,
  type ClubRecentFixture,
  type ClubRepository,
  type ClubUpcomingFixture,
} from '../domain/models';

const imageIdPattern = /^[a-f0-9]{32}$/;
const footballTypes = ['unknown', 'amateur', 'professional', 'halisaha'];
const reviewStatuses = ['pending', 'approved', 'rejected'];
const leagueStatuses = ['active', 'finished'];
const matchResults = ['win', 'draw', 'loss'];

// Lengths are counted in code points, matching the server rune-based limits.
const withinLength = (value: unknown, max: number) =>
  typeof value === 'string' && Array.from(value).length <= max;

const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export function isClubProfile(value: unknown): value is ClubProfile {
  const item = value as ClubProfile;
  return (
    !!item &&
    typeof item.userId === 'string' &&
    imageIdPattern.test(item.userId) &&
    typeof item.name === 'string' &&
    footballTypes.includes(item.footballType) &&
    (
      Object.keys(clubProfileLimits) as (keyof typeof clubProfileLimits)[]
    ).every(key => withinLength(item[key], clubProfileLimits[key])) &&
    validDate(item.updatedAt)
  );
}

export function isClubArticle(value: unknown): value is ClubArticle {
  const item = value as ClubArticle;
  return (
    !!item &&
    typeof item.id === 'string' &&
    imageIdPattern.test(item.id) &&
    typeof item.title === 'string' &&
    typeof item.summary === 'string' &&
    typeof item.body === 'string' &&
    typeof item.imageId === 'string' &&
    (item.imageId === '' || imageIdPattern.test(item.imageId)) &&
    typeof item.published === 'boolean' &&
    typeof item.showOnHome === 'boolean' &&
    reviewStatuses.includes(item.reviewStatus) &&
    typeof item.authorName === 'string' &&
    validDate(item.createdAt) &&
    validDate(item.updatedAt)
  );
}

const isCount = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value);

const isNullableDate = (value: unknown) => value === null || validDate(value);

export function isClubUpcomingFixture(
  value: unknown,
): value is ClubUpcomingFixture {
  const item = value as ClubUpcomingFixture & Record<string, unknown>;
  return (
    !!item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    isCount(item.round) &&
    typeof item.opponentName === 'string' &&
    typeof item.isHome === 'boolean' &&
    isNullableDate(item.kickoffAt) &&
    // Scores are not known before kickoff, so the server sends empty values.
    item.goalsFor === null &&
    item.goalsAgainst === null &&
    item.result === ''
  );
}

export function isClubRecentFixture(
  value: unknown,
): value is ClubRecentFixture {
  const item = value as ClubRecentFixture;
  return (
    !!item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    isCount(item.round) &&
    typeof item.opponentName === 'string' &&
    typeof item.isHome === 'boolean' &&
    isNullableDate(item.kickoffAt) &&
    isCount(item.goalsFor) &&
    isCount(item.goalsAgainst) &&
    matchResults.includes(item.result)
  );
}

export function isClubCenterLeague(value: unknown): value is ClubCenterLeague {
  const item = value as ClubCenterLeague;
  return (
    !!item &&
    typeof item === 'object' &&
    typeof item.leagueId === 'string' &&
    imageIdPattern.test(item.leagueId) &&
    typeof item.leagueName === 'string' &&
    typeof item.season === 'string' &&
    leagueStatuses.includes(item.status) &&
    isCount(item.teamCount) &&
    isCount(item.position) &&
    isCount(item.points) &&
    isCount(item.played) &&
    isCount(item.wins) &&
    isCount(item.draws) &&
    isCount(item.losses) &&
    isInteger(item.goalDifference) &&
    Array.isArray(item.upcoming) &&
    item.upcoming.every(isClubUpcomingFixture) &&
    Array.isArray(item.recent) &&
    item.recent.every(isClubRecentFixture)
  );
}

export function isClubCenter(value: unknown): value is ClubCenter {
  const item = value as ClubCenter;
  return (
    !!item &&
    typeof item === 'object' &&
    isCount(item.completenessPercent) &&
    item.completenessPercent <= 100 &&
    Array.isArray(item.missingFields) &&
    item.missingFields.every(field => typeof field === 'string') &&
    isCount(item.pendingApplications) &&
    isCount(item.pendingNews) &&
    isCount(item.publishedNews) &&
    Array.isArray(item.leagues) &&
    item.leagues.every(isClubCenterLeague)
  );
}

function invalid(): never {
  throw new ApiError(copy.form.unexpected);
}

export const clubRepository: ClubRepository = {
  async profile(token) {
    const result = await request<unknown>('/v1/me/club-profile', { token });
    if (!isClubProfile(result)) invalid();
    return result;
  },
  async updateProfile(token, input: ClubProfileInput) {
    const result = await request<unknown>('/v1/me/club-profile', {
      method: 'PUT',
      token,
      body: input,
    });
    if (!isClubProfile(result)) invalid();
    return result;
  },
  async news(token) {
    const result = await request<unknown>('/v1/me/club-news', { token });
    const items = (result as { items?: unknown } | null)?.items;
    if (!Array.isArray(items) || !items.every(isClubArticle)) invalid();
    return items;
  },
  async createNews(token, input: ClubArticleInput) {
    const result = await request<unknown>('/v1/me/club-news', {
      method: 'POST',
      token,
      body: input,
    });
    const article = (result as { article?: unknown } | null)?.article;
    if (!isClubArticle(article)) invalid();
    return article;
  },
  async center(token) {
    const result = await request<unknown>('/v1/me/club-center', { token });
    if (!isClubCenter(result)) invalid();
    return result;
  },
};
