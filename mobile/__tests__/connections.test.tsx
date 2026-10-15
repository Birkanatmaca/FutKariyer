import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { connectionsRepository } from '../src/features/connections/data/http-connections-repository';
import {
  canRequestConnection,
  type Connection,
  type ConnectionInbox,
  type ConnectionRole,
} from '../src/features/connections/domain/models';
import {
  createConnectionsService,
  type ConnectionsService,
} from '../src/features/connections/application/connections-service';
import { ConnectionsScreen } from '../src/features/connections/ui/ConnectionsScreen';
import { ConnectionPanel } from '../src/features/connections/ui/ConnectionPanel';
import { confirmAction } from '../src/features/connections/ui/confirm-action';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../src/features/connections/ui/confirm-action', () => ({
  confirmAction: jest.fn(),
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowUpRight: () => null,
  BadgeCheck: () => null,
  CircleAlert: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Handshake: () => null,
  Inbox: () => null,
  Mail: () => null,
  Send: () => null,
}));

const text = copy.connections;
const hex = (n: number) => n.toString(16).padStart(32, '0');
const club = {
  id: 'club-1',
  name: 'Çankaya Gençlik',
  role: 'club' as const,
  verified: true,
  district: 'Çankaya',
};
const incoming: Connection = {
  id: hex(1),
  status: 'pending',
  direction: 'incoming',
  message: 'Deneme antrenmanına bekleriz.',
  createdAt: '2026-10-12T10:00:00Z',
  respondedAt: null,
  other: club,
  contact: null,
};
const outgoing: Connection = {
  ...incoming,
  id: hex(2),
  direction: 'outgoing',
  message: '',
  other: { ...club, id: 'coach-1', name: 'Ali Hoca', role: 'coach' },
};
const accepted: Connection = {
  ...incoming,
  id: hex(3),
  status: 'accepted',
  respondedAt: '2026-10-12T11:00:00Z',
  contact: { email: 'kulup@example.com' },
};
const inbox: ConnectionInbox = {
  incoming: [incoming],
  outgoing: [outgoing],
  accepted: [accepted],
};

beforeEach(() => jest.clearAllMocks());

describe('connections repository', () => {
  it('accepts a valid inbox, including an accepted club without email', async () => {
    const noEmail = { ...accepted, id: hex(4), contact: { email: '' } };
    const value = { ...inbox, accepted: [accepted, noEmail] };
    jest.mocked(request).mockResolvedValueOnce(structuredClone(value));
    await expect(connectionsRepository.list('session')).resolves.toEqual(value);
  });

  it('rejects malformed connections and contact leaks', async () => {
    const malformed = [
      { ...inbox, incoming: [{ ...incoming, id: 'short' }] },
      { ...inbox, incoming: [{ ...incoming, status: 'archived' }] },
      { ...inbox, incoming: [{ ...incoming, direction: 'outgoing' }] },
      { ...inbox, incoming: [{ ...incoming, createdAt: 'yesterday' }] },
      {
        ...inbox,
        incoming: [{ ...incoming, other: { ...club, role: 'admin' } }],
      },
      // Contact must stay closed before acceptance.
      { ...inbox, incoming: [{ ...incoming, contact: { email: 'a@b.co' } }] },
      // An accepted connection must carry the contact object.
      { ...inbox, accepted: [{ ...accepted, contact: null }] },
      { ...inbox, accepted: [{ ...accepted, contact: { email: 42 } }] },
      { ...inbox, outgoing: [incoming] },
      { incoming: [], outgoing: [] },
      null,
    ];
    for (const value of malformed) {
      jest.mocked(request).mockResolvedValueOnce(value);
      await expect(connectionsRepository.list('session')).rejects.toEqual(
        new ApiError(copy.form.unexpected),
      );
    }
  });

  it('validates send and relationship responses', async () => {
    const sent = { ...outgoing, other: club };
    jest.mocked(request).mockResolvedValueOnce({ connection: sent });
    await expect(
      connectionsRepository.send('session', 'club-1', 'Merhaba'),
    ).resolves.toEqual(sent);
    expect(request).toHaveBeenLastCalledWith('/v1/connections', {
      token: 'session',
      method: 'POST',
      body: { recipientId: 'club-1', message: 'Merhaba' },
    });

    jest
      .mocked(request)
      .mockResolvedValueOnce({ state: 'none', connectionId: '' });
    await expect(
      connectionsRepository.with('session', 'club-1'),
    ).resolves.toEqual({ state: 'none', connectionId: '' });
    for (const value of [
      { state: 'none', connectionId: hex(1) },
      { state: 'outgoing', connectionId: '' },
      { state: 'friends', connectionId: hex(1) },
    ]) {
      jest.mocked(request).mockResolvedValueOnce(value);
      await expect(
        connectionsRepository.with('session', 'club-1'),
      ).rejects.toBeInstanceOf(ApiError);
    }
  });

  it('rejects messages over 300 characters before calling the server', async () => {
    const repository = {
      list: jest.fn(),
      send: jest.fn(),
      respond: jest.fn(),
      with: jest.fn(),
    };
    const service = createConnectionsService(repository);
    await expect(
      service.send('session', 'club-1', 'ç'.repeat(301)),
    ).rejects.toBeInstanceOf(ApiError);
    expect(repository.send).not.toHaveBeenCalled();
    await service.send('session', 'club-1', '  ' + 'ç'.repeat(300) + '  ');
    expect(repository.send).toHaveBeenCalledWith(
      'session',
      'club-1',
      'ç'.repeat(300),
    );
  });
});

describe('send button visibility', () => {
  const cases: [ConnectionRole, boolean, ConnectionRole, boolean][] = [
    ['player', false, 'club', true],
    ['player', false, 'coach', true],
    ['player', false, 'player', false],
    ['club', true, 'player', true],
    ['coach', true, 'player', true],
    ['club', false, 'player', false],
    ['coach', false, 'player', false],
    ['club', true, 'coach', false],
    ['coach', true, 'club', false],
  ];
  it.each(cases)(
    '%s (verified: %s) viewing %s -> %s',
    (role, verified, profileRole, expected) => {
      expect(canRequestConnection({ role, verified }, profileRole)).toBe(
        expected,
      );
    },
  );
});

function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string);
}

function buttons(root: ReactTestRenderer, label: string) {
  return root.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  );
}

async function press(root: ReactTestRenderer, label: string, role = 'button') {
  const node = root.root.findAll(
    n =>
      n.props.accessibilityRole === role &&
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
  await act(async () => {
    await node.props.onPress();
  });
}

function fakeService(initial: ConnectionInbox) {
  let current = initial;
  const service = {
    list: jest.fn(async () => current),
    with: jest.fn(),
    send: jest.fn(),
    respond: jest.fn(async (_token: string, id: string, action: string) => {
      const item = current.incoming.find(c => c.id === id)!;
      const next: Connection =
        action === 'accept'
          ? {
              ...item,
              status: 'accepted',
              contact: { email: '' },
              respondedAt: '2026-10-12T12:00:00Z',
            }
          : { ...item, status: 'declined' };
      current = {
        ...current,
        incoming: current.incoming.filter(c => c.id !== id),
        accepted:
          action === 'accept' ? [...current.accepted, next] : current.accepted,
      };
      return next;
    }),
  };
  return service;
}

async function mountScreen(service: unknown) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <ConnectionsScreen
        token="session"
        service={service as ConnectionsService}
        onDiscover={() => {}}
      />,
    );
  });
  return root;
}

describe('İstekler screen', () => {
  it('accepts an incoming request and shows the new connection', async () => {
    const service = fakeService({ ...inbox, accepted: [] });
    const root = await mountScreen(service);
    expect(texts(root)).toContain(club.name);
    expect(texts(root)).toContain(text.segment(text.incoming, 1));

    await press(root, text.accept);
    expect(service.respond).toHaveBeenCalledWith('session', hex(1), 'accept');
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(texts(root)).toContain(text.acceptedNotice);
    expect(texts(root)).toContain(text.emptyIncomingTitle);

    await press(root, text.segment(text.accepted, 1), 'tab');
    // The club has no email: show the fallback and no mailto action.
    expect(texts(root)).toContain(text.noEmail);
    expect(buttons(root, text.sendEmail)).toHaveLength(0);
  });

  it('asks for confirmation before declining', async () => {
    const service = fakeService(inbox);
    const root = await mountScreen(service);

    jest.mocked(confirmAction).mockResolvedValueOnce(false);
    await press(root, text.decline);
    expect(confirmAction).toHaveBeenCalledTimes(1);
    expect(service.respond).not.toHaveBeenCalled();

    jest.mocked(confirmAction).mockResolvedValueOnce(true);
    await press(root, text.decline);
    expect(service.respond).toHaveBeenCalledWith('session', hex(1), 'decline');
    expect(texts(root)).toContain(text.declinedNotice);
  });

  it('shows the email of an accepted connection', async () => {
    const root = await mountScreen(fakeService(inbox));
    await press(root, text.segment(text.accepted, 1), 'tab');
    expect(texts(root)).toContain('kulup@example.com');
    expect(buttons(root, text.sendEmail)).toHaveLength(1);
  });

  it('shows the server error with a retry when loading fails', async () => {
    const service = {
      list: jest
        .fn()
        .mockRejectedValueOnce(new ApiError('İstekler yüklenemedi.'))
        .mockResolvedValueOnce(inbox),
    };
    const root = await mountScreen(service);
    expect(texts(root)).toContain('İstekler yüklenemedi.');
    await press(root, copy.form.retry);
    expect(texts(root)).toContain(club.name);
  });
});

describe('profile connection panel', () => {
  async function mountPanel(
    service: unknown,
    viewer: { role: ConnectionRole; verified: boolean },
    role: ConnectionRole = 'club',
  ) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ConnectionPanel
          token="session"
          service={service as ConnectionsService}
          viewer={viewer}
          profile={{ id: 'club-1', name: club.name, role }}
        />,
      );
    });
    return root;
  }

  it('renders nothing where requests are not allowed', async () => {
    const service = { with: jest.fn(), list: jest.fn() };
    const root = await mountPanel(
      service,
      { role: 'player', verified: false },
      'player',
    );
    expect(root.toJSON()).toBeNull();
    expect(service.with).not.toHaveBeenCalled();
  });

  it('sends a request with a message and shows the pending state', async () => {
    const service = {
      with: jest.fn(async () => ({ state: 'none', connectionId: '' })),
      list: jest.fn(),
      send: jest.fn(async () => ({ ...outgoing, other: club })),
    };
    const root = await mountPanel(service, { role: 'player', verified: false });
    await press(root, text.send);
    const input = root.root.find(
      n =>
        n.props.accessibilityLabel === text.messageLabel &&
        n.props.onChangeText,
    );
    await act(async () => input.props.onChangeText('Merhaba'));
    expect(texts(root)).toContain(text.messageCount(7, 300));
    await press(root, text.submit);
    expect(service.send).toHaveBeenCalledWith('session', 'club-1', 'Merhaba');
    expect(texts(root)).toContain(text.statusOutgoing);
    expect(buttons(root, text.cancel)).toHaveLength(1);
  });

  it('shows the server message when sending is rejected', async () => {
    const service = {
      with: jest.fn(async () => ({ state: 'none', connectionId: '' })),
      list: jest.fn(),
      send: jest.fn(async () => {
        throw new ApiError('Bugün sınıra ulaştın.', 429);
      }),
    };
    const root = await mountPanel(service, { role: 'player', verified: false });
    await press(root, text.send);
    await press(root, text.submit);
    expect(texts(root)).toContain('Bugün sınıra ulaştın.');
    expect(texts(root)).toContain(text.sendTitle);
  });

  it('accepts an incoming request and reveals the email', async () => {
    const service = {
      with: jest.fn(async () => ({ state: 'incoming', connectionId: hex(1) })),
      list: jest.fn(async () => inbox),
      respond: jest.fn(async () => accepted),
    };
    const root = await mountPanel(service, { role: 'player', verified: false });
    expect(texts(root)).toContain(text.statusIncoming);
    expect(texts(root)).toContain('“' + incoming.message + '”');
    await press(root, text.accept);
    expect(service.respond).toHaveBeenCalledWith('session', hex(1), 'accept');
    expect(texts(root)).toContain(text.statusConnected);
    expect(texts(root)).toContain('kulup@example.com');
  });
});
