import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  clubProfileLimits,
  type ClubArticle,
  type ClubArticleInput,
  type ClubCenter,
  type ClubCenterLeague,
  type ClubLeagueDetail,
  type ClubLeagues,
  type ClubMatch,
  type ClubProfile,
  type ClubWeek,
  type ClubWeekMatch,
  type CoachTeam,
  type CoachTeams,
  type ClubProfileInput,
  type ClubRecentFixture,
  type ClubRepository,
  type ClubStanding,
  type ClubTffLink,
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

const tffId = /^[0-9]{1,10}$/;

export function isClubTffLink(value: unknown): value is ClubTffLink {
  const item = value as ClubTffLink;
  return (
    !!item &&
    typeof item === 'object' &&
    typeof item.season === 'string' &&
    tffId.test(item.season) &&
    typeof item.league === 'string' &&
    tffId.test(item.league) &&
    typeof item.group === 'string' &&
    (item.group === '' || tffId.test(item.group)) &&
    typeof item.team === 'string' &&
    item.team.length > 0 &&
    withinLength(item.team, 120) &&
    withinLength(item.label, 240)
  );
}

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
    (item.tff === null || isClubTffLink(item.tff)) &&
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
    typeof item.opponentId === 'string' &&
    (item.opponentId === '' || imageIdPattern.test(item.opponentId)) &&
    isCount(item.opponentAvatarVersion) &&
    typeof item.isHome === 'boolean' &&
    isNullableDate(item.kickoffAt) &&
    typeof item.dateOnly === 'boolean' &&
    typeof item.venue === 'string' &&
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
    typeof item.opponentId === 'string' &&
    (item.opponentId === '' || imageIdPattern.test(item.opponentId)) &&
    isCount(item.opponentAvatarVersion) &&
    typeof item.isHome === 'boolean' &&
    isNullableDate(item.kickoffAt) &&
    typeof item.dateOnly === 'boolean' &&
    typeof item.venue === 'string' &&
    isCount(item.goalsFor) &&
    isCount(item.goalsAgainst) &&
    matchResults.includes(item.result)
  );
}

export function isClubStanding(value: unknown): value is ClubStanding {
  const item = value as ClubStanding;
  return (
    !!item &&
    typeof item === 'object' &&
    isCount(item.position) &&
    typeof item.teamName === 'string' &&
    isCount(item.played) &&
    isCount(item.wins) &&
    isCount(item.draws) &&
    isCount(item.losses) &&
    isInteger(item.goalDifference) &&
    isInteger(item.points) &&
    typeof item.own === 'boolean'
  );
}

// TFF groups have no Fut Career id; the server names them tff:sezon:lig:grup.
const tffLeagueId = /^tff:[0-9]{1,10}:[0-9]{1,10}:[0-9]{0,10}$/;

export function isClubCenterLeague(value: unknown): value is ClubCenterLeague {
  const item = value as ClubCenterLeague;
  return (
    !!item &&
    typeof item === 'object' &&
    typeof item.leagueId === 'string' &&
    (item.source === 'tff'
      ? tffLeagueId.test(item.leagueId)
      : item.source === 'futcareer' && imageIdPattern.test(item.leagueId)) &&
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
    item.recent.every(isClubRecentFixture) &&
    Array.isArray(item.standings) &&
    item.standings.every(isClubStanding)
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
    typeof item.tffLinked === 'boolean' &&
    Array.isArray(item.leagues) &&
    item.leagues.every(isClubCenterLeague)
  );
}

const isNullableCount = (value: unknown) => value === null || isCount(value);

export function isClubWeekMatch(value: unknown): value is ClubWeekMatch {
  const item = value as ClubWeekMatch;
  return (
    !!item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.homeName === 'string' &&
    typeof item.awayName === 'string' &&
    isNullableCount(item.homeGoals) &&
    isNullableCount(item.awayGoals) &&
    isNullableDate(item.kickoffAt) &&
    typeof item.dateOnly === 'boolean' &&
    typeof item.venue === 'string' &&
    typeof item.own === 'boolean'
  );
}

const isClubWeek = (value: unknown): value is ClubWeek =>
  !!value &&
  typeof value === 'object' &&
  isCount((value as ClubWeek).number) &&
  Array.isArray((value as ClubWeek).matches) &&
  (value as ClubWeek).matches.every(isClubWeekMatch);

// A club match is either still to play (no score) or played (score and result).
const isClubMatch = (value: unknown): value is ClubMatch =>
  isClubUpcomingFixture(value) || isClubRecentFixture(value);

export function isClubLeagueDetail(value: unknown): value is ClubLeagueDetail {
  const item = value as ClubLeagueDetail;
  return (
    isClubCenterLeague(item) &&
    Array.isArray(item.matches) &&
    item.matches.every(isClubMatch) &&
    Array.isArray(item.weeks) &&
    item.weeks.every(isClubWeek) &&
    isCount(item.currentWeek)
  );
}

export function isClubLeagues(value: unknown): value is ClubLeagues {
  const item = value as ClubLeagues;
  return (
    !!item &&
    typeof item === 'object' &&
    typeof item.tffLinked === 'boolean' &&
    Array.isArray(item.leagues) &&
    item.leagues.every(isClubLeagueDetail)
  );
}

export function isCoachTeams(value: unknown): value is CoachTeams {
  const item = value as CoachTeams;
  return (
    !!item &&
    typeof item === 'object' &&
    isCount(item.invitations) &&
    Array.isArray(item.teams) &&
    item.teams.every(
      (team: CoachTeam) =>
        !!team &&
        typeof team === 'object' &&
        imageIdPattern.test(team.clubId) &&
        typeof team.clubName === 'string' &&
        isCount(team.avatarVersion) &&
        typeof team.district === 'string' &&
        typeof team.role === 'string' &&
        Array.isArray(team.permissions) &&
        team.permissions.every(p => typeof p === 'string') &&
        isCount(team.pendingApplications) &&
        isCount(team.squadCount) &&
        typeof team.tffLinked === 'boolean' &&
        (team.league === null || isClubCenterLeague(team.league)),
    )
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
  async leagues(token) {
    const result = await request<unknown>('/v1/me/club-leagues', { token });
    if (!isClubLeagues(result)) invalid();
    return result;
  },
  async coachTeams(token) {
    const result = await request<unknown>('/v1/me/coach-team', { token });
    if (!isCoachTeams(result)) invalid();
    return result;
  },
  async setTff(token, input) {
    const result = await request<unknown>('/v1/me/club-profile/tff', {
      method: 'PUT',
      token,
      body: input,
    });
    if (!isClubProfile(result)) invalid();
    return result;
  },
  async clearTff(token) {
    const result = await request<unknown>('/v1/me/club-profile/tff', {
      method: 'DELETE',
      token,
    });
    if (!isClubProfile(result)) invalid();
    return result;
  },
};
