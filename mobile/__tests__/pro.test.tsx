import React from 'react';
import { Linking, Switch, Text } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import {
  proRepository,
  validProOffer,
  validProStatus,
  validVisitors,
} from '../src/features/pro/data/http-pro-repository';
import {
  relativeTime,
  roleBreakdown,
  visitorKind,
  weeklyHeadline,
} from '../src/features/pro/domain/visitors';
import type {
  ProfileVisitors,
  VisitorTotals,
} from '../src/features/pro/domain/models';
import type { ProService } from '../src/features/pro/application/pro-service';
import { VisitorsScreen } from '../src/features/pro/ui/VisitorsScreen';
import { ProScreen } from '../src/features/pro/ui/ProScreen';
import { PrivateBrowsingSetting } from '../src/features/pro/ui/PrivateBrowsingSetting';
import { TeamsScreen } from '../src/features/teams/ui/TeamsScreen';
import { validQuota } from '../src/features/teams/data/http-teams-repository';
import {
  isPayment,
  isProPlan,
} from '../src/features/admin/data/http-payments-repository';
import { createAccountsRepository } from '../src/features/admin/data/http-accounts-repository';
import type { AdminGateway } from '../src/features/admin/domain/models';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => react.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../src/shared/ui/Floodlight', () => ({ Floodlight: () => null }));
jest.mock('lucide-react-native', () => {
  const icon = () => null;
  return new Proxy(
    {},
    { get: (_, key) => (key === '__esModule' ? false : icon) },
  );
});
const mockAuth = { token: 'session', user: { role: 'player' } };
jest.mock('../src/features/auth', () => ({ useAuth: () => mockAuth }));

const mockedRequest = request as jest.MockedFunction<typeof request>;
const id = (n: number) => n.toString(16).padStart(32, '0');
const now = new Date();
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60000).toISOString();
const totals = (over: Partial<VisitorTotals> = {}): VisitorTotals => ({
  visitors: 3,
  visits: 4,
  byRole: { player: 1, club: 1, coach: 0, organizer: 0, hidden: 1 },
  ...over,
});
const identity = {
  id: id(1),
  fullName: 'Kuzey Spor',
  role: 'club' as const,
  verified: true,
  isPro: false,
  club: '',
  district: 'Çankaya',
  footballType: 'amateur' as const,
  canOpen: true,
  private: false,
};
const freePayload: ProfileVisitors = {
  isPro: false,
  windowDays: 30,
  summary: { window: totals(), week: totals({ visits: 3 }) },
  items: [
    {
      key: id(1),
      kind: 'visitor',
      lastVisitedAt: minutesAgo(5),
      visitCount: 1,
      visitor: identity,
    },
    {
      key: 'row-1',
      kind: 'obscured',
      lastVisitedAt: minutesAgo(120),
      role: 'player',
    },
    { key: 'row-2', kind: 'private', lastVisitedAt: minutesAgo(3) },
  ],
};
const proPayload: ProfileVisitors = {
  isPro: true,
  windowDays: 30,
  summary: {
    window: totals({
      byRole: { player: 2, club: 1, coach: 0, organizer: 0, hidden: 0 },
    }),
    week: totals(),
  },
  items: [
    freePayload.items[0],
    {
      key: id(2),
      kind: 'visitor',
      lastVisitedAt: minutesAgo(3),
      visitCount: 2,
      visitor: {
        ...identity,
        id: id(2),
        fullName: 'Gizli Gezen',
        role: 'player',
        verified: false,
        isPro: true,
        private: true,
        canOpen: false,
      },
    },
  ],
};

function texts(root: ReactTestRenderer) {
  return root.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('\n');
}
function service(over: Partial<ProService> = {}): ProService {
  return {
    status: jest.fn().mockResolvedValue({
      pro: {
        active: false,
        expiresAt: null,
        privateBrowsing: false,
        bonusCredits: 0,
      },
      eligible: true,
    }),
    setPrivateBrowsing: jest.fn(),
    offer: jest.fn(),
    checkout: jest.fn(),
    visitors: jest.fn(),
    ...over,
  };
}
async function render(node: React.ReactElement) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(node);
  });
  return root;
}
const pressByLabel = async (root: ReactTestRenderer, label: string) => {
  const target = root.root.find(
    (node: ReactTestInstance) =>
      node.props.accessibilityLabel === label && !!node.props.onPress,
  );
  await act(async () => target.props.onPress());
};

beforeEach(() => mockedRequest.mockReset());

describe('API boundary validators', () => {
  it('accepts free and Pro visitor payloads', () => {
    expect(validVisitors(freePayload)).toBe(true);
    expect(validVisitors(proPayload)).toBe(true);
  });

  it('rejects anonymous rows that carry an identity and free payloads with more than one identity', () => {
    const leak = (row: object) => ({
      ...freePayload,
      items: [freePayload.items[0], row],
    });
    expect(
      validVisitors(leak({ ...freePayload.items[1], visitor: identity })),
    ).toBe(false);
    expect(validVisitors(leak({ ...freePayload.items[2], id: id(3) }))).toBe(
      false,
    );
    expect(
      validVisitors(leak({ ...freePayload.items[2], fullName: 'Ad' })),
    ).toBe(false);
    expect(validVisitors(leak({ ...freePayload.items[2], role: 'club' }))).toBe(
      false,
    );
    expect(
      validVisitors({
        ...freePayload,
        items: [freePayload.items[0], { ...freePayload.items[0], key: id(1) }],
      }),
    ).toBe(false);
    expect(
      validVisitors({ ...proPayload, items: [freePayload.items[1]] }),
    ).toBe(false);
    expect(
      validVisitors({
        ...freePayload,
        items: [{ ...freePayload.items[0], key: 'other' }],
      }),
    ).toBe(false);
  });

  it('validates Pro status and offers', () => {
    const status = {
      active: true,
      expiresAt: '2026-11-14T10:00:00Z',
      privateBrowsing: true,
      bonusCredits: 3,
    };
    expect(validProStatus(status)).toBe(true);
    expect(validProStatus({ ...status, active: false })).toBe(false);
    expect(validProStatus({ ...status, expiresAt: 'soon' })).toBe(false);
    expect(validProStatus({ ...status, bonusCredits: -1 })).toBe(false);
    const offer = {
      plan: {
        id: id(9),
        days: 30,
        bonusCredits: 3,
        amountMinor: 4900,
        currency: 'TRY',
        active: true,
      },
      checkoutEnabled: false,
    };
    expect(validProOffer(offer)).toBe(true);
    expect(
      validProOffer({ ...offer, plan: { ...offer.plan, amountMinor: 0 } }),
    ).toBe(false);
    expect(validProOffer({ ...offer, checkoutEnabled: 'yes' })).toBe(false);
  });

  it('counts Pro rights in the team quota total', () => {
    const quota = {
      included: 3,
      purchased: 2,
      earned: 1,
      pro: 3,
      used: 4,
      remaining: 5,
      limit: 9,
    };
    expect(validQuota(quota)).toBe(true);
    expect(validQuota({ ...quota, limit: 6, remaining: 2 })).toBe(false);
    expect(validQuota({ ...quota, pro: undefined })).toBe(false);
  });

  it('sends the private browsing setting and rejects malformed responses', async () => {
    mockedRequest.mockResolvedValueOnce({
      pro: {
        active: true,
        expiresAt: '2026-11-14T10:00:00Z',
        privateBrowsing: true,
        bonusCredits: 3,
      },
    });
    await proRepository.setPrivateBrowsing('session', true);
    expect(mockedRequest).toHaveBeenCalledWith('/v1/me/pro/settings', {
      method: 'PUT',
      token: 'session',
      body: { privateBrowsing: true },
    });
    mockedRequest.mockResolvedValueOnce({ ...freePayload, isPro: 'no' });
    await expect(proRepository.visitors('session')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('visitor summary rules', () => {
  it('leads with clubs and falls back to the total for hidden visitors', () => {
    expect(weeklyHeadline(totals())).toEqual({
      kind: 'role',
      role: 'club',
      count: 1,
    });
    expect(
      weeklyHeadline(
        totals({
          visitors: 1,
          byRole: { player: 0, club: 0, coach: 0, organizer: 0, hidden: 1 },
        }),
      ),
    ).toEqual({ kind: 'total', count: 1 });
    expect(weeklyHeadline(totals({ visitors: 0 }))).toEqual({ kind: 'none' });
    expect(roleBreakdown(totals().byRole).map(item => item.role)).toEqual([
      'club',
      'player',
      'hidden',
    ]);
  });

  it('formats relative times and profile kinds', () => {
    const base = new Date('2026-10-15T12:00:00Z');
    expect(relativeTime('2026-10-15T11:59:40Z', base)).toEqual({ unit: 'now' });
    expect(relativeTime('2026-10-15T11:15:00Z', base)).toEqual({
      unit: 'minutes',
      value: 45,
    });
    expect(relativeTime('2026-10-15T07:00:00Z', base)).toEqual({
      unit: 'hours',
      value: 5,
    });
    expect(relativeTime('2026-10-12T12:00:00Z', base)).toEqual({
      unit: 'days',
      value: 3,
    });
    expect(visitorKind('coach')).toBe('coaches');
    expect(visitorKind('organizer')).toBeNull();
  });
});

describe('VisitorsScreen', () => {
  it('shows counts, one revealed visitor, anonymous rows and the upgrade CTA for free users', async () => {
    const onUpgrade = jest.fn();
    const onOpenProfile = jest.fn();
    const root = await render(
      <VisitorsScreen
        token="session"
        service={service({
          visitors: jest.fn().mockResolvedValue(freePayload),
        })}
        onBack={jest.fn()}
        onUpgrade={onUpgrade}
        onOpenProfile={onOpenProfile}
      />,
    );
    const shown = texts(root);
    expect(shown).toContain(copy.visitors.headline(1, 'kulüp'));
    expect(shown).toContain('Kuzey Spor');
    expect(shown).toContain(copy.visitors.privateRow);
    expect(shown).toContain(copy.visitors.obscured('sporcu'));
    expect(shown).toContain(copy.visitors.upgradeCta);
    await pressByLabel(root, copy.visitors.upgradeCta);
    expect(onUpgrade).toHaveBeenCalled();
    await pressByLabel(root, copy.visitors.open('Kuzey Spor'));
    expect(onOpenProfile).toHaveBeenCalledWith('clubs', id(1));
  });

  it('shows every identity with badges for Pro users and no upgrade CTA', async () => {
    const root = await render(
      <VisitorsScreen
        token="session"
        service={service({ visitors: jest.fn().mockResolvedValue(proPayload) })}
        onBack={jest.fn()}
        onUpgrade={jest.fn()}
        onOpenProfile={jest.fn()}
      />,
    );
    const shown = texts(root);
    expect(shown).toContain('Gizli Gezen');
    expect(shown).toContain(copy.pro.badge);
    expect(shown).toContain(copy.visitors.browsedPrivately);
    expect(shown).toContain(copy.visitors.visits(2));
    expect(shown).not.toContain(copy.visitors.upgradeCta);
    // A visitor that discovery rules do not open is not pressable.
    expect(
      root.root.findAll(
        node =>
          node.props.accessibilityLabel === copy.visitors.open('Gizli Gezen'),
      ),
    ).toHaveLength(0);
  });
});

describe('ProScreen', () => {
  const offer = {
    plan: {
      id: id(9),
      days: 30,
      bonusCredits: 3,
      amountMinor: 4900,
      currency: 'TRY' as const,
      active: true,
    },
    checkoutEnabled: true,
  };
  it('shows benefits, price and status and starts the shared checkout flow', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const checkout = jest.fn().mockResolvedValue({
      orderId: id(5),
      status: 'pending',
      provider: 'p',
      providerPaymentId: 'x',
      checkoutUrl: 'https://pay.example/x',
    });
    const root = await render(
      <ProScreen
        token="session"
        service={service({
          offer: jest.fn().mockResolvedValue(offer),
          checkout,
        })}
        onBack={jest.fn()}
      />,
    );
    const shown = texts(root);
    for (const label of [
      copy.pro.benefits.visitors,
      copy.pro.benefits.badge,
      copy.pro.benefits.rights(3),
      copy.pro.benefits.privateBrowsing,
      copy.pro.inactive,
    ])
      expect(shown).toContain(label);
    expect(shown).toMatch(/49/);
    await pressByLabel(root, copy.pro.buy);
    expect(checkout).toHaveBeenCalledWith('session', id(9));
    expect(openURL).toHaveBeenCalledWith('https://pay.example/x');
    expect(texts(root)).toContain(copy.pro.checkoutStarted);
    openURL.mockRestore();
  });

  it('keeps purchase disabled when checkout is not configured', async () => {
    const root = await render(
      <ProScreen
        token="session"
        service={service({
          offer: jest
            .fn()
            .mockResolvedValue({ ...offer, checkoutEnabled: false }),
        })}
        onBack={jest.fn()}
      />,
    );
    expect(texts(root)).toContain(copy.pro.unavailable);
    const button = root.root.find(
      node =>
        node.props.accessibilityLabel === copy.pro.purchaseSoon &&
        node.props.accessibilityState,
    );
    expect(button.props.accessibilityState.disabled).toBe(true);
  });
});

describe('PrivateBrowsingSetting', () => {
  it('is disabled with an upgrade link for non-Pro accounts', async () => {
    const onUpgrade = jest.fn();
    const root = await render(
      <PrivateBrowsingSetting
        token="session"
        service={service()}
        onUpgrade={onUpgrade}
      />,
    );
    expect(root.root.findByType(Switch).props.disabled).toBe(true);
    expect(texts(root)).toContain(copy.pro.privateProOnly);
  });

  it('toggles for Pro accounts through the server', async () => {
    const active = {
      active: true,
      expiresAt: '2026-11-14T10:00:00Z',
      privateBrowsing: false,
      bonusCredits: 3,
    };
    const setPrivateBrowsing = jest
      .fn()
      .mockResolvedValue({ ...active, privateBrowsing: true });
    const root = await render(
      <PrivateBrowsingSetting
        token="session"
        service={service({
          status: jest.fn().mockResolvedValue({ pro: active, eligible: true }),
          setPrivateBrowsing,
        })}
        onUpgrade={jest.fn()}
      />,
    );
    const toggle = root.root.findByType(Switch);
    expect(toggle.props.disabled).toBe(false);
    await act(async () => toggle.props.onValueChange(true));
    expect(setPrivateBrowsing).toHaveBeenCalledWith('session', true);
    expect(root.root.findByType(Switch).props.value).toBe(true);
    expect(texts(root)).toContain(copy.pro.privateSaved(true));
  });
});

describe('Teams rights badge', () => {
  const page = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
  const quota = {
    included: 3,
    purchased: 0,
    earned: 0,
    pro: 3,
    used: 1,
    remaining: 5,
    limit: 6,
  };
  function respond() {
    mockedRequest.mockImplementation(async (path: string) =>
      path.startsWith('/v1/me/team-join-requests')
        ? ({ ...page, quota } as never)
        : (page as never),
    );
  }
  it('shows the total rights for players and opens the rights screen', async () => {
    respond();
    mockAuth.user.role = 'player';
    const onOpenRights = jest.fn();
    const root = await render(<TeamsScreen onOpenRights={onOpenRights} />);
    expect(texts(root)).toContain('5');
    await pressByLabel(root, copy.teams.rightsBadge(5));
    expect(onOpenRights).toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('is hidden for other account types', async () => {
    respond();
    mockAuth.user.role = 'club';
    const root = await render(<TeamsScreen onOpenRights={jest.fn()} />);
    expect(
      root.root.findAll(
        node => node.props.accessibilityLabel === copy.teams.rightsBadge(5),
      ),
    ).toHaveLength(0);
    expect(
      mockedRequest.mock.calls.some(([path]) =>
        String(path).startsWith('/v1/me/team-join-requests'),
      ),
    ).toBe(false);
    mockAuth.user.role = 'player';
    act(() => root.unmount());
  });
});

describe('admin Pro management', () => {
  const base = {
    id: id(7),
    playerName: 'Oyuncu',
    playerEmail: 'o@example.com',
    amountMinor: 4900,
    currency: 'TRY',
    provider: 'p',
    status: 'paid',
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
  };
  it('accepts Pro orders and plans in payment payloads', () => {
    expect(isPayment({ ...base, product: 'pro', packageCredits: 0 })).toBe(
      true,
    );
    expect(
      isPayment({ ...base, product: 'team_rights', packageCredits: 2 }),
    ).toBe(true);
    expect(isPayment({ ...base, product: 'pro', packageCredits: 2 })).toBe(
      false,
    );
    expect(
      isPayment({ ...base, product: 'team_rights', packageCredits: 0 }),
    ).toBe(false);
    expect(
      isProPlan({
        id: id(9),
        days: 30,
        bonusCredits: 3,
        amountMinor: 4900,
        currency: 'TRY',
        active: false,
      }),
    ).toBe(true);
    expect(
      isProPlan({
        id: 'x',
        days: 30,
        bonusCredits: 3,
        amountMinor: 4900,
        currency: 'TRY',
        active: true,
      }),
    ).toBe(false);
  });

  it('grants and revokes Pro through the admin endpoint', async () => {
    const gateway: AdminGateway = {
      request: jest.fn().mockResolvedValue({
        pro: {
          active: true,
          expiresAt: '2026-11-14T10:00:00Z',
          privateBrowsing: false,
          bonusCredits: 3,
        },
      }),
    } as unknown as AdminGateway;
    const accounts = createAccountsRepository(gateway);
    await expect(accounts.changePro(id(3), 'grant')).resolves.toMatchObject({
      active: true,
    });
    expect(gateway.request).toHaveBeenCalledWith(
      '/v1/admin/users/' + id(3) + '/pro',
      {
        method: 'POST',
        body: { action: 'grant' },
      },
    );
    jest
      .mocked(gateway.request)
      .mockResolvedValueOnce({ pro: { active: 'yes' } });
    await expect(accounts.changePro(id(3), 'revoke')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
