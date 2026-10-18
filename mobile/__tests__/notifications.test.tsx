import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { request } from '../src/shared/api/client';
import { notificationsRepository } from '../src/features/notifications/data/http-notifications-repository';
import { NotificationsScreen } from '../src/features/notifications/ui/NotificationsScreen';
import {
  normalizeNotificationKind,
  type AppNotification,
  type NotificationPage,
} from '../src/features/notifications/domain/models';
import type { NotificationsService } from '../src/features/notifications/application/notification-service';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowUpRight: () => null,
  Bell: () => null,
  Check: () => null,
  CheckCheck: () => null,
  CreditCard: () => null,
  Gift: () => null,
  Handshake: () => null,
  Newspaper: () => null,
  Sparkles: () => null,
  Trophy: () => null,
  CircleCheck: () => null,
  Medal: () => null,
  Trash2: () => null,
  X: () => null,
  UserPlus: () => null,
}));

const text = copy.notifications;
const id = (n: number) => n.toString(16).padStart(32, '0');
const base = {
  resourceId: id(9),
  body: 'Ayrıntı',
  createdAt: '2026-10-10T10:00:00Z',
};

const items: AppNotification[] = [
  {
    ...base,
    id: id(1),
    kind: 'opportunity',
    title: 'Yeni fırsat',
    readAt: null,
  },
  {
    ...base,
    id: id(2),
    kind: 'gift',
    title: 'Kalp hediyesi geldi',
    readAt: '2026-10-10T11:00:00Z',
  },
  {
    ...base,
    id: id(3),
    kind: 'game_reward',
    title: 'Ödül kazandın',
    readAt: null,
  },
  {
    ...base,
    id: id(4),
    kind: 'other',
    title: 'Bilinmeyen tür',
    readAt: '2026-10-10T11:00:00Z',
  },
];

const page = (list: AppNotification[]): NotificationPage => ({
  items: list,
  page: 1,
  pageSize: 20,
  total: list.length,
  totalPages: 1,
  unreadCount: list.filter(item => item.readAt === null).length,
});

describe('notification kinds', () => {
  it('keeps the five known kinds and maps anything else to other', () => {
    expect(normalizeNotificationKind('team_application')).toBe(
      'team_application',
    );
    expect(normalizeNotificationKind('payment')).toBe('payment');
    expect(normalizeNotificationKind('opportunity')).toBe('opportunity');
    expect(normalizeNotificationKind('gift')).toBe('gift');
    expect(normalizeNotificationKind('game_reward')).toBe('game_reward');
    expect(normalizeNotificationKind('connection')).toBe('connection');
    expect(normalizeNotificationKind('weekly_digest')).toBe('other');
    expect(normalizeNotificationKind(undefined)).toBe('other');
  });
});

describe('notifications repository parsing', () => {
  const requestMock = request as jest.Mock;

  beforeEach(() => requestMock.mockReset());

  it('accepts unknown kinds from the server and normalizes them', async () => {
    // Raw payload as the server might send it, before the app's kind type applies.
    requestMock.mockResolvedValue(
      page([
        { ...items[0], kind: 'future_kind' },
        { ...items[1] },
      ] as unknown as AppNotification[]),
    );
    const result = await notificationsRepository.list('t', 1);
    expect(result.items.map(item => item.kind)).toEqual(['other', 'gift']);
  });

  it('still rejects malformed items', async () => {
    requestMock.mockResolvedValue(page([{ ...items[0], id: 'not-an-id' }]));
    await expect(notificationsRepository.list('t', 1)).rejects.toThrow();
  });
});

function fakeService(list: AppNotification[]) {
  const marked: string[] = [];
  const service = {
    list: async () => page(list),
    markRead: async (_token: string, value: string) => {
      marked.push(value);
      return 0;
    },
    markAllRead: async () => {},
    deleteSelected: async () => 0,
    deleteAll: async () => {},
  } as unknown as NotificationsService;
  return { service, marked };
}

async function mount(service: NotificationsService, onOpenGifts = jest.fn()) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <NotificationsScreen
        token="t"
        service={service}
        onBack={() => {}}
        onOpenGifts={onOpenGifts}
      />,
    );
  });
  return { root, onOpenGifts };
}

function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string);
}

function find(root: ReactTestRenderer, role: string, label: string) {
  return root.root.findAll(
    n =>
      n.props.accessibilityRole === role &&
      n.props.accessibilityLabel === label,
  )[0];
}

describe('NotificationsScreen', () => {
  it('shows each notification title without kind labels', async () => {
    const { service } = fakeService(items);
    const { root } = await mount(service);
    const shown = texts(root);
    expect(shown).toContain('Yeni fırsat');
    expect(shown).toContain('Bilinmeyen tür');
    expect(shown).not.toContain(text.kinds.opportunity);
  });

  it('filters to unread items with a dedicated empty text', async () => {
    const { service } = fakeService(items);
    const { root } = await mount(service);
    await act(async () => {
      find(root, 'tab', text.filterUnread).props.onPress();
    });
    const shown = texts(root);
    expect(shown).toContain('Yeni fırsat');
    expect(shown).toContain('Ödül kazandın');
    expect(shown).not.toContain('Kalp hediyesi geldi');

    const onlyRead = fakeService([items[1]]);
    const second = await mount(onlyRead.service);
    await act(async () => {
      find(second.root, 'tab', text.filterUnread).props.onPress();
    });
    expect(texts(second.root)).toContain(text.emptyUnreadTitle);
  });

  it('opens Hediyelerim when a read gift is tapped, without re-marking it', async () => {
    const { service, marked } = fakeService(items);
    const { root, onOpenGifts } = await mount(service);
    await act(async () => {
      await find(
        root,
        'button',
        'Kalp hediyesi geldi, Ayrıntı',
      ).props.onPress();
    });
    expect(onOpenGifts).toHaveBeenCalledTimes(1);
    expect(marked).toEqual([]);
  });

  it('marks an unread notification read when tapped', async () => {
    const { service, marked } = fakeService(items);
    const { root, onOpenGifts } = await mount(service);
    await act(async () => {
      await find(root, 'button', 'Yeni fırsat, Ayrıntı').props.onPress();
    });
    expect(marked).toEqual([id(1)]);
    expect(onOpenGifts).not.toHaveBeenCalled();
  });

  it('turns delete-all into delete-selected after a long press and confirms first', async () => {
    const deleted: string[][] = [];
    const { service } = fakeService(items);
    (service as unknown as { deleteSelected: unknown }).deleteSelected = async (
      _token: string,
      ids: string[],
    ) => {
      deleted.push(ids);
      return 0;
    };
    const { root } = await mount(service);
    expect(find(root, 'button', text.deleteAll)).toBeTruthy();
    await act(async () => {
      find(
        root,
        'button',
        items[1].title + ', ' + items[1].body,
      ).props.onLongPress();
    });
    await act(async () => {
      find(root, 'button', text.deleteSelected(1)).props.onPress();
    });
    expect(deleted).toEqual([]);
    expect(texts(root)).toContain(text.confirm.deleteSelected.title);
    await act(async () => {
      root.root
        .findAll(
          n =>
            n.props.accessibilityRole === 'button' &&
            n.props.children?.props?.children ===
              text.confirm.deleteSelected.action,
        )[0]
        .props.onPress();
    });
    expect(deleted).toEqual([[id(2)]]);
  });
});
