import { ApiError, request } from '../../../shared/api/client';
import { isAccount } from '../../../shared/domain/account';
import { copy } from '../../../shared/lib/copy';
import type {
  AccountPage,
  AdminRepository,
  AdminSection,
  ClubOverview,
  ClubOverviewApplication,
  ClubOverviewFixture,
  ClubOverviewLeague,
  ClubOverviewNews,
  ClubOverviewProfile,
  ManagedAccount,
  ProStatus,
} from '../domain/models';
function isManaged(value: unknown): value is ManagedAccount {
  return (
    isAccount(value) &&
    typeof (value as unknown as Record<string, unknown>).footballType ===
      'string' &&
    [
      'district',
      'description',
      'venueName',
      'venueAddress',
      'trainingGroundName',
      'trainingGroundAddress',
      'trainingSchedule',
    ].every(
      key =>
        typeof (value as unknown as Record<string, unknown>)[key] === 'string',
    )
  );
}
function checked(value: unknown): ManagedAccount {
  if (!isManaged(value)) {
    throw new ApiError(copy.form.unexpected);
  }
  return value;
}
type Unknown = Record<string, unknown>;
const footballTypes = ['unknown', 'amateur', 'professional', 'halisaha'];
const profileTextKeys = [
  'district',
  'description',
  'venueName',
  'venueAddress',
  'trainingGroundName',
  'trainingGroundAddress',
  'trainingSchedule',
] as const;
function isRecord(value: unknown): value is Unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isText(value: unknown): value is string {
  return typeof value === 'string';
}
function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}
function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return (
    typeof value === 'string' && (options as readonly string[]).includes(value)
  );
}
function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function isOptionalCount(value: unknown): value is number | null {
  return value === null || isCount(value);
}
function isProfile(value: unknown): value is ClubOverviewProfile {
  return (
    isRecord(value) &&
    isText(value.userId) &&
    isText(value.name) &&
    isOneOf(value.footballType, footballTypes) &&
    profileTextKeys.every(key => isText(value[key])) &&
    isTimestamp(value.updatedAt)
  );
}
function isNews(value: unknown): value is ClubOverviewNews {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.title) &&
    isOneOf(value.reviewStatus, ['pending', 'approved', 'rejected']) &&
    typeof value.published === 'boolean' &&
    isTimestamp(value.createdAt)
  );
}
function isApplication(value: unknown): value is ClubOverviewApplication {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.playerName) &&
    isOneOf(value.status, ['pending', 'accepted', 'rejected']) &&
    isTimestamp(value.createdAt)
  );
}
function isFixture(value: unknown): value is ClubOverviewFixture {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isCount(value.round) &&
    isText(value.opponentName) &&
    typeof value.isHome === 'boolean' &&
    (value.kickoffAt === null || isTimestamp(value.kickoffAt)) &&
    isOptionalCount(value.goalsFor) &&
    isOptionalCount(value.goalsAgainst) &&
    isOneOf(value.result, ['', 'win', 'draw', 'loss'])
  );
}
function isLeague(value: unknown): value is ClubOverviewLeague {
  return (
    isRecord(value) &&
    isText(value.leagueId) &&
    isText(value.leagueName) &&
    isText(value.season) &&
    isOneOf(value.status, ['active', 'finished']) &&
    isCount(value.teamCount) &&
    isCount(value.position) &&
    isCount(value.points) &&
    isCount(value.played) &&
    isCount(value.wins) &&
    isCount(value.draws) &&
    isCount(value.losses) &&
    Number.isInteger(value.goalDifference) &&
    Array.isArray(value.upcoming) &&
    value.upcoming.every(isFixture) &&
    Array.isArray(value.recent) &&
    value.recent.every(isFixture)
  );
}
function isClubOverview(value: unknown): value is ClubOverview {
  return (
    isRecord(value) &&
    isProfile(value.profile) &&
    isText(value.email) &&
    typeof value.active === 'boolean' &&
    Array.isArray(value.news) &&
    value.news.every(isNews) &&
    Array.isArray(value.applications) &&
    value.applications.every(isApplication) &&
    Array.isArray(value.leagues) &&
    value.leagues.every(isLeague)
  );
}
function isProStatus(value: unknown): value is ProStatus {
  return (
    isRecord(value) &&
    typeof value.active === 'boolean' &&
    (value.expiresAt === null || isTimestamp(value.expiresAt)) &&
    typeof value.privateBrowsing === 'boolean' &&
    isCount(value.bonusCredits)
  );
}
function checkedPro(value: unknown): ProStatus {
  if (!isRecord(value) || !isProStatus(value.pro)) {
    throw new ApiError(copy.form.unexpected);
  }
  return value.pro;
}
function proPath(id: string) {
  return '/v1/admin/users/' + encodeURIComponent(id) + '/pro';
}
function path(section: AdminSection, id?: string) {
  return '/v1/admin/' + section + (id ? '/' + encodeURIComponent(id) : '');
}
export const adminRepository: AdminRepository = {
  async list(section, page, search) {
    const result = await request<AccountPage>(
      path(section) +
        '?page=' +
        page +
        '&pageSize=20&search=' +
        encodeURIComponent(search),
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(isManaged) ||
      !Number.isInteger(result.page) ||
      result.page < 1 ||
      !Number.isInteger(result.pageSize) ||
      result.pageSize < 1 ||
      !Number.isInteger(result.total) ||
      result.total < 0 ||
      !Number.isInteger(result.totalPages) ||
      result.totalPages < 0
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return result;
  },
  async get(section, id) {
    return checked(
      (await request<{ account: unknown }>(path(section, id))).account,
    );
  },
  async clubOverview(id) {
    const result = await request<unknown>(
      '/v1/admin/club-overviews/' + encodeURIComponent(id),
    );
    if (!isClubOverview(result)) {
      throw new ApiError(copy.form.unexpected);
    }
    return result;
  },
  async create(section, form) {
    const {
      fullName,
      email,
      username,
      footballType,
      district,
      description,
      venueName,
      venueAddress,
      trainingGroundName,
      trainingGroundAddress,
      trainingSchedule,
      password,
      role,
    } = form;
    return checked(
      (
        await request<{ account: unknown }>(path(section), {
          method: 'POST',
          body: {
            fullName,
            email,
            username,
            footballType,
            district,
            description,
            venueName,
            venueAddress,
            trainingGroundName,
            trainingGroundAddress,
            trainingSchedule,
            password,
            role,
          },
        })
      ).account,
    );
  },
  async update(section, id, form) {
    const {
      fullName,
      email,
      username,
      footballType,
      district,
      description,
      venueName,
      venueAddress,
      trainingGroundName,
      trainingGroundAddress,
      trainingSchedule,
      active,
      verified,
    } = form;
    return checked(
      (
        await request<{ account: unknown }>(path(section, id), {
          method: 'PUT',
          body: {
            fullName,
            email,
            username,
            footballType,
            district,
            description,
            venueName,
            venueAddress,
            trainingGroundName,
            trainingGroundAddress,
            trainingSchedule,
            active,
            verified,
          },
        })
      ).account,
    );
  },
  async remove(section, id) {
    await request<void>(path(section, id), { method: 'DELETE' });
  },
  async resetPassword(section, id, password) {
    await request<void>(path(section, id) + '/password', {
      method: 'PUT',
      body: { password },
    });
  },
  async proStatus(id) {
    return checkedPro(await request<unknown>(proPath(id)));
  },
  async changePro(id, action) {
    return checkedPro(
      await request<unknown>(proPath(id), {
        method: 'POST',
        body: { action },
      }),
    );
  },
};
