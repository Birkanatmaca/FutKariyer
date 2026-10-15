import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Page,
  Team,
  TeamApplication,
  TeamApplicationPage,
  TeamDetail,
  TeamJoinRequest,
  TeamQuota,
  TeamsRepository,
} from '../domain/models';

const validId = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
function validTeam(value: unknown): value is Team {
  const item = value as Team;
  return (
    !!item &&
    validId(item.id) &&
    ['unknown', 'amateur', 'professional', 'halisaha'].includes(
      item.footballType,
    ) &&
    [
      item.name,
      item.district,
      item.description,
      item.venueName,
      item.venueAddress,
      item.trainingGroundName,
      item.trainingGroundAddress,
      item.trainingSchedule,
    ].every(field => typeof field === 'string')
  );
}
function validPage<T>(
  value: unknown,
  page: number,
  valid: (item: unknown) => item is T,
): value is Page<T> {
  const result = value as Page<T>;
  return (
    !!result &&
    Array.isArray(result.items) &&
    result.items.every(valid) &&
    result.page === page &&
    result.pageSize === 20 &&
    Number.isSafeInteger(result.total) &&
    result.total >= 0 &&
    result.totalPages === Math.ceil(result.total / 20)
  );
}
export function validQuota(value: unknown): value is TeamQuota {
  const quota = value as TeamQuota;
  return (
    !!quota &&
    quota.included === 3 &&
    Number.isInteger(quota.purchased) &&
    quota.purchased >= 0 &&
    Number.isInteger(quota.earned) &&
    quota.earned >= 0 &&
    Number.isInteger(quota.used) &&
    quota.used >= 0 &&
    Number.isInteger(quota.remaining) &&
    Number.isInteger(quota.pro) &&
    quota.pro >= 0 &&
    quota.limit ===
      quota.included + quota.purchased + quota.earned + quota.pro &&
    quota.remaining === Math.max(0, quota.limit - quota.used)
  );
}
export function validJoinRequest(value: unknown): value is TeamJoinRequest {
  const item = value as TeamJoinRequest;
  return (
    !!item &&
    validId(item.id) &&
    ['pending', 'accepted', 'rejected'].includes(item.status) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt)) &&
    (item.playerId === undefined || validId(item.playerId)) &&
    (item.clubId === undefined || validId(item.clubId)) &&
    (item.playerName === undefined || typeof item.playerName === 'string')
  );
}
function validTeamApplication(value: unknown): value is TeamApplication {
  const item = value as TeamApplication;
  return (
    !!item &&
    validId(item.id) &&
    validId(item.teamId) &&
    typeof item.teamName === 'string' &&
    typeof item.teamDistrict === 'string' &&
    typeof item.teamAvailable === 'boolean' &&
    ['pending', 'accepted', 'rejected'].includes(item.status) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' &&
    Number.isFinite(Date.parse(item.updatedAt))
  );
}
export const teamsRepository: TeamsRepository = {
  async list(token, page, search) {
    const result = await request<unknown>(
      '/v1/teams?page=' +
        page +
        '&pageSize=20&search=' +
        encodeURIComponent(search),
      { token },
    );
    if (!validPage(result, page, validTeam))
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async detail(token, id) {
    const result = await request<unknown>(
      '/v1/teams/' + encodeURIComponent(id),
      { token },
    );
    const detail = result as TeamDetail;
    if (
      !detail ||
      !validTeam(detail.team) ||
      detail.team.id !== id ||
      !['', 'pending', 'accepted', 'rejected'].includes(detail.requestStatus) ||
      (detail.quota !== undefined && !validQuota(detail.quota))
    )
      throw new ApiError(copy.form.unexpected);
    return detail;
  },
  async request(token, id) {
    const result = await request<{ request: unknown; quota: unknown }>(
      '/v1/teams/' + encodeURIComponent(id) + '/join-requests',
      { method: 'POST', token },
    );
    if (!validQuota(result.quota)) throw new ApiError(copy.form.unexpected);
    return result.quota;
  },
  async requests(token, status, page) {
    const result = await request<unknown>(
      '/v1/teams/me/join-requests?status=' +
        encodeURIComponent(status) +
        '&page=' +
        page +
        '&pageSize=20',
      { token },
    );
    if (!validPage(result, page, validJoinRequest))
      throw new ApiError(copy.form.unexpected);
    return result;
  },
  async applications(token, page) {
    const result = (await request<unknown>(
      '/v1/me/team-join-requests?page=' + page + '&pageSize=20',
      { token },
    )) as TeamApplicationPage;
    if (
      !validPage(result, page, validTeamApplication) ||
      !validQuota(result.quota)
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return result;
  },
  async decide(token, id, decision) {
    const result = await request<{ request: unknown }>(
      '/v1/teams/me/join-requests/' + encodeURIComponent(id),
      { method: 'PUT', token, body: { decision } },
    );
    if (!validJoinRequest(result.request))
      throw new ApiError(copy.form.unexpected);
  },
};
