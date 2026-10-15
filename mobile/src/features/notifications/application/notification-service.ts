import type { NotificationsRepository } from '../domain/models';

export function createNotificationsService(repository: NotificationsRepository) {
  return {
    list(token: string, page = 1) {
      return repository.list(token, page);
    },
    unreadCount(token: string) {
      return repository.unreadCount(token);
    },
    markRead(token: string, id: string) {
      return repository.markRead(token, id);
    },
    markAllRead(token: string) {
      return repository.markAllRead(token);
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
