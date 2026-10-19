import React from 'react';
import { Switch, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  AuthProvider,
  useAuth,
} from '../src/features/auth/application/AuthProvider';
import type {
  AuthRepository,
  SavedSession,
  SessionStorage,
  User,
} from '../src/features/auth/domain/models';
import { MoreScreen } from '../src/app/MoreScreen';
import { CoachFacts } from '../src/features/coaches/ui/CoachFacts';
import { StaffGrantSheet } from '../src/features/coaches/ui/StaffGrantSheet';
import {
  emptyCoachProfile,
  publicView,
} from '../src/features/coaches/domain/models';
import { copy } from '../src/shared/lib/copy';
import { ApiError } from '../src/shared/api/client';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/shared/ui/Brand', () => ({ Brand: () => null }));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const texts = (root: ReactTestRenderer) =>
  root.root.findAllByType(Text).map(node => String(node.props.children));
const noop = () => undefined;

function memoryStorage(initial: SavedSession | null = null): SessionStorage {
  let value = initial;
  return {
    get: async () => value,
    save: async next => {
      value = next;
    },
    clear: async () => {
      value = null;
    },
  };
}

const coach: User = {
  id: 'c'.repeat(32),
  fullName: 'Ayşe Hoca',
  email: 'ayse@example.com',
  username: '',
  active: true,
  verified: true,
  role: 'coach',
  city: 'Ankara',
  createdAt: '2026-10-01T00:00:00Z',
};
const club: User = {
  ...coach,
  id: 'f'.repeat(32),
  fullName: 'Merkez FK',
  email: '',
  username: 'merkez.fk',
  role: 'club',
  delegate: {
    coachId: coach.id,
    coachName: coach.fullName,
    permissions: ['squad'],
  },
};
const later = new Date(Date.now() + 3600_000).toISOString();

test('a coach switches into a club and back without signing in again', async () => {
  const repository = {
    me: jest.fn(async (token: string) =>
      token === 'club'.repeat(11).slice(0, 43) ? club : coach,
    ),
    switchToClub: jest.fn(async () => ({
      token: 'club'.repeat(11).slice(0, 43),
      expiresAt: later,
      user: club,
    })),
    logout: jest.fn(async () => undefined),
  } as unknown as AuthRepository;
  const storage = memoryStorage({
    token: 'c'.repeat(43),
    expiresAt: later,
    kind: 'user',
  });
  const clubStorage = memoryStorage();
  let auth!: ReturnType<typeof useAuth>;
  function Probe() {
    auth = useAuth();
    return null;
  }
  await act(async () => {
    create(
      <AuthProvider
        repository={repository}
        storage={storage}
        clubStorage={clubStorage}
      >
        <Probe />
      </AuthProvider>,
    );
  });
  expect(auth.user?.role).toBe('coach');
  await act(async () => {
    await auth.switchToClub(club.id);
  });
  expect(auth.user?.role).toBe('club');
  expect(auth.delegate?.permissions).toEqual(['squad']);
  expect(auth.coach?.id).toBe(coach.id);
  expect(await clubStorage.get()).not.toBeNull();
  await act(async () => {
    await auth.switchBack();
  });
  expect(auth.user?.id).toBe(coach.id);
  expect(auth.delegate).toBeNull();
  expect(await clubStorage.get()).toBeNull();
  expect(repository.logout).toHaveBeenCalledWith(
    'club'.repeat(11).slice(0, 43),
  );
  // The coach's own session was never touched.
  expect(await storage.get()).toEqual(
    expect.objectContaining({ token: 'c'.repeat(43) }),
  );
});

test('a stored club session is closed once the coach is signed out', async () => {
  const clubToken = 'k'.repeat(43);
  const repository = {
    me: jest.fn(async () => {
      throw new ApiError('', 401);
    }),
    logout: jest.fn(async () => undefined),
  } as unknown as AuthRepository;
  const storage = memoryStorage({
    token: 'c'.repeat(43),
    expiresAt: later,
    kind: 'user',
  });
  const clubStorage = memoryStorage({
    token: clubToken,
    expiresAt: later,
    kind: 'user',
  });
  let auth!: ReturnType<typeof useAuth>;
  function Probe() {
    auth = useAuth();
    return null;
  }
  await act(async () => {
    create(
      <AuthProvider
        repository={repository}
        storage={storage}
        clubStorage={clubStorage}
      >
        <Probe />
      </AuthProvider>,
    );
  });
  expect(auth.user).toBeNull();
  expect(await storage.get()).toBeNull();
  expect(await clubStorage.get()).toBeNull();
  expect(repository.logout).toHaveBeenCalledWith(clubToken);
});

const moreProps = {
  onProfile: noop,
  onSettings: noop,
  onTeamRequests: noop,
  onMyTeamApplications: noop,
  onBuyTeamRights: noop,
  onNews: noop,
  onGifts: noop,
  onSquad: noop,
  onClubListings: noop,
  onListings: noop,
  onMemberships: noop,
  onTournaments: noop,
  onTournamentEntries: noop,
};

test('a switched coach sees only the club sections they were given', () => {
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <MoreScreen
        {...moreProps}
        isClub
        isPlayer={false}
        onStaff={noop}
        delegate={{
          coachName: 'Ayşe Hoca',
          permissions: ['squad'],
          onBack: noop,
        }}
      />,
    );
  });
  const shown = texts(root);
  expect(shown).toContain(copy.more.squad);
  expect(shown).toContain(copy.coaches.backTo('Ayşe Hoca'));
  for (const hidden of [
    copy.more.teamRequests,
    copy.more.clubListings,
    copy.more.tournamentEntries,
    copy.more.settings,
    copy.more.gifts,
    copy.coaches.staff,
  ])
    expect(shown).not.toContain(hidden);
});

test('the club owner gets Teknik ekip and the coach gets Kulüplerim', () => {
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <MoreScreen {...moreProps} isClub isPlayer={false} onStaff={noop} />,
    );
  });
  expect(texts(root)).toContain(copy.coaches.staff);
  act(() => {
    root.update(
      <MoreScreen
        {...moreProps}
        isClub={false}
        isPlayer={false}
        onCoachClubs={noop}
      />,
    );
  });
  expect(texts(root)).toContain(copy.coaches.myClubs);
});

test('hidden coach details stay off the public profile', () => {
  const profile = {
    ...emptyCoachProfile(),
    licenseLevel: 'uefa_b' as const,
    experienceYears: 8,
    specialties: ['youth' as const],
    pastClubs: ['Eski Spor'],
    visibility: {
      license: true,
      experience: false,
      football: false,
      clubs: false,
    },
  };
  let root!: ReactTestRenderer;
  act(() => {
    root = create(<CoachFacts profile={publicView(profile)} clubs={[]} />);
  });
  const shown = texts(root).join(' ');
  expect(shown).toContain(copy.coaches.licenseLine('UEFA B'));
  expect(shown).not.toContain('Altyapı');
  expect(shown).not.toContain('Eski Spor');
});

test('the grant sheet sends the chosen role and sections', () => {
  const onSubmit = jest.fn();
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <StaffGrantSheet
        visible
        coach={{
          id: 'c'.repeat(32),
          fullName: 'Ayşe Hoca',
          verified: true,
          district: '',
          avatarVersion: 0,
        }}
        profile={emptyCoachProfile()}
        initial={{ role: 'head_coach', permissions: [] }}
        mode="invite"
        busy={false}
        error=""
        onClose={noop}
        onSubmit={onSubmit}
      />,
    );
  });
  const toggle = root.root
    .findAllByType(Switch)
    .find(
      node =>
        node.props.accessibilityLabel === copy.coaches.permissions.applications,
    );
  act(() => toggle!.props.onValueChange(true));
  const assistant = root.root.find(
    node =>
      node.props.accessibilityRole === 'radio' &&
      typeof node.props.onPress === 'function' &&
      node
        .findAllByType(Text)
        .some(t => t.props.children === copy.coaches.specialties.assistant),
  );
  act(() => assistant.props.onPress());
  const send = root.root.find(
    node =>
      node.props.accessibilityLabel === copy.coaches.sendInvite &&
      typeof node.props.onPress === 'function',
  );
  act(() => send.props.onPress());
  expect(onSubmit).toHaveBeenCalledWith({
    role: 'assistant',
    permissions: ['applications'],
  });
});
