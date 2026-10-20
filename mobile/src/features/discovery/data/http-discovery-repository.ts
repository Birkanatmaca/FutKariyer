import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { isPlayerProfile } from '../../players';
import type {
  DiscoveryKind,
  DiscoveryPage,
  DiscoveryProfile,
  DiscoveryRepository,
  ProfileInsights,
} from '../domain/models';
function isProfile(
  value: unknown,
  kind: DiscoveryKind,
): value is DiscoveryProfile {
  const profile = value as DiscoveryProfile;
  if (
    !profile ||
    typeof profile.id !== 'string' ||
    !profile.id ||
    typeof profile.fullName !== 'string' ||
    typeof profile.district !== 'string' ||
    typeof profile.verified !== 'boolean' ||
    (profile.isPro !== undefined && typeof profile.isPro !== 'boolean') ||
    (profile.avatarVersion !== undefined &&
      !(
        Number.isSafeInteger(profile.avatarVersion) &&
        profile.avatarVersion >= 0
      )) ||
    typeof profile.isFollowing !== 'boolean'
  ) {
    return false;
  }
  if (kind === 'players') {
    return (
      profile.role === 'player' &&
      !profile.verified &&
      isPlayerProfile(profile.playerProfile) &&
      profile.playerProfile.discoverable
    );
  }
  return (
    profile.role === (kind === 'clubs' ? 'club' : 'coach') &&
    profile.verified &&
    profile.playerProfile === null
  );
}
export const discoveryRepository: DiscoveryRepository = {
  async insights(token) {
    const out = await request<ProfileInsights>('/v1/me/insights', { token });
    if (
      !out ||
      ![out.profileViews, out.followers, out.following].every(
        value => Number.isSafeInteger(value) && value >= 0,
      )
    )
      throw new ApiError(copy.form.unexpected);
    return out;
  },
  async follow(token, kind, id, following) {
    await request<void>(
      '/v1/discovery/' + kind + '/' + encodeURIComponent(id) + '/follow',
      { token, method: 'PUT', body: { following } },
    );
  },
  async list(token, query) {
    const parameters = [
      ['page', String(query.page)],
      ['pageSize', '20'],
      ['search', query.search],
      ['position', query.position],
      ['dominantFoot', query.dominantFoot],
      ['availability', query.availability],
      ['footballType', query.footballType],
      ['licenseStatus', query.licenseStatus],
    ]
      .map(([key, value]) => key + '=' + encodeURIComponent(value))
      .join('&');
    const result = await request<DiscoveryPage>(
      '/v1/discovery/' + query.kind + '?' + parameters,
      { token },
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(item => isProfile(item, query.kind)) ||
      result.page !== query.page ||
      result.pageSize !== 20 ||
      result.items.length > 20 ||
      !Number.isInteger(result.total) ||
      result.total < 0 ||
      !Number.isInteger(result.totalPages) ||
      result.totalPages !== Math.ceil(result.total / 20)
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return result;
  },
  async watchlist(token) {
    const result = await request<{ items: unknown }>('/v1/me/watchlist', {
      token,
    });
    const items = result?.items;
    if (
      !Array.isArray(items) ||
      items.length > 200 ||
      !items.every(item => isProfile(item, 'players'))
    )
      throw new ApiError(copy.form.unexpected);
    return items;
  },
  async watch(token, playerId, on) {
    await request<void>('/v1/me/watchlist/' + encodeURIComponent(playerId), {
      token,
      method: on ? 'PUT' : 'DELETE',
    });
  },
  async get(token, kind, id) {
    const result = await request<{ profile: unknown }>(
      '/v1/discovery/' + kind + '/' + encodeURIComponent(id),
      { token },
    );
    if (
      !result ||
      !isProfile(result.profile, kind) ||
      result.profile.id !== id
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return result.profile;
  },
};
