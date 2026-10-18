import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { authRepository } from '../src/features/auth/data/auth-repository';
import { tournamentsRepository } from '../src/features/tournaments/data/http-tournaments-repository';
import type { TournamentsService } from '../src/features/tournaments/application/tournaments-service';
import { createTournamentsService } from '../src/features/tournaments/application/tournaments-service';
import {
  createErrorMessage,
  emptyTournamentDraft,
  toggleRosterPlayer,
  tournamentFieldErrors,
  validateTournament,
} from '../src/features/tournaments/application/validation';
import {
  canEnterTournament,
  isEligibleClub,
  type ClubEntrySource,
  type Tournament,
  type TournamentEntry,
} from '../src/features/tournaments/domain/models';
import { TournamentDetailScreen } from '../src/features/tournaments/ui/TournamentDetailScreen';
import { TournamentEntryForm } from '../src/features/tournaments/ui/TournamentEntryForm';
import { TournamentForm } from '../src/features/tournaments/ui/TournamentForm';
import { MoreScreen } from '../src/app/MoreScreen';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../src/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../src/features/connections/ui/confirm-action', () => ({
  confirmAction: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowUpRight: () => null,
  Bell: () => null,
  CalendarDays: () => null,
  ChevronDown: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  ChevronUp: () => null,
  CircleAlert: () => null,
  ClipboardList: () => null,
  Compass: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Gift: () => null,
  MapPin: () => null,
  Medal: () => null,
  Megaphone: () => null,
  MessagesSquare: () => null,
  Newspaper: () => null,
  Settings: () => null,
  Shield: () => null,
  ShoppingBag: () => null,
  Square: () => null,
  SquareCheck: () => null,
  UserRound: () => null,
  Users: () => null,
}));

const mockedRequest = request as jest.MockedFunction<typeof request>;
const id = (n: number) => n.toString(16).padStart(32, '0');
const stamp = '2026-10-13T10:00:00Z';
const text = copy.tournaments;

const tournament: Tournament = {
  id: id(1),
  organizerId: id(2),
  organizerName: 'Ankara Organizasyon',
  name: 'Sonbahar Kupası',
  format: 'seven_a_side',
  eligibleTypes: ['amateur', 'halisaha'],
  district: 'Çankaya',
  venue: 'Merkez Saha',
  description: 'Hafta sonu maçları.',
  startsOn: '2026-11-01',
  endsOn: '2026-11-15',
  applicationDeadline: '2026-10-25',
  teamCapacity: 16,
  status: 'open',
  acceptedTeams: 3,
  pendingEntries: 2,
  createdAt: stamp,
};
const entry: TournamentEntry = {
  id: id(3),
  tournamentId: tournament.id,
  tournamentName: tournament.name,
  tournamentStatus: 'open',
  clubId: id(4),
  clubName: 'Örnek Spor',
  clubDistrict: 'Keçiören',
  clubFootballType: 'amateur',
  message: 'Hazırız.',
  status: 'pending',
  players: [{ id: id(5), name: 'Ali Yılmaz', position: 'Stoper' }],
  createdAt: stamp,
  decidedAt: null,
};
const page = (items: unknown[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 20,
  total,
  totalPages: Math.ceil(total / 20),
});

function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children as string);
}
function pressable(root: ReactTestRenderer, role: string, label: string) {
  return root.root.findAll(
    node =>
      node.props.accessibilityRole === role &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
}
function textInput(root: ReactTestRenderer, label: string) {
  return root.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onChangeText === 'function',
  )[0];
}

beforeEach(() => {
  mockedRequest.mockReset();
});

describe('tournament repository validation', () => {
  it('accepts an open tournament page and the detail', async () => {
    mockedRequest.mockResolvedValueOnce(page([tournament], 21));
    await expect(tournamentsRepository.open('t', 1)).resolves.toEqual(
      page([tournament], 21),
    );
    expect(mockedRequest).toHaveBeenCalledWith('/v1/tournaments?page=1', {
      token: 't',
    });
    mockedRequest.mockResolvedValueOnce({ tournament });
    await expect(
      tournamentsRepository.detail('t', tournament.id),
    ).resolves.toEqual(tournament);
  });

  it('rejects malformed tournaments', async () => {
    for (const item of [
      { ...tournament, format: 'futsal' },
      { ...tournament, eligibleTypes: [] },
      { ...tournament, eligibleTypes: ['amateur', 'amateur'] },
      { ...tournament, eligibleTypes: ['unknown'] },
      { ...tournament, startsOn: '01.11.2026' },
      { ...tournament, teamCapacity: 1 },
      { ...tournament, teamCapacity: 129 },
      { ...tournament, status: 'closed' },
      { ...tournament, acceptedTeams: -1 },
      { ...tournament, organizerId: 'abc' },
    ]) {
      mockedRequest.mockResolvedValueOnce(page([item]));
      await expect(tournamentsRepository.open('t', 1)).rejects.toBeInstanceOf(
        ApiError,
      );
    }
    mockedRequest.mockResolvedValueOnce({
      ...page([tournament]),
      pageSize: 50,
    });
    await expect(tournamentsRepository.open('t', 1)).rejects.toBeInstanceOf(
      ApiError,
    );
    mockedRequest.mockResolvedValueOnce({ tournament });
    await expect(
      tournamentsRepository.detail('t', id(9)),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('accepts valid entries and rejects malformed ones', async () => {
    mockedRequest.mockResolvedValueOnce({ items: [entry] });
    await expect(tournamentsRepository.myEntries('t')).resolves.toEqual([
      entry,
    ]);
    const player = entry.players[0];
    for (const item of [
      { ...entry, status: 'deleted' },
      { ...entry, tournamentStatus: 'draft' },
      { ...entry, clubFootballType: 'futsal' },
      { ...entry, decidedAt: 'never' },
      { ...entry, players: [{ ...player, id: 'x' }] },
      {
        ...entry,
        players: Array.from({ length: 31 }, (_, n) => ({
          ...player,
          id: id(100 + n),
        })),
      },
      { ...entry, players: null },
    ]) {
      mockedRequest.mockResolvedValueOnce({ items: [item] });
      await expect(tournamentsRepository.myEntries('t')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
  });

  it('checks write responses against the request', async () => {
    mockedRequest.mockResolvedValueOnce({ entry });
    await expect(
      tournamentsRepository.enter('t', tournament.id, {
        message: '',
        playerIds: [id(5)],
      }),
    ).resolves.toEqual(entry);
    mockedRequest.mockResolvedValueOnce({
      entry: { ...entry, status: 'accepted' },
    });
    await expect(
      tournamentsRepository.enter('t', tournament.id, {
        message: '',
        playerIds: [],
      }),
    ).rejects.toBeInstanceOf(ApiError);
    mockedRequest.mockResolvedValueOnce({ tournament, notifiedClubs: 4 });
    const input = {
      name: tournament.name,
      format: tournament.format,
      eligibleTypes: tournament.eligibleTypes,
      district: '',
      venue: '',
      description: '',
      startsOn: tournament.startsOn,
      endsOn: tournament.endsOn,
      applicationDeadline: tournament.applicationDeadline,
      teamCapacity: 16,
    };
    await expect(tournamentsRepository.create('t', input)).resolves.toEqual({
      tournament,
      notifiedClubs: 4,
    });
    mockedRequest.mockResolvedValueOnce({ tournament, notifiedClubs: -2 });
    await expect(
      tournamentsRepository.create('t', input),
    ).rejects.toBeInstanceOf(ApiError);
    mockedRequest.mockResolvedValueOnce({ tournament });
    await expect(
      tournamentsRepository.setStatus('t', tournament.id, 'closed'),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('treats a missing tournament as an entry id when resolving notifications', async () => {
    const service = createTournamentsService(tournamentsRepository);
    mockedRequest.mockRejectedValueOnce(new ApiError('Yok', 404));
    await expect(service.find('t', entry.id)).resolves.toBeNull();
  });
});

describe('organizer accounts', () => {
  const user = {
    id: id(2),
    fullName: 'Ankara Organizasyon',
    email: '',
    username: 'ankara.org',
    active: true,
    verified: false,
    city: 'Ankara',
    createdAt: stamp,
  };

  it('accepts the organizer role when parsing the session user', async () => {
    mockedRequest.mockResolvedValueOnce({
      user: { ...user, role: 'organizer' },
    });
    await expect(authRepository.me('t')).resolves.toMatchObject({
      role: 'organizer',
    });
    mockedRequest.mockResolvedValueOnce({ user: { ...user, role: 'admin' } });
    await expect(authRepository.me('t')).rejects.toBeInstanceOf(ApiError);
  });

  it('shows only account, news and tournaments in Diğer', () => {
    const noop = jest.fn();
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <MoreScreen
          onSettings={noop}
          onDiscover={noop}
          onConnections={noop}
          onTeamRequests={noop}
          onMyTeamApplications={noop}
          onBuyTeamRights={noop}
          onNews={noop}
          onGifts={noop}
          onSquad={noop}
          onClubListings={noop}
          onListings={noop}
          onMemberships={noop}
          onTournaments={noop}
          onTournamentEntries={noop}
          onVisitors={noop}
          isClub={false}
          isPlayer={false}
          isOrganizer
        />,
      );
    });
    const labels = root.root
      .findAll(
        node =>
          node.props.accessibilityRole === 'button' &&
          typeof node.props.onPress === 'function' &&
          typeof node.props.accessibilityHint === 'string',
      )
      .map(node => node.props.accessibilityHint as string);
    expect(labels).toEqual([
      copy.more.tournamentsHint,
      copy.more.newsHint,
      copy.more.settingsHint,
    ]);
    const shown = texts(root);
    for (const hidden of [
      copy.more.profile,
      copy.more.gifts,
      copy.more.discover,
      copy.more.connections,
      copy.more.listings,
      copy.more.teamRequests,
      copy.more.myTeamApplications,
      copy.more.buyTeamRights,
      copy.more.tournamentEntries,
    ]) {
      expect(shown).not.toContain(hidden);
    }
  });
});

describe('club eligibility', () => {
  it('requires a known club type listed in the tournament', () => {
    expect(isEligibleClub(tournament, 'amateur')).toBe(true);
    expect(isEligibleClub(tournament, 'professional')).toBe(false);
    expect(isEligibleClub(tournament, 'unknown')).toBe(false);
    expect(canEnterTournament(tournament, 'amateur', null)).toBe(true);
    expect(
      canEnterTournament({ ...tournament, status: 'closed' }, 'amateur', null),
    ).toBe(false);
    expect(
      canEnterTournament(tournament, 'amateur', { status: 'withdrawn' }),
    ).toBe(true);
    expect(
      canEnterTournament(tournament, 'amateur', { status: 'rejected' }),
    ).toBe(false);
    expect(
      canEnterTournament(tournament, 'amateur', { status: 'pending' }),
    ).toBe(false);
  });

  async function renderDetail(club: ClubEntrySource | undefined) {
    const service = {
      detail: jest.fn().mockResolvedValue(tournament),
      myEntries: jest.fn().mockResolvedValue([]),
    } as unknown as TournamentsService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <TournamentDetailScreen
          token="t"
          id={tournament.id}
          service={service}
          club={club}
          onBack={jest.fn()}
        />,
      );
    });
    return root;
  }
  const source = (type: 'amateur' | 'professional'): ClubEntrySource => ({
    footballType: jest.fn().mockResolvedValue(type),
    squad: jest.fn().mockResolvedValue([]),
  });

  it('enables Başvur only for an eligible club type', async () => {
    const eligible = await renderDetail(source('amateur'));
    expect(
      pressable(eligible, 'button', text.apply).props.accessibilityState
        .disabled,
    ).toBe(false);
    const other = await renderDetail(source('professional'));
    expect(
      pressable(other, 'button', text.apply).props.accessibilityState.disabled,
    ).toBe(true);
    expect(texts(other)).toContain(text.notEligible);
  });

  it('lets players and coaches browse without an apply button', async () => {
    const root = await renderDetail(undefined);
    expect(pressable(root, 'button', text.apply)).toBeUndefined();
    expect(texts(root)).toContain(text.browseOnly);
  });
});

describe('tournament roster', () => {
  it('keeps the roster at 30 players', () => {
    let selected: string[] = [];
    for (let n = 0; n < 31; n++) selected = toggleRosterPlayer(selected, id(n));
    expect(selected).toHaveLength(30);
    expect(selected).not.toContain(id(30));
    selected = toggleRosterPlayer(selected, id(0));
    expect(selected).toHaveLength(29);
  });

  it('disables extra players and sends at most 30', async () => {
    const squad = Array.from({ length: 31 }, (_, n) => ({
      id: id(200 + n),
      name: 'Oyuncu ' + n,
      position: '',
    }));
    const enter = jest.fn().mockResolvedValue(entry);
    const service = { enter } as unknown as TournamentsService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <TournamentEntryForm
          token="t"
          tournamentId={tournament.id}
          service={service}
          loadSquad={jest.fn().mockResolvedValue(squad)}
          onSubmitted={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
    });
    for (const player of squad.slice(0, 30)) {
      act(() => pressable(root, 'checkbox', player.name).props.onPress());
    }
    const last = root.root.findAll(
      node =>
        node.props.accessibilityRole === 'checkbox' &&
        node.props.accessibilityLabel === squad[30].name &&
        node.props.accessibilityState,
    )[0];
    expect(last.props.accessibilityState).toMatchObject({
      checked: false,
      disabled: true,
    });
    expect(texts(root)).toContain(text.rosterCount(30, 30));
    await act(async () => {
      await pressable(root, 'button', text.submit).props.onPress();
    });
    expect(enter).toHaveBeenCalledWith('t', tournament.id, {
      message: '',
      playerIds: squad.slice(0, 30).map(player => player.id),
    });
  });
});

describe('create tournament form', () => {
  const draft = {
    ...emptyTournamentDraft,
    name: 'Kış Kupası',
    format: 'halisaha' as const,
    eligibleTypes: ['halisaha' as const],
    startsOn: '2026-12-01',
    endsOn: '2026-12-02',
    applicationDeadline: '2026-11-20',
    teamCapacity: '8',
  };

  it('validates dates, choices and capacity on the client', () => {
    expect(validateTournament(draft)).toEqual({});
    expect(
      Object.keys(
        validateTournament({
          ...draft,
          format: '',
          eligibleTypes: [],
          startsOn: '2026-02-30',
          teamCapacity: '200',
        }),
      ),
    ).toEqual(['format', 'eligibleTypes', 'startsOn', 'teamCapacity']);
    expect(validateTournament({ ...draft, endsOn: '2026-11-30' }).endsOn).toBe(
      text.endsError,
    );
    expect(
      validateTournament({ ...draft, applicationDeadline: '2026-12-05' })
        .applicationDeadline,
    ).toBe(text.deadlineError);
  });

  it('maps 422 fields and explains the 403 verification rule', () => {
    const failure = new ApiError('Doğrulama hatası', 422, {
      startsOn: 'Başlangıç tarihi geçmişte olamaz.',
      request: 'Geçerli bir istek gönder.',
    });
    expect(tournamentFieldErrors(failure)).toEqual({
      startsOn: 'Başlangıç tarihi geçmişte olamaz.',
    });
    expect(createErrorMessage(new ApiError('Yasak', 403))).toBe(
      text.verificationRequired,
    );
  });

  it('shows 422 field errors under the fields', async () => {
    const create422 = jest.fn().mockRejectedValue(
      new ApiError('Doğrulama hatası', 422, {
        startsOn: 'Başlangıç tarihi geçmişte olamaz.',
        teamCapacity: 'Takım kapasitesi 2-128 arasında olmalı.',
      }),
    );
    const service = { create: create422 } as unknown as TournamentsService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <TournamentForm
          token="t"
          service={service}
          onCreated={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
    });
    const labels = text.labels;
    act(() => {
      textInput(root, labels.name).props.onChangeText(draft.name);
      textInput(root, labels.startsOn).props.onChangeText(draft.startsOn);
      textInput(root, labels.endsOn).props.onChangeText(draft.endsOn);
      textInput(root, labels.applicationDeadline).props.onChangeText(
        draft.applicationDeadline,
      );
      textInput(root, labels.teamCapacity).props.onChangeText(
        draft.teamCapacity,
      );
    });
    act(() => {
      pressable(root, 'radio', text.formats.halisaha).props.onPress();
      pressable(root, 'checkbox', text.teamTypes.halisaha).props.onPress();
    });
    await act(async () => {
      await pressable(root, 'button', text.publish).props.onPress();
    });
    expect(create422).toHaveBeenCalledWith(
      't',
      expect.objectContaining({ format: 'halisaha', teamCapacity: 8 }),
    );
    const shown = texts(root);
    expect(shown).toContain('Başlangıç tarihi geçmişte olamaz.');
    expect(shown).toContain('Takım kapasitesi 2-128 arasında olmalı.');
  });
});
