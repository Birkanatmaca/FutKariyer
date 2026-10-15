import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { BlockedUser, ModerationRepository } from '../domain/models';

const id = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

export function validBlockedUser(value: unknown): value is BlockedUser {
  const item = value as BlockedUser;
  return (
    !!item &&
    id(item.id) &&
    typeof item.fullName === 'string' &&
    ['player', 'club', 'coach', 'organizer'].includes(item.role) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt))
  );
}

export const moderationRepository: ModerationRepository = {
  async report(token, input) {
    await request<void>('/v1/reports', { method: 'POST', token, body: input });
  },
  async block(token, userId) {
    await request<void>('/v1/me/blocks/' + userId, { method: 'PUT', token });
  },
  async unblock(token, userId) {
    await request<void>('/v1/me/blocks/' + userId, {
      method: 'DELETE',
      token,
    });
  },
  async blocks(token) {
    const result = await request<{ items: unknown }>('/v1/me/blocks', {
      token,
    });
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validBlockedUser)
    )
      throw new ApiError(copy.form.unexpected);
    return result.items as BlockedUser[];
  },
};
