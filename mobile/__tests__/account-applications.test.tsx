import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider } from '../src/features/auth/application/AuthProvider';
import {
  toApplicationInput,
  validateApplication,
  type ApplicationDraft,
} from '../src/features/auth/application/validation';
import { authRepository } from '../src/features/auth/data/auth-repository';
import type {
  AuthRepository,
  SessionStorage,
} from '../src/features/auth/domain/models';
import { AccountTypeScreen } from '../src/features/auth/ui/AccountTypeScreen';
import { ApplicationScreen } from '../src/features/auth/ui/ApplicationScreen';
import { SignInScreen } from '../src/features/auth/ui/SignInScreen';
import { SignUpScreen } from '../src/features/auth/ui/SignUpScreen';
import { ApiError } from '../src/shared/api/client';
import { copy } from '../src/shared/lib/copy';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../src/shared/ui/Brand', () => ({ Brand: () => null }));
jest.mock('../src/shared/ui/PitchArt', () => ({ PitchArt: () => null }));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowUpRight: () => null,
  AtSign: () => null,
  Check: () => null,
  ChevronRight: () => null,
  ClipboardList: () => null,
  CircleAlert: () => null,
  CircleCheck: () => null,
  ContactRound: () => null,
  Eye: () => null,
  EyeOff: () => null,
  IdCard: () => null,
  Info: () => null,
  LandPlot: () => null,
  LockKeyhole: () => null,
  Mail: () => null,
  MapPin: () => null,
  Phone: () => null,
  Shield: () => null,
  Shirt: () => null,
  Trophy: () => null,
  UserRound: () => null,
}));

const text = copy.application;
const club: ApplicationDraft = {
  role: 'club',
  fullName: 'Çankaya Gençlik',
  contactName: 'Ayşe Demir',
  username: 'cankaya.genclik',
  email: 'kulup@example.com',
  password: 'strong-password',
  phone: '',
  district: '',
  footballType: 'amateur',
  note: '',
};
const organizer: ApplicationDraft = {
  ...club,
  role: 'organizer',
  footballType: '',
  username: 'ankara_kupa-2026',
};

describe('application validation', () => {
  test('valid club and organizer drafts pass', () => {
    expect(validateApplication(club)).toEqual({});
    expect(validateApplication(organizer)).toEqual({});
  });
  test('club requires a team type; organizer does not', () => {
    expect(
      Object.keys(validateApplication({ ...club, footballType: '' })),
    ).toEqual(['footballType']);
    expect(validateApplication({ ...organizer, footballType: '' })).toEqual({});
  });
  test('username accepts only 3-32 lowercase latin, digit, dot, underscore, dash', () => {
    for (const username of ['ab', 'Kulup', 'kulüp', 'ku lup', 'a'.repeat(33)]) {
      expect(validateApplication({ ...club, username }).username).toBe(
        text.usernameError,
      );
    }
    for (const username of ['abc', 'a.b_c-1', 'a'.repeat(32)]) {
      expect(validateApplication({ ...club, username })).toEqual({});
    }
  });
  test('optional phone, district and note follow server limits', () => {
    expect(
      validateApplication({ ...club, phone: '+90 (312) 555-12-12' }),
    ).toEqual({});
    expect(validateApplication({ ...club, phone: '0312 abc' }).phone).toBe(
      text.phoneError,
    );
    expect(validateApplication({ ...club, phone: '1'.repeat(31) }).phone).toBe(
      text.phoneError,
    );
    expect(
      validateApplication({ ...club, district: 'ç'.repeat(81) }).district,
    ).toBe(text.districtError);
    expect(validateApplication({ ...club, district: 'ç'.repeat(80) })).toEqual(
      {},
    );
    expect(validateApplication({ ...club, note: 'n'.repeat(501) }).note).toBe(
      text.noteError,
    );
    expect(validateApplication({ ...club, note: 'n'.repeat(500) })).toEqual({});
  });
  test('names, email and password limits', () => {
    const errors = validateApplication({
      ...club,
      fullName: 'X',
      contactName: 'y'.repeat(81),
      email: 'not-an-email',
      password: 'short',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'contactName',
      'email',
      'fullName',
      'password',
    ]);
    expect(
      validateApplication({ ...club, password: 'ş'.repeat(37) }).password,
    ).toBe(copy.form.passwordMax);
  });
  test('request body trims values, drops empty optionals and organizer team type', () => {
    expect(
      toApplicationInput({
        ...organizer,
        fullName: ' Ankara Kupası ',
        email: ' org@example.com ',
        footballType: 'amateur',
        district: ' Çankaya ',
      }),
    ).toEqual({
      role: 'organizer',
      fullName: 'Ankara Kupası',
      contactName: 'Ayşe Demir',
      username: 'ankara_kupa-2026',
      email: 'org@example.com',
      password: 'strong-password',
      district: 'Çankaya',
    });
    expect(
      toApplicationInput({ ...club, phone: ' 0312 ', note: 'Not' }),
    ).toEqual({
      role: 'club',
      fullName: 'Çankaya Gençlik',
      contactName: 'Ayşe Demir',
      username: 'cankaya.genclik',
      email: 'kulup@example.com',
      password: 'strong-password',
      phone: '0312',
      footballType: 'amateur',
      note: 'Not',
    });
  });
});

describe('application repository', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  function respond(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: status < 400,
      status,
      json: async () => body,
    });
  }
  test('posts the application without a token and expects pending', async () => {
    respond(201, { status: 'pending' });
    const body = toApplicationInput(club);
    await expect(authRepository.apply(body)).resolves.toEqual({
      status: 'pending',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/auth\/applications$/);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Device': expect.any(String),
    });
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual(body);
  });
  test('maps 409 and 422 responses to field errors', async () => {
    respond(409, {
      error: {
        code: 'username_exists',
        message: 'Bu kullanıcı adı kullanılıyor.',
        fields: { username: 'Bu kullanıcı adı kullanılıyor.' },
      },
    });
    const conflict = await authRepository
      .apply(toApplicationInput(club))
      .catch(error => error);
    expect(conflict).toBeInstanceOf(ApiError);
    expect(conflict.status).toBe(409);
    expect(conflict.code).toBe('username_exists');
    expect(conflict.fields).toEqual({
      username: 'Bu kullanıcı adı kullanılıyor.',
    });

    respond(422, {
      error: {
        code: 'validation_error',
        message: 'Bilgileri kontrol et.',
        fields: { phone: 'Telefon geçersiz.' },
      },
    });
    const invalid = await authRepository
      .apply(toApplicationInput(club))
      .catch(error => error);
    expect(invalid.status).toBe(422);
    expect(invalid.fields).toEqual({ phone: 'Telefon geçersiz.' });
  });
  test('rejects an unexpected success payload', async () => {
    respond(201, { status: 'active' });
    await expect(
      authRepository.apply(toApplicationInput(club)),
    ).rejects.toThrow(copy.form.unexpected);
  });
});

function makeRepository(overrides: Partial<AuthRepository> = {}) {
  return {
    login: jest.fn(),
    register: jest.fn(),
    apply: jest.fn().mockResolvedValue({ status: 'pending' }),
    me: jest.fn(),
    logout: jest.fn(),
    ...overrides,
  } as jest.Mocked<AuthRepository>;
}
function makeStorage(): jest.Mocked<SessionStorage> {
  return {
    get: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
}
async function render(
  element: React.ReactElement,
  repository: AuthRepository,
  storage = makeStorage(),
) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <AuthProvider repository={repository} storage={storage}>
        {element}
      </AuthProvider>,
    );
  });
  return root;
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
async function fill(root: ReactTestRenderer, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    await act(async () => input(root, label).props.onChangeText(value));
  }
}

describe('sign-up screens', () => {
  test('account type step lists player, coach, club and organizer', async () => {
    const onSelect = jest.fn();
    const root = await render(
      <AccountTypeScreen onBack={jest.fn()} onSelect={onSelect} />,
      makeRepository(),
    );
    const shown = texts(root);
    expect(shown).toContain(copy.accountType.title);
    expect(shown).toEqual(
      expect.arrayContaining([
        copy.accountType.player,
        copy.accountType.playerDescription,
        copy.accountType.coach,
        copy.accountType.coachDescription,
        copy.accountType.club,
        copy.accountType.clubDescription,
        copy.accountType.organizer,
        copy.accountType.organizerDescription,
      ]),
    );
    await act(async () =>
      pressable(
        root,
        copy.accountType.club + ', ' + copy.accountType.clubDescription,
      ).props.onPress(),
    );
    expect(onSelect).toHaveBeenCalledWith('club');
    await act(async () =>
      pressable(
        root,
        copy.accountType.coach + ', ' + copy.accountType.coachDescription,
      ).props.onPress(),
    );
    expect(onSelect).toHaveBeenLastCalledWith('coach');
  });

  test('a coach signs up with a licence level and gets a session at once', async () => {
    const later = new Date(Date.now() + 3600_000).toISOString();
    const repository = makeRepository({
      register: jest.fn().mockResolvedValue({
        token: 't'.repeat(43),
        expiresAt: later,
        user: {
          id: 'c'.repeat(32),
          fullName: 'Ayşe Hoca',
          email: 'ayse@example.com',
          username: '',
          active: true,
          verified: false,
          role: 'coach',
          city: 'Ankara',
          createdAt: '2026-10-19T00:00:00Z',
        },
      }),
    });
    const storage = makeStorage();
    const root = await render(
      <SignUpScreen role="coach" onSignIn={jest.fn()} />,
      repository,
      storage,
    );
    const shown = texts(root);
    expect(shown).toEqual(
      expect.arrayContaining([
        copy.signUp.coachDescription,
        copy.signUp.coachLicense,
        copy.signUp.coachPrivacy,
      ]),
    );
    expect(shown).not.toContain(copy.signUp.license);
    await fill(root, {
      [copy.signUp.name]: 'Ayşe Hoca',
      [copy.form.email]: ' ayse@example.com ',
      [copy.form.password]: 'strong-password',
    });
    await act(async () =>
      pressable(root, copy.football.types.halisaha).props.onPress(),
    );
    await act(async () => pressable(root, copy.signUp.button).props.onPress());
    expect(repository.register).not.toHaveBeenCalled();
    expect(texts(root)).toContain(copy.signUp.coachLicenseError);

    await act(async () => pressable(root, 'UEFA B').props.onPress());
    await act(async () => pressable(root, copy.signUp.button).props.onPress());
    expect(repository.register).toHaveBeenCalledWith({
      role: 'coach',
      fullName: 'Ayşe Hoca',
      email: 'ayse@example.com',
      password: 'strong-password',
      footballType: 'halisaha',
      licenseLevel: 'uefa_b',
    });
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ token: 't'.repeat(43) }),
    );
  });

  test('club application submits, shows success and stores no session', async () => {
    const repository = makeRepository();
    const storage = makeStorage();
    const onSignIn = jest.fn();
    const root = await render(
      <ApplicationScreen role="club" onBack={jest.fn()} onSignIn={onSignIn} />,
      repository,
      storage,
    );
    expect(texts(root)).toContain(text.notice);
    await fill(root, {
      [text.clubName]: 'Çankaya Gençlik',
      [text.contactName]: 'Ayşe Demir',
      [text.username]: 'cankaya.genclik',
      [copy.form.email]: 'kulup@example.com',
      [copy.form.password]: 'strong-password',
    });
    await act(async () => pressable(root, text.button).props.onPress());
    expect(repository.apply).not.toHaveBeenCalled();
    expect(texts(root)).toContain(text.footballTypeError);

    const professional = root.root.find(
      node =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function' &&
        node.findAll(
          child => child.props.children === text.footballTypes.professional,
        ).length > 0,
    );
    await act(async () => professional.props.onPress());
    await act(async () => pressable(root, text.button).props.onPress());
    expect(repository.apply).toHaveBeenCalledWith({
      role: 'club',
      fullName: 'Çankaya Gençlik',
      contactName: 'Ayşe Demir',
      username: 'cankaya.genclik',
      email: 'kulup@example.com',
      password: 'strong-password',
      footballType: 'professional',
    });
    expect(texts(root)).toEqual(
      expect.arrayContaining([text.successTitle, text.successDescription]),
    );
    expect(storage.save).not.toHaveBeenCalled();
    await act(async () => pressable(root, text.successBack).props.onPress());
    expect(onSignIn).toHaveBeenCalled();
  });

  test('organizer form has no team type and shows server field errors', async () => {
    const repository = makeRepository({
      apply: jest
        .fn()
        .mockRejectedValue(
          new ApiError(
            'Bu e-posta kullanılıyor.',
            409,
            { email: 'Bu e-posta adresi zaten kayıtlı.' },
            'email_exists',
          ),
        ),
    });
    const root = await render(
      <ApplicationScreen
        role="organizer"
        onBack={jest.fn()}
        onSignIn={jest.fn()}
      />,
      repository,
    );
    expect(texts(root)).not.toContain(text.footballType);
    await fill(root, {
      [text.organizerName]: 'Ankara Kupası',
      [text.contactName]: 'Ayşe Demir',
      [text.username]: 'ankara.kupa',
      [copy.form.email]: 'org@example.com',
      [copy.form.password]: 'strong-password',
    });
    await act(async () => pressable(root, text.button).props.onPress());
    expect(repository.apply).toHaveBeenCalledWith(
      expect.not.objectContaining({ footballType: expect.anything() }),
    );
    expect(texts(root)).toContain('Bu e-posta adresi zaten kayıtlı.');
    expect(texts(root)).not.toContain(text.successTitle);
  });
});

describe('sign-in with a pending application', () => {
  test('shows the server message as an informational notice', async () => {
    const message =
      'Başvurun yönetici onayı bekliyor. Onaylandığında bu bilgilerle giriş yapabilirsin.';
    const repository = makeRepository({
      login: jest
        .fn()
        .mockRejectedValue(new ApiError(message, 403, {}, 'pending_approval')),
    });
    const storage = makeStorage();
    const root = await render(
      <SignInScreen onSignUp={jest.fn()} />,
      repository,
      storage,
    );
    await fill(root, {
      [copy.form.identifier]: 'cankaya.genclik',
      [copy.form.password]: 'strong-password',
    });
    await act(async () => pressable(root, copy.signIn.button).props.onPress());
    expect(repository.login).toHaveBeenCalledWith({
      identifier: 'cankaya.genclik',
      password: 'strong-password',
    });
    expect(texts(root)).toContain(message);
    expect(texts(root)).not.toContain(copy.form.loginError);
    expect(storage.save).not.toHaveBeenCalled();
  });
});
