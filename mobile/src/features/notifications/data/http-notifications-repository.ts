import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  normalizeNotificationKind,
  type AppNotification,
  type NotificationPage,
  type NotificationsRepository,
} from '../domain/models';

const validId = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

// The kind is not checked here: unknown kinds from the server are normalized to 'other'.
function validNotification(
  value: unknown,
): value is Omit<AppNotification, 'kind'> & { kind: unknown } {
  const item = value as AppNotification;
  return (
    !!item &&
    validId(item.id) &&
    typeof item.kind === 'string' &&
    typeof item.title === 'string' &&
    typeof item.body === 'string' &&
    validId(item.resourceId) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    (item.readAt === null ||
      (typeof item.readAt === 'string' &&
        Number.isFinite(Date.parse(item.readAt)))) &&
    (item.actorRole === undefined ||
      ['player', 'club', 'coach'].includes(item.actorRole)) &&
    (item.followingBack === undefined ||
      typeof item.followingBack === 'boolean')
  );
}

function validCount(value: unknown): value is { unreadCount: number } {
  const result = value as { unreadCount: number };
  return (
    !!result &&
    Number.isSafeInteger(result.unreadCount) &&
    result.unreadCount >= 0
  );
}

export const notificationsRepository: NotificationsRepository = {
  async list(token, page) {
    const result = await request<NotificationPage>(
      '/v1/me/notifications?page=' + page + '&pageSize=20',
      { token },
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validNotification) ||
      result.page !== page ||
      result.pageSize !== 20 ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.totalPages !== Math.ceil(result.total / 20) ||
      !Number.isSafeInteger(result.unreadCount) ||
      result.unreadCount < 0
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        kind: normalizeNotificationKind(item.kind),
      })),
    };
  },
  async unreadCount(token) {
    const result = await request<unknown>('/v1/me/notifications/unread-count', {
      token,
    });
    if (!validCount(result)) throw new ApiError(copy.form.unexpected);
    return result.unreadCount;
  },
  async markRead(token, id) {
    const result = await request<unknown>(
      '/v1/me/notifications/' + encodeURIComponent(id) + '/read',
      { method: 'PUT', token },
    );
    if (!validCount(result)) throw new ApiError(copy.form.unexpected);
    return result.unreadCount;
  },
  async markAllRead(token) {
    const result = await request<unknown>('/v1/me/notifications/read-all', {
      method: 'PUT',
      token,
    });
    if (!validCount(result) || result.unreadCount !== 0) {
      throw new ApiError(copy.form.unexpected);
    }
  },
  async deleteSelected(token, ids) {
    const result = await request<unknown>('/v1/me/notifications/delete', {
      method: 'POST',
      token,
      body: { ids },
    });
    if (!validCount(result)) throw new ApiError(copy.form.unexpected);
    return result.unreadCount;
  },
  async deleteAll(token) {
    const result = await request<unknown>('/v1/me/notifications', {
      method: 'DELETE',
      token,
    });
    if (!validCount(result) || result.unreadCount !== 0) {
      throw new ApiError(copy.form.unexpected);
    }
  },
};
