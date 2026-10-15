import type {
  AccountProStatus,
  AccountsRepository,
  AccountSection,
  AdminGateway,
  ClubOverview,
  ClubOverviewFixture,
  ManagedAccount,
} from '../domain/models';
import {
  isCount,
  isListOf,
  isOneOf,
  isPage,
  isRecord,
  isText,
  isTimestamp,
  unexpected,
} from './validators';

const roles = ['player', 'coach', 'club', 'organizer', 'admin'] as const;
const footballTypes = [
  'unknown',
  'amateur',
  'professional',
  'halisaha',
] as const;
const profileKeys = [
  'district',
  'description',
  'venueName',
  'venueAddress',
  'trainingGroundName',
  'trainingGroundAddress',
  'trainingSchedule',
] as const;

export function isManagedAccount(value: unknown): value is ManagedAccount {
  return (
    isRecord(value) &&
    isText(value.id) &&
    value.id.length > 0 &&
    isText(value.fullName) &&
    isText(value.email) &&
    isText(value.username) &&
    isText(value.city) &&
    typeof value.active === 'boolean' &&
    typeof value.verified === 'boolean' &&
    isTimestamp(value.createdAt) &&
    isOneOf(value.role, roles) &&
    (value.footballType === '' || isOneOf(value.footballType, footballTypes)) &&
    profileKeys.every(key => isText(value[key]))
  );
}
export function isAccountProStatus(value: unknown): value is AccountProStatus {
  return (
    isRecord(value) &&
    typeof value.active === 'boolean' &&
    (value.expiresAt === null || isTimestamp(value.expiresAt)) &&
    typeof value.privateBrowsing === 'boolean' &&
    isCount(value.bonusCredits)
  );
}
function proStatus(value: unknown): AccountProStatus {
  if (!isRecord(value) || !isAccountProStatus(value.pro)) unexpected();
  return value.pro as AccountProStatus;
}
function account(value: unknown): ManagedAccount {
  if (!isRecord(value) || !isManagedAccount(value.account)) unexpected();
  return value.account as ManagedAccount;
}
function isFixture(value: unknown): value is ClubOverviewFixture {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isCount(value.round) &&
    isText(value.opponentName) &&
    typeof value.isHome === 'boolean' &&
    (value.kickoffAt === null || isTimestamp(value.kickoffAt)) &&
    (value.goalsFor === null || isCount(value.goalsFor)) &&
    (value.goalsAgainst === null || isCount(value.goalsAgainst)) &&
    isOneOf(value.result, ['', 'win', 'draw', 'loss'])
  );
}
export function isClubOverview(value: unknown): value is ClubOverview {
  if (!isRecord(value) || !isRecord(value.profile)) return false;
  const profile = value.profile;
  return (
    isText(profile.userId) &&
    isText(profile.name) &&
    isOneOf(profile.footballType, footballTypes) &&
    profileKeys.every(key => isText(profile[key])) &&
    isTimestamp(profile.updatedAt) &&
    isText(value.email) &&
    typeof value.active === 'boolean' &&
    isListOf(
      value.news,
      (item): item is ClubOverview['news'][number] =>
        isRecord(item) &&
        isText(item.id) &&
        isText(item.title) &&
        isOneOf(item.reviewStatus, ['pending', 'approved', 'rejected']) &&
        typeof item.published === 'boolean' &&
        isTimestamp(item.createdAt),
    ) &&
    isListOf(
      value.applications,
      (item): item is ClubOverview['applications'][number] =>
        isRecord(item) &&
        isText(item.id) &&
        isText(item.playerName) &&
        isOneOf(item.status, ['pending', 'accepted', 'rejected']) &&
        isTimestamp(item.createdAt),
    ) &&
    isListOf(
      value.leagues,
      (item): item is ClubOverview['leagues'][number] =>
        isRecord(item) &&
        isText(item.leagueId) &&
        isText(item.leagueName) &&
        isText(item.season) &&
        isOneOf(item.status, ['active', 'finished']) &&
        [
          item.teamCount,
          item.position,
          item.points,
          item.played,
          item.wins,
          item.draws,
          item.losses,
        ].every(isCount) &&
        Number.isSafeInteger(item.goalDifference) &&
        isListOf(item.upcoming, isFixture) &&
        isListOf(item.recent, isFixture),
    )
  );
}
function path(section: AccountSection, id?: string) {
  return '/v1/admin/' + section + (id ? '/' + encodeURIComponent(id) : '');
}

export function createAccountsRepository(
  gateway: AdminGateway,
): AccountsRepository {
  return {
    async proStatus(id) {
      return proStatus(
        await gateway.request<unknown>(
          '/v1/admin/users/' + encodeURIComponent(id) + '/pro',
        ),
      );
    },
    async changePro(id, action) {
      return proStatus(
        await gateway.request<unknown>(
          '/v1/admin/users/' + encodeURIComponent(id) + '/pro',
          { method: 'POST', body: { action } },
        ),
      );
    },
    async list(section, page, search) {
      const result = await gateway.request<unknown>(
        path(section) +
          '?page=' +
          page +
          '&pageSize=20&search=' +
          encodeURIComponent(search),
      );
      if (!isPage(result, isManagedAccount)) unexpected();
      return result;
    },
    async get(section, id) {
      return account(await gateway.request<unknown>(path(section, id)));
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
      return account(
        await gateway.request<unknown>(path(section), {
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
        }),
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
      return account(
        await gateway.request<unknown>(path(section, id), {
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
        }),
      );
    },
    async remove(section, id) {
      await gateway.request<void>(path(section, id), { method: 'DELETE' });
    },
    async resetPassword(section, id, password) {
      await gateway.request<void>(path(section, id) + '/password', {
        method: 'PUT',
        body: { password },
      });
    },
    async clubOverview(id) {
      const result = await gateway.request<unknown>(
        '/v1/admin/club-overviews/' + encodeURIComponent(id),
      );
      if (!isClubOverview(result)) unexpected();
      return result;
    },
  };
}
