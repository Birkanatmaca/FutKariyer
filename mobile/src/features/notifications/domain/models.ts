export const notificationKinds = [
  'team_application',
  'payment',
  'opportunity',
  'gift',
  'game_reward',
  'news_review',
  'connection',
  'tournament',
  'follow',
  // Club technical staff: invitations, joins, removals (19 Oct 2026).
  'staff',
] as const;

export type NotificationKind = (typeof notificationKinds)[number];

// Kinds the server may add later are shown with a generic style instead of failing the list.
export type DisplayNotificationKind = NotificationKind | 'other';

export function normalizeNotificationKind(
  value: unknown,
): DisplayNotificationKind {
  return (notificationKinds as readonly unknown[]).includes(value)
    ? (value as NotificationKind)
    : 'other';
}

export type AppNotification = {
  id: string;
  kind: DisplayNotificationKind;
  title: string;
  body: string;
  resourceId: string;
  createdAt: string;
  readAt: string | null;
  // Follow notifications: resourceId is the follower; their role and whether
  // the recipient follows them back.
  actorRole?: 'player' | 'club' | 'coach';
  followingBack?: boolean;
};

export type NotificationPage = {
  items: AppNotification[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
};

export interface NotificationsRepository {
  list(token: string, page: number): Promise<NotificationPage>;
  unreadCount(token: string): Promise<number>;
  markRead(token: string, id: string): Promise<number>;
  markAllRead(token: string): Promise<void>;
  // Both return the unread count left afterwards.
  deleteSelected(token: string, ids: string[]): Promise<number>;
  deleteAll(token: string): Promise<void>;
}
