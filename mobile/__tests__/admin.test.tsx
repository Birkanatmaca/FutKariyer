import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  AuthProvider,
  useAuth,
} from '../src/features/auth/application/AuthProvider';
import { authRepository } from '../src/features/auth/data/auth-repository';
import type {
  AuthRepository,
  SessionStorage,
} from '../src/features/auth/domain/models';
import { createAdminGateway } from '../src/features/admin/data/admin-gateway';
import { createAdminRepositories } from '../src/features/admin/data/repositories';
import {
  createAdminServices,
  type AdminServices,
} from '../src/features/admin/application/admin-services';
import {
  parsePrice,
  reportActions,
  toCatalogUpdate,
  toMatchForm,
  validateGiftDraft,
  validateStoreProductIds,
} from '../src/features/admin/application/validation';
import type {
  AdminGateway,
  ContentReport,
} from '../src/features/admin/domain/models';
import { AccountsScreen } from '../src/features/admin/ui/accounts/AccountsScreen';
import { AccountEditorScreen } from '../src/features/admin/ui/accounts/AccountEditorScreen';
import { ProPlanCard } from '../src/features/admin/ui/payments/ProPlanCard';
import { ReportsScreen } from '../src/features/admin/ui/reports/ReportsScreen';
import { confirm } from '../src/features/admin/ui/parts/confirm';
import { ApiError } from '../src/shared/api/client';
import { copy } from '../src/shared/lib/copy';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../src/shared/ui/Floodlight', () => ({ Floodlight: () => null }));
jest.mock('../src/features/admin/ui/parts/confirm', () => ({
  confirm: jest.fn(),
}));
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowUpRight: () => null,
  CircleAlert: () => null,
  CircleCheck: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Flag: () => null,
  ImageOff: () => null,
  KeyRound: () => null,
  Plus: () => null,
  Search: () => null,
  Trash: () => null,
  Users: () => null,
}));

const token = 't'.repeat(43);
const expiresAt = '2030-01-01T00:00:00Z';
const adminUser = {
  id: 'a'.repeat(32),
  fullName: 'Ece Yönetici',
  email: 'admin@example.com',
  username: '',
  role: 'admin' as const,
};
const playerUser = {
  id: 'b'.repeat(32),
  fullName: 'Deniz Yılmaz',
  email: 'deniz@example.com',
  username: '',
  active: true,
  verified: false,
  role: 'player' as const,
  city: 'Ankara',
  createdAt: '2026-10-01T10:00:00Z',
};

function makeRepository(overrides: Partial<AuthRepository> = {}) {
  return {
    login: jest.fn(),
    register: jest.fn(),
    apply: jest.fn(),
    me: jest.fn().mockResolvedValue(playerUser),
    logout: jest.fn().mockResolvedValue(undefined),
    adminLogin: jest.fn(),
    adminVerify: jest.fn(),
    adminMe: jest.fn().mockResolvedValue(adminUser),
    adminLogout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<AuthRepository>;
}
function makeStorage(
  saved: Awaited<ReturnType<SessionStorage['get']>> = null,
): jest.Mocked<SessionStorage> {
  return {
    get: jest.fn().mockResolvedValue(saved),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
}
type Auth = ReturnType<typeof useAuth>;
async function renderAuth(repository: AuthRepository, storage: SessionStorage) {
  const ref: { current: Auth | null } = { current: null };
  function Probe() {
    ref.current = useAuth();
    return null;
  }
  await act(async () => {
    create(
      <AuthProvider repository={repository} storage={storage}>
        <Probe />
      </AuthProvider>,
    );
  });
  return ref as { current: Auth };
}
function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children as string);
}
function pressable(root: ReactTestRenderer, label: string) {
  return root.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
}
function input(root: ReactTestRenderer, label: string) {
  return root.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onChangeText === 'function',
  );
}

describe('admin sign-in and session', () => {
  test('wrong_portal on the mobile login opens an admin session with the same credentials', async () => {
    const repository = makeRepository({
      login: jest
        .fn()
        .mockRejectedValue(
          new ApiError('Yönetici hesabı', 403, {}, 'wrong_portal'),
        ),
      adminLogin: jest.fn().mockResolvedValue({
        kind: 'session',
        session: { token, expiresAt, user: adminUser },
      }),
    });
    const storage = makeStorage();
    const auth = await renderAuth(repository, storage);
    const credentials = { identifier: 'admin@example.com', password: 'secret' };
    await act(async () => auth.current.signIn(credentials));
    expect(repository.adminLogin).toHaveBeenCalledWith(credentials);
    expect(storage.save).toHaveBeenCalledWith({
      token,
      expiresAt,
      kind: 'admin',
    });
    expect(auth.current.admin).toEqual(adminUser);
    expect(auth.current.adminToken).toBe(token);
    // The user API never sees the admin token.
    expect(auth.current.token).toBeNull();
    expect(auth.current.user).toBeNull();
  });

  test('an admin with two-factor sign-in enters the code, then saves the recovery codes', async () => {
    const challenge = {
      challenge: 'c'.repeat(43),
      setup: true,
      secret: 'ABCD',
      otpauthUri: 'otpauth://totp/Fut%20Career:admin?secret=ABCD',
    };
    const repository = makeRepository({
      login: jest
        .fn()
        .mockRejectedValue(
          new ApiError('Yönetici hesabı', 403, {}, 'wrong_portal'),
        ),
      adminLogin: jest.fn().mockResolvedValue({ kind: 'twoFactor', challenge }),
      adminVerify: jest
        .fn()
        .mockRejectedValueOnce(new ApiError('Kod doğru değil.', 422))
        .mockResolvedValueOnce({
          session: { token, expiresAt, user: adminUser },
          recoveryCodes: ['aaaa-bbbb', 'cccc-dddd'],
        }),
    });
    const storage = makeStorage();
    const auth = await renderAuth(repository, storage);
    await act(async () =>
      auth.current.signIn({ identifier: 'admin', password: 'secret' }),
    );
    expect(auth.current.adminChallenge).toEqual(challenge);
    expect(auth.current.admin).toBeNull();
    await act(async () => {
      await expect(auth.current.verifyAdmin('000000')).rejects.toThrow(
        'Kod doğru değil.',
      );
    });
    // A wrong code keeps the step open.
    expect(auth.current.adminChallenge).toEqual(challenge);
    await act(async () => auth.current.verifyAdmin('123456'));
    expect(repository.adminVerify).toHaveBeenLastCalledWith(
      challenge.challenge,
      '123456',
    );
    expect(auth.current.adminRecoveryCodes).toEqual(['aaaa-bbbb', 'cccc-dddd']);
    expect(auth.current.admin).toBeNull();
    expect(storage.save).not.toHaveBeenCalled();
    await act(async () => auth.current.acceptAdmin());
    expect(auth.current.admin).toEqual(adminUser);
    expect(auth.current.adminRecoveryCodes).toEqual([]);
    expect(storage.save).toHaveBeenCalledWith({
      token,
      expiresAt,
      kind: 'admin',
    });
  });

  test('an expired admin step starts over from the password', async () => {
    const repository = makeRepository({
      login: jest
        .fn()
        .mockRejectedValue(
          new ApiError('Yönetici hesabı', 403, {}, 'wrong_portal'),
        ),
      adminLogin: jest.fn().mockResolvedValue({
        kind: 'twoFactor',
        challenge: { challenge: 'c'.repeat(43), setup: false },
      }),
      adminVerify: jest
        .fn()
        .mockRejectedValue(new ApiError('Süresi doldu', 401)),
    });
    const auth = await renderAuth(repository, makeStorage());
    await act(async () =>
      auth.current.signIn({ identifier: 'admin', password: 'secret' }),
    );
    await act(async () => {
      await expect(auth.current.verifyAdmin('123456')).rejects.toThrow();
    });
    expect(auth.current.adminChallenge).toBeNull();
  });

  test('other 403 answers do not fall back to the admin login', async () => {
    const repository = makeRepository({
      login: jest
        .fn()
        .mockRejectedValue(
          new ApiError('Bekliyor', 403, {}, 'pending_approval'),
        ),
    });
    const auth = await renderAuth(repository, makeStorage());
    await expect(
      act(async () =>
        auth.current.signIn({ identifier: 'kulup', password: 'secret' }),
      ),
    ).rejects.toMatchObject({ code: 'pending_approval' });
    expect(repository.adminLogin).not.toHaveBeenCalled();
  });

  test('a rejected admin token login reads as a normal login error', async () => {
    const repository = makeRepository({
      login: jest
        .fn()
        .mockRejectedValue(new ApiError('x', 403, {}, 'wrong_portal')),
      adminLogin: jest.fn().mockRejectedValue(new ApiError('x', 401)),
    });
    const auth = await renderAuth(repository, makeStorage());
    await expect(
      act(async () =>
        auth.current.signIn({ identifier: 'admin', password: 'wrong' }),
      ),
    ).rejects.toMatchObject({ message: copy.form.loginError, status: 401 });
  });

  test('a saved admin session is restored through the admin me endpoint', async () => {
    const repository = makeRepository();
    const auth = await renderAuth(
      repository,
      makeStorage({ token, expiresAt, kind: 'admin' }),
    );
    expect(repository.adminMe).toHaveBeenCalledWith(token);
    expect(repository.me).not.toHaveBeenCalled();
    expect(auth.current.admin).toEqual(adminUser);
    expect(auth.current.token).toBeNull();
  });

  test('sessions saved without a kind are restored as user sessions', async () => {
    const repository = makeRepository();
    const auth = await renderAuth(
      repository,
      makeStorage({ token, expiresAt }),
    );
    expect(repository.me).toHaveBeenCalledWith(token);
    expect(repository.adminMe).not.toHaveBeenCalled();
    expect(auth.current.user).toEqual(playerUser);
    expect(auth.current.admin).toBeNull();
    expect(auth.current.adminToken).toBeNull();
  });

  test('an expired admin session found at start returns to sign-in with a notice', async () => {
    const repository = makeRepository({
      adminMe: jest.fn().mockRejectedValue(new ApiError('x', 401)),
    });
    const storage = makeStorage({ token, expiresAt, kind: 'admin' });
    const auth = await renderAuth(repository, storage);
    expect(storage.clear).toHaveBeenCalled();
    expect(auth.current.admin).toBeNull();
    expect(auth.current.sessionNotice).toBe(copy.admin.session.expired);
  });

  test('expiring the admin session clears storage and shows the notice', async () => {
    const storage = makeStorage({ token, expiresAt, kind: 'admin' });
    const auth = await renderAuth(makeRepository(), storage);
    expect(auth.current.admin).not.toBeNull();
    await act(async () => auth.current.expireAdminSession());
    expect(auth.current.admin).toBeNull();
    expect(auth.current.adminToken).toBeNull();
    expect(auth.current.sessionNotice).toBe(copy.admin.session.expired);
    expect(storage.clear).toHaveBeenCalled();
  });

  test('admin sign out uses the admin logout endpoint', async () => {
    const repository = makeRepository();
    const auth = await renderAuth(
      repository,
      makeStorage({ token, expiresAt, kind: 'admin' }),
    );
    await act(async () => auth.current.signOut());
    expect(repository.adminLogout).toHaveBeenCalledWith(token);
    expect(repository.logout).not.toHaveBeenCalled();
  });
});

describe('admin HTTP', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  function respond(status: number, body: unknown) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  test('the admin token login posts the identifier to the token endpoint', async () => {
    const fetchMock = respond(200, { token, expiresAt, user: adminUser });
    const result = await authRepository.adminLogin({
      identifier: 'admin@example.com',
      password: 'secret',
    });
    expect(result.kind === 'session' && result.session.user.role).toBe('admin');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/admin\/auth\/token$/);
    expect(JSON.parse(init.body)).toEqual({
      identifier: 'admin@example.com',
      password: 'secret',
    });
  });

  test('admin requests carry the bearer token', async () => {
    const fetchMock = respond(200, { items: [] });
    const gateway = createAdminGateway({
      token: () => token,
      onUnauthorized: jest.fn(),
    });
    await gateway.request('/v1/admin/gifts');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/admin\/gifts$/);
    expect(init.headers.Authorization).toBe('Bearer ' + token);
  });

  test('a 401 from an admin endpoint ends the admin session', async () => {
    respond(401, { error: { code: 'unauthorized', message: 'x' } });
    const onUnauthorized = jest.fn();
    const gateway = createAdminGateway({ token: () => token, onUnauthorized });
    await expect(gateway.request('/v1/admin/users')).rejects.toMatchObject({
      status: 401,
      message: copy.admin.session.expired,
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('the gateway refuses paths outside the admin API', async () => {
    const fetchMock = respond(200, {});
    const gateway = createAdminGateway({
      token: () => token,
      onUnauthorized: jest.fn(),
    });
    await expect(gateway.request('/v1/me/profile')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('draft content images load with the bearer header', () => {
    const gateway = createAdminGateway({
      token: () => token,
      onUnauthorized: jest.fn(),
    });
    const source = gateway.imageSource('c'.repeat(32));
    expect(source?.uri).toMatch(/\/v1\/admin\/content\/images\/c{32}$/);
    expect(source?.headers.Authorization).toBe('Bearer ' + token);
    expect(gateway.imageSource('../secret')).toBeNull();
  });
});

describe('admin payload validation', () => {
  function fakeGateway(body: unknown): AdminGateway {
    return {
      request: jest.fn().mockResolvedValue(body),
      imageSource: () => null,
    } as AdminGateway;
  }
  const repositories = (body: unknown) =>
    createAdminRepositories(fakeGateway(body));
  const account = {
    ...playerUser,
    footballType: '',
    district: '',
    description: '',
    venueName: '',
    venueAddress: '',
    trainingGroundName: '',
    trainingGroundAddress: '',
    trainingSchedule: '',
  };
  const page = { page: 1, pageSize: 20, total: 1, totalPages: 1 };

  test('accounts list accepts a valid page and rejects unknown roles', async () => {
    await expect(
      repositories({ ...page, items: [account] }).accounts.list('users', 1, ''),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      repositories({
        ...page,
        items: [{ ...account, role: 'superuser' }],
      }).accounts.list('users', 1, ''),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      repositories({ ...page, items: [account], total: -1 }).accounts.list(
        'users',
        1,
        '',
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  const application = {
    userId: 'd'.repeat(32),
    role: 'club',
    fullName: 'Çankaya Gençlik',
    contactName: 'Ayşe Demir',
    username: 'cankaya',
    email: '',
    phone: '',
    district: '',
    footballType: 'amateur',
    note: '',
    status: 'pending',
    submittedAt: '2026-10-10T10:00:00Z',
    decidedAt: null,
    rejectionReason: '',
  };
  test('applications validate every field and the decision response', async () => {
    await expect(
      repositories({ items: [application] }).applications.list('pending'),
    ).resolves.toHaveLength(1);
    await expect(
      repositories({
        items: [{ ...application, userId: '../x' }],
      }).applications.list('pending'),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      repositories({
        application: { ...application, status: 'approved', decidedAt: 'soon' },
      }).applications.decide(application.userId, 'approve', ''),
    ).rejects.toBeInstanceOf(ApiError);
  });

  const leagueId = 'e'.repeat(32);
  const league = {
    id: leagueId,
    name: 'Ankara Ligi',
    season: '2026',
    description: '',
    status: 'active',
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };
  const match = {
    id: 'f'.repeat(32),
    round: 1,
    homeTeamId: '1'.repeat(32),
    awayTeamId: '2'.repeat(32),
    homeName: 'A',
    awayName: 'B',
    kickoffAt: null,
    homeGoals: 2,
    awayGoals: 1,
  };
  const detail = {
    league,
    teams: [],
    matches: [match],
    standings: [],
    statistics: {
      teamCount: 2,
      matchCount: 1,
      playedMatches: 1,
      scheduledMatches: 0,
      totalGoals: 3,
      averageGoals: 3,
      homeWins: 1,
      draws: 0,
      awayWins: 0,
    },
  };
  test('league detail requires paired scores and the requested league', async () => {
    await expect(
      repositories(detail).leagues.detail(leagueId),
    ).resolves.toMatchObject({ league: { id: leagueId } });
    await expect(
      repositories({
        ...detail,
        matches: [{ ...match, awayGoals: null }],
      }).leagues.detail(leagueId),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      repositories(detail).leagues.detail('9'.repeat(32)),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      repositories({
        ...detail,
        league: { ...league, winPoints: 11 },
      }).leagues.detail(leagueId),
    ).rejects.toBeInstanceOf(ApiError);
  });

  const payment = {
    id: '3'.repeat(32),
    product: 'team_rights',
    playerName: 'Deniz',
    playerEmail: 'deniz@example.com',
    packageCredits: 5,
    amountMinor: 20000,
    currency: 'TRY',
    provider: 'test',
    status: 'paid',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };
  const summary = {
    total: 1,
    pending: 0,
    paid: 1,
    failed: 0,
    refunded: 0,
    collectedMinor: 20000,
    refundedMinor: 0,
  };
  test('payments need a summary, known statuses and TRY packages', async () => {
    await expect(
      repositories({ ...page, items: [payment], summary }).payments.list(
        'all',
        1,
        '',
      ),
    ).resolves.toMatchObject({ summary: { paid: 1 } });
    await expect(
      repositories({ ...page, items: [payment] }).payments.list('all', 1, ''),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      repositories({
        ...page,
        items: [{ ...payment, status: 'chargeback' }],
        summary,
      }).payments.list('all', 1, ''),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      repositories({
        items: [
          {
            id: '4'.repeat(32),
            credits: 2,
            amountMinor: 10000,
            currency: 'USD',
            active: true,
            sortOrder: 1,
            appleProductId: '',
            googleProductId: '',
          },
        ],
      }).payments.packages(),
    ).rejects.toBeInstanceOf(ApiError);
  });
  const paymentPackage = {
    id: '4'.repeat(32),
    credits: 2,
    amountMinor: 10000,
    currency: 'TRY',
    active: true,
    sortOrder: 1,
    appleProductId: 'rights.2',
    googleProductId: '',
  };
  test('packages carry both store product ids', async () => {
    await expect(
      repositories({ items: [paymentPackage] }).payments.packages(),
    ).resolves.toEqual([paymentPackage]);
    const withoutGoogle: Record<string, unknown> = { ...paymentPackage };
    delete withoutGoogle.googleProductId;
    await expect(
      repositories({ items: [withoutGoogle] }).payments.packages(),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      repositories({
        items: [{ ...paymentPackage, appleProductId: null }],
      }).payments.packages(),
    ).rejects.toBeInstanceOf(ApiError);
  });
  test('package and Pro plan saves send both store ids together', async () => {
    const plan = {
      id: '5'.repeat(32),
      days: 30,
      bonusCredits: 3,
      amountMinor: 4900,
      currency: 'TRY',
      active: true,
      appleProductId: 'pro.30',
      googleProductId: 'pro.30',
    };
    const gateway = fakeGateway({ package: paymentPackage, plan });
    const services = createAdminServices(
      createAdminRepositories(gateway),
      async () => null,
    );
    await services.payments.updatePackage(paymentPackage.id, {
      amountMinor: 12000,
      active: false,
      appleProductId: ' rights.2 ',
      googleProductId: '',
    });
    expect(gateway.request).toHaveBeenLastCalledWith(
      '/v1/admin/payments/packages/' + paymentPackage.id,
      {
        method: 'PUT',
        body: {
          amountMinor: 12000,
          active: false,
          appleProductId: 'rights.2',
          googleProductId: '',
        },
      },
    );
    await expect(
      services.payments.updateProPlan(plan.id, {
        amountMinor: 4900,
        active: true,
        appleProductId: 'pro.30',
        googleProductId: 'pro.30',
      }),
    ).resolves.toEqual(plan);
    expect(gateway.request).toHaveBeenLastCalledWith(
      '/v1/admin/payments/pro-plan/' + plan.id,
      {
        method: 'PUT',
        body: {
          amountMinor: 4900,
          active: true,
          appleProductId: 'pro.30',
          googleProductId: 'pro.30',
        },
      },
    );
  });
});

describe('admin form rules', () => {
  const draft = {
    round: '3',
    homeTeamId: '1'.repeat(32),
    awayTeamId: '2'.repeat(32),
    date: '',
    time: '',
    homeGoals: '',
    awayGoals: '',
  };
  test('match scores are entered together or not at all', () => {
    expect(toMatchForm(draft)).toEqual({
      form: {
        round: 3,
        homeTeamId: draft.homeTeamId,
        awayTeamId: draft.awayTeamId,
        kickoffAt: null,
        homeGoals: null,
        awayGoals: null,
      },
    });
    expect(toMatchForm({ ...draft, homeGoals: '2' })).toEqual({
      fields: { awayGoals: copy.admin.leagues.errors.bothScores },
    });
    const played = toMatchForm({ ...draft, homeGoals: '2', awayGoals: '0' });
    expect('form' in played && played.form.homeGoals).toBe(2);
  });
  test('match kickoff needs a real local date and time', () => {
    expect(
      toMatchForm({ ...draft, date: '31.02.2026', time: '19:00' }),
    ).toEqual({ fields: { date: copy.admin.leagues.errors.date } });
    const result = toMatchForm({ ...draft, date: '18.10.2026', time: '19:30' });
    expect('form' in result && result.form.kickoffAt).toBe(
      new Date(2026, 9, 18, 19, 30).toISOString(),
    );
    expect(
      toMatchForm({ ...draft, awayTeamId: draft.homeTeamId }),
    ).toMatchObject({
      fields: { awayTeamId: copy.admin.leagues.errors.sameTeam },
    });
  });
  test('gift validity is 1–365 days and single-account gifts need an email', () => {
    const gift = {
      kind: 'application_right' as const,
      title: 'Hoş geldin',
      message: '',
      audience: 'all' as const,
      email: '',
      validityDays: 7,
    };
    expect(validateGiftDraft(gift)).toEqual({});
    expect(
      Object.keys(validateGiftDraft({ ...gift, validityDays: 366 })),
    ).toEqual(['validityDays']);
    expect(
      Object.keys(validateGiftDraft({ ...gift, audience: 'account' })),
    ).toEqual(['email']);
  });
  test('package prices are typed in lira and start at 1 TL', () => {
    expect(parsePrice('150')).toBe(15000);
    expect(parsePrice('149,90')).toBe(14990);
    expect(parsePrice('0,50')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
  });
  test('store product ids follow the App Store and Google Play rules', () => {
    const ids = { appleProductId: '', googleProductId: '' };
    expect(validateStoreProductIds(ids)).toEqual({});
    expect(
      validateStoreProductIds({
        appleProductId: ' com.FutCareer.Pro_30 ',
        googleProductId: 'pro.30_days',
      }),
    ).toEqual({});
    expect(
      Object.keys(
        validateStoreProductIds({
          appleProductId: 'pro-30',
          googleProductId: 'Pro.30',
        }),
      ),
    ).toEqual(['appleProductId', 'googleProductId']);
    expect(
      Object.keys(validateStoreProductIds({ ...ids, googleProductId: '.pro' })),
    ).toEqual(['googleProductId']);
    expect(
      Object.keys(
        validateStoreProductIds({ ...ids, appleProductId: 'a'.repeat(101) }),
      ),
    ).toEqual(['appleProductId']);
  });
  test('catalog updates always carry the amount and both trimmed store ids', () => {
    expect(
      toCatalogUpdate(
        { price: '49,90', appleProductId: ' pro.30 ', googleProductId: '' },
        true,
      ),
    ).toEqual({
      update: {
        amountMinor: 4990,
        active: true,
        appleProductId: 'pro.30',
        googleProductId: '',
      },
    });
    expect(
      toCatalogUpdate(
        { price: '0', appleProductId: '', googleProductId: 'Bad' },
        false,
      ),
    ).toEqual({
      fields: {
        amountMinor: copy.admin.payments.priceError,
        googleProductId: copy.admin.payments.googleProductError,
      },
    });
  });
});

describe('admin screens', () => {
  const mounted: ReactTestRenderer[] = [];
  // Unmount so list virtualization timers do not fire after the test.
  afterEach(() => {
    act(() => mounted.splice(0).forEach(root => root.unmount()));
  });
  function account(id: number, name: string) {
    return {
      id: String(id).repeat(32).slice(0, 32),
      fullName: name,
      email: name.toLowerCase().replace(/\s/g, '') + '@example.com',
      username: '',
      role: 'player' as const,
      city: 'Ankara',
      active: true,
      verified: false,
      createdAt: '2026-10-01T10:00:00Z',
      footballType: '' as const,
      district: '',
      description: '',
      venueName: '',
      venueAddress: '',
      trainingGroundName: '',
      trainingGroundAddress: '',
      trainingSchedule: '',
    };
  }
  function fakeServices(overrides: Partial<AdminServices['accounts']>) {
    const base = createAdminServices(
      createAdminRepositories({
        request: jest.fn(),
        imageSource: () => null,
      } as AdminGateway),
      async () => null,
    );
    return { ...base, accounts: { ...base.accounts, ...overrides } };
  }

  test('accounts list shows server pages and loads more on request', async () => {
    const list = jest
      .fn()
      .mockResolvedValueOnce({
        items: [account(1, 'Deniz Yılmaz')],
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [account(2, 'Arda Kaya')],
        page: 2,
        pageSize: 20,
        total: 2,
        totalPages: 2,
      });
    const onEdit = jest.fn();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <AccountsScreen
          services={fakeServices({ list })}
          section="users"
          onSection={jest.fn()}
          onEdit={onEdit}
          onOverview={jest.fn()}
        />,
      );
    });
    mounted.push(root);
    expect(list).toHaveBeenCalledWith('users', 1, '');
    expect(texts(root)).toContain('Deniz Yılmaz');
    expect(texts(root)).not.toContain('Arda Kaya');
    await act(async () =>
      pressable(root, copy.admin.common.loadMore).props.onPress(),
    );
    expect(list).toHaveBeenLastCalledWith('users', 2, '');
    expect(texts(root)).toEqual(
      expect.arrayContaining(['Deniz Yılmaz', 'Arda Kaya']),
    );
    await act(async () =>
      pressable(root, 'Arda Kaya, ' + copy.admin.common.edit).props.onPress(),
    );
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Arda Kaya' }),
    );
  });

  test('accounts search is sent to the server', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <AccountsScreen
          services={fakeServices({ list })}
          section="clubs"
          onSection={jest.fn()}
          onEdit={jest.fn()}
          onOverview={jest.fn()}
        />,
      );
    });
    mounted.push(root);
    const search = input(root, copy.admin.common.search);
    await act(async () => search.props.onChangeText('çankaya'));
    await act(async () => search.props.onSubmitEditing());
    expect(list).toHaveBeenLastCalledWith('clubs', 1, 'çankaya');
    expect(texts(root)).toContain(copy.admin.accounts.emptySearch);
  });

  test('account form shows server field errors under the fields', async () => {
    const save = jest
      .fn()
      .mockRejectedValue(
        new ApiError(
          'Bu e-posta zaten kullanımda.',
          409,
          { email: 'Bu e-posta zaten kullanımda.' },
          'email_exists',
        ),
      );
    const onDone = jest.fn();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <AccountEditorScreen
          services={fakeServices({ save })}
          section="users"
          onBack={jest.fn()}
          onDone={onDone}
        />,
      );
    });
    await act(async () =>
      input(root, copy.admin.editor.fullName).props.onChangeText('Deniz'),
    );
    await act(async () =>
      input(root, copy.admin.editor.email).props.onChangeText(
        'deniz@example.com',
      ),
    );
    await act(async () =>
      input(root, copy.admin.editor.password).props.onChangeText(
        'strong-password',
      ),
    );
    await act(async () =>
      pressable(root, copy.admin.editor.create).props.onPress(),
    );
    expect(save).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        fullName: 'Deniz',
        email: 'deniz@example.com',
        role: 'player',
      }),
      undefined,
    );
    const alerts = root.root.findAll(
      node =>
        node.props.accessibilityRole === 'alert' &&
        node.props.children === 'Bu e-posta zaten kullanımda.',
    );
    expect(alerts.length).toBeGreaterThan(0);
    expect(onDone).not.toHaveBeenCalled();
  });

  test('Pro plan card edits store ids and always sends both', async () => {
    const text = copy.admin.payments;
    const plan = {
      id: '5'.repeat(32),
      days: 30,
      bonusCredits: 3,
      amountMinor: 4900,
      currency: 'TRY',
      active: true,
      appleProductId: 'pro.30',
      googleProductId: '',
    };
    const base = fakeServices({});
    const updateProPlan = jest.fn(
      async (_id: string, update: Record<string, unknown>) => ({
        ...plan,
        ...update,
      }),
    );
    const services = {
      ...base,
      payments: { ...base.payments, updateProPlan },
    } as unknown as AdminServices;
    const onSaved = jest.fn();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ProPlanCard plan={plan} services={services} onSaved={onSaved} />,
      );
    });
    mounted.push(root);
    expect(input(root, text.appleProductId).props.value).toBe('pro.30');
    expect(texts(root)).toContain(text.priceHint);
    const save = () =>
      pressable(
        root,
        text.proPlanTitle(30, 3) + ', ' + text.saveProPlan,
      ).props.onPress();
    await act(async () =>
      input(root, text.googleProductId).props.onChangeText('Pro.30'),
    );
    await act(async () => save());
    expect(updateProPlan).not.toHaveBeenCalled();
    expect(texts(root)).toContain(text.googleProductError);
    await act(async () =>
      input(root, text.googleProductId).props.onChangeText(' pro.30_days '),
    );
    await act(async () => save());
    expect(updateProPlan).toHaveBeenCalledWith(plan.id, {
      amountMinor: 4900,
      active: true,
      appleProductId: 'pro.30',
      googleProductId: 'pro.30_days',
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ googleProductId: 'pro.30_days' }),
    );
    expect(texts(root)).toContain(text.proSaved);
  });
});

const reportId = '7'.repeat(32);
const openReport: ContentReport = {
  id: reportId,
  targetKind: 'post',
  targetId: '8'.repeat(32),
  targetUserId: '9'.repeat(32),
  targetName: 'Arda Kaya',
  targetRole: 'player',
  excerpt: 'Bildirilen gönderi metni',
  reason: 'spam',
  note: '',
  reporterName: 'Deniz Yılmaz',
  status: 'open',
  createdAt: '2026-10-14T10:00:00Z',
  targetReports: 2,
};

describe('admin content reports', () => {
  function gatewayWith(body: unknown) {
    const request = jest.fn().mockResolvedValue(body);
    return {
      request,
      repositories: createAdminRepositories({
        request,
        imageSource: () => null,
      } as AdminGateway),
    };
  }
  const page = { page: 1, pageSize: 20, total: 1, totalPages: 1 };

  test('report pages are validated against the requested queue and page', async () => {
    const valid = gatewayWith({ ...page, items: [openReport] });
    await expect(
      valid.repositories.reports.list('open', 1),
    ).resolves.toMatchObject({ total: 1, items: [{ id: reportId }] });
    expect(valid.request).toHaveBeenCalledWith(
      '/v1/admin/reports?status=open&page=1&pageSize=20',
    );
    const resolved = {
      ...openReport,
      status: 'dismissed',
      resolvedAt: '2026-10-15T10:00:00Z',
      targetReports: 0,
    };
    await expect(
      gatewayWith({ ...page, items: [resolved] }).repositories.reports.list(
        'resolved',
        1,
      ),
    ).resolves.toMatchObject({ total: 1 });
    const invalid: unknown[] = [
      { ...page, items: [{ ...openReport, reason: 'rude' }] },
      { ...page, items: [{ ...openReport, targetKind: 'club' }] },
      { ...page, items: [{ ...openReport, targetUserId: '../x' }] },
      { ...page, items: [{ ...openReport, targetReports: -1 }] },
      { ...page, items: [{ ...openReport, resolvedAt: 'soon' }] },
      { ...page, items: [resolved] },
      { ...page, page: 2, items: [openReport] },
      { ...page, pageSize: 50, items: [openReport] },
      { items: [openReport] },
    ];
    for (const body of invalid) {
      await expect(
        gatewayWith(body).repositories.reports.list('open', 1),
      ).rejects.toBeInstanceOf(ApiError);
    }
    // A report without a target account is still a valid report.
    const orphan: Partial<typeof openReport> = { ...openReport };
    delete orphan.targetUserId;
    await expect(
      gatewayWith({
        ...page,
        items: [{ ...orphan, targetName: '', targetRole: '' }],
      }).repositories.reports.list('open', 1),
    ).resolves.toMatchObject({ total: 1 });
  });

  test('resolving posts the action and checks the returned report', async () => {
    const removed = {
      ...openReport,
      status: 'removed',
      resolvedAt: '2026-10-15T10:00:00Z',
      targetReports: 0,
    };
    const ok = gatewayWith({ report: removed });
    await expect(
      ok.repositories.reports.resolve(reportId, 'remove'),
    ).resolves.toMatchObject({ status: 'removed' });
    expect(ok.request).toHaveBeenCalledWith(
      '/v1/admin/reports/' + reportId + '/resolve',
      { method: 'POST', body: { action: 'remove' } },
    );
    await expect(
      gatewayWith({ report: removed }).repositories.reports.resolve(
        reportId,
        'suspend',
      ),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      gatewayWith({
        report: { ...removed, id: '6'.repeat(32) },
      }).repositories.reports.resolve(reportId, 'remove'),
    ).rejects.toBeInstanceOf(ApiError);
    const unsafe = gatewayWith({ report: removed });
    await expect(
      unsafe.repositories.reports.resolve('../users', 'remove'),
    ).rejects.toBeInstanceOf(ApiError);
    expect(unsafe.request).not.toHaveBeenCalled();
  });

  test('profiles cannot be removed and orphaned targets cannot be suspended', () => {
    expect(reportActions(openReport)).toEqual(['dismiss', 'remove', 'suspend']);
    expect(reportActions({ ...openReport, targetKind: 'user' })).toEqual([
      'dismiss',
      'suspend',
    ]);
    expect(reportActions({ ...openReport, targetUserId: undefined })).toEqual([
      'dismiss',
      'remove',
    ]);
    expect(reportActions({ ...openReport, status: 'dismissed' })).toEqual([]);
  });

  describe('review screen', () => {
    const text = copy.admin.reports;
    const mounted: ReactTestRenderer[] = [];
    afterEach(() => {
      act(() => mounted.splice(0).forEach(root => root.unmount()));
      (confirm as jest.Mock).mockReset();
    });
    async function renderScreen(resolve: jest.Mock) {
      const base = createAdminServices(
        createAdminRepositories({
          request: jest.fn(),
          imageSource: () => null,
        } as AdminGateway),
        async () => null,
      );
      const list = jest
        .fn()
        .mockResolvedValueOnce({ ...page, items: [openReport] })
        .mockResolvedValue({ ...page, total: 0, items: [] });
      const services = {
        ...base,
        reports: { ...base.reports, list, resolve },
      } as unknown as AdminServices;
      let root!: ReactTestRenderer;
      await act(async () => {
        root = create(<ReportsScreen services={services} onBack={jest.fn()} />);
      });
      mounted.push(root);
      return { root, list };
    }

    test('shows the report and suspends only after confirmation', async () => {
      const resolve = jest.fn().mockResolvedValue({
        ...openReport,
        status: 'suspended',
      });
      const { root, list } = await renderScreen(resolve);
      expect(list).toHaveBeenCalledWith('open', 1);
      expect(texts(root)).toEqual(
        expect.arrayContaining([
          'Arda Kaya',
          copy.admin.roles.player,
          openReport.excerpt,
          text.reasons.spam,
          'Deniz Yılmaz',
          text.openCount(2),
        ]),
      );
      const suspend = () =>
        pressable(root, 'Arda Kaya, ' + text.suspend).props.onPress();
      (confirm as jest.Mock).mockResolvedValueOnce(false);
      await act(async () => suspend());
      expect(confirm).toHaveBeenCalledWith(
        text.suspendTitle,
        text.suspendBody('Arda Kaya'),
        text.suspend,
      );
      expect(resolve).not.toHaveBeenCalled();
      (confirm as jest.Mock).mockResolvedValueOnce(true);
      await act(async () => suspend());
      expect(resolve).toHaveBeenCalledWith(reportId, 'suspend');
      // The queue reloads: every open report about the target is closed.
      expect(list).toHaveBeenCalledTimes(2);
      expect(texts(root)).toContain(text.suspended('Arda Kaya'));
      expect(texts(root)).toContain(text.empty.open);
    });

    test('dismiss needs no confirmation and a conflict reloads the queue', async () => {
      const resolve = jest
        .fn()
        .mockRejectedValue(new ApiError('Zaten', 409, {}, 'already_resolved'));
      const { root, list } = await renderScreen(resolve);
      await act(async () =>
        pressable(root, 'Arda Kaya, ' + text.dismiss).props.onPress(),
      );
      expect(confirm).not.toHaveBeenCalled();
      expect(resolve).toHaveBeenCalledWith(reportId, 'dismiss');
      expect(texts(root)).toContain(text.alreadyResolved);
      expect(list).toHaveBeenCalledTimes(2);
    });
  });
});
