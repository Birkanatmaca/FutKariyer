import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Membership,
  SquadMember,
  SquadRepository,
} from '../domain/models';

const idPattern = /^[a-f0-9]{32}$/;
const footballTypes = ['unknown', 'amateur', 'professional', 'halisaha'];

const validId = (value: unknown) =>
  typeof value === 'string' && idPattern.test(value);
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export function isSquadMember(value: unknown): value is SquadMember {
  const item = value as SquadMember;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.playerId) &&
    typeof item.name === 'string' &&
    typeof item.position === 'string' &&
    footballTypes.includes(item.footballType) &&
    validDate(item.joinedAt)
  );
}

export function isMembership(value: unknown): value is Membership {
  const item = value as Membership;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.clubId) &&
    typeof item.clubName === 'string' &&
    typeof item.district === 'string' &&
    validDate(item.joinedAt)
  );
}

function items<T>(result: unknown, valid: (item: unknown) => item is T): T[] {
  const list = (result as { items?: unknown } | null)?.items;
  if (!Array.isArray(list) || !list.every(valid)) {
    throw new ApiError(copy.form.unexpected);
  }
  return list;
}

export const squadRepository: SquadRepository = {
  async squad(token) {
    return items(
      await request<unknown>('/v1/me/squad', { token }),
      isSquadMember,
    );
  },
  async removeMember(token, playerId) {
    await request<void>('/v1/me/squad/' + encodeURIComponent(playerId), {
      method: 'DELETE',
      token,
    });
  },
  async memberships(token) {
    return items(
      await request<unknown>('/v1/me/memberships', { token }),
      isMembership,
    );
  },
  async leaveClub(token, clubId) {
    await request<void>('/v1/me/memberships/' + encodeURIComponent(clubId), {
      method: 'DELETE',
      token,
    });
  },
};
