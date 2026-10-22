import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  squadInviteLimits,
  squadInviteStatuses,
  type Membership,
  type PlayerCandidate,
  type SquadInvite,
  type SquadMember,
  type SquadRepository,
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

export function isSquadInvite(value: unknown): value is SquadInvite {
  const item = value as SquadInvite;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.id) &&
    validId(item.clubId) &&
    validId(item.playerId) &&
    [item.clubName, item.playerName, item.position, item.message].every(
      field => typeof field === 'string',
    ) &&
    Array.from(item.message).length <= squadInviteLimits.message &&
    squadInviteStatuses.includes(item.status) &&
    validDate(item.createdAt) &&
    (item.decidedAt === null || validDate(item.decidedAt))
  );
}

function isPlayerCandidate(value: unknown): value is PlayerCandidate {
  const item = value as PlayerCandidate;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.id) &&
    typeof item.name === 'string' &&
    typeof item.position === 'string'
  );
}

function invite(result: unknown, check: (item: SquadInvite) => boolean) {
  const item = (result as { invite?: unknown } | null)?.invite;
  if (!isSquadInvite(item) || !check(item)) {
    throw new ApiError(copy.form.unexpected);
  }
  return item;
}

function items<T>(result: unknown, valid: (item: unknown) => item is T): T[] {
  const list = (result as { items?: unknown } | null)?.items;
  if (!Array.isArray(list) || !list.every(valid)) {
    throw new ApiError(copy.form.unexpected);
  }
  return list;
}

export const squadRepository: SquadRepository = {
  async candidates(token, query) {
    return items(
      await request<unknown>(
        '/v1/me/squad/candidates?q=' + encodeURIComponent(query),
        { token },
      ),
      isPlayerCandidate,
    );
  },
  async clubInvites(token) {
    return items(
      await request<unknown>('/v1/me/squad/invites', { token }),
      isSquadInvite,
    );
  },
  async invite(token, playerId, message) {
    return invite(
      await request<unknown>('/v1/me/squad/invites', {
        method: 'POST',
        token,
        body: message ? { playerId, message } : { playerId },
      }),
      item => item.playerId === playerId && item.status === 'pending',
    );
  },
  async cancelInvite(token, id) {
    return invite(
      await request<unknown>('/v1/me/squad/invites/' + encodeURIComponent(id), {
        method: 'DELETE',
        token,
      }),
      item => item.id === id && item.status === 'cancelled',
    );
  },
  async playerInvites(token) {
    return items(
      await request<unknown>('/v1/me/squad-invites', { token }),
      isSquadInvite,
    );
  },
  async respondInvite(token, id, decision) {
    return invite(
      await request<unknown>('/v1/me/squad-invites/' + encodeURIComponent(id), {
        method: 'PUT',
        token,
        body: { decision },
      }),
      item =>
        item.id === id &&
        item.status === (decision === 'accept' ? 'accepted' : 'declined'),
    );
  },
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
