import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { tournamentsRepository } from '../src/features/tournaments/data/http-tournaments-repository';
import {
  createTournamentsService,
  type TournamentsService,
} from '../src/features/tournaments/application/tournaments-service';
import {
  emptyMatchDraft,
  matchDraftOf,
  toMatchInput,
  validateMatch,
} from '../src/features/tournaments/application/validation';
import {
  canEnterTournament,
  leaguePhase,
  matchRounds,
  type Tournament,
  type TournamentEntry,
  type TournamentMatch,
  type TournamentsRepository,
} from '../src/features/tournaments/domain/models';
import { TournamentEntriesScreen } from '../src/features/tournaments/ui/TournamentEntriesScreen';
import { OrganizerTournamentScreen } from '../src/features/tournaments/ui/OrganizerTournamentScreen';
import { squadRepository } from '../src/features/squad/data/http-squad-repository';
import { createSquadService } from '../src/features/squad/application/squad-service';
import {
  inviteMessageError,
  isInviteSearch,
} from '../src/features/squad/application/invite-validation';
import {
  splitClubInvites,
  type SquadInvite,
} from '../src/features/squad/domain/models';
import { SquadInvitesScreen } from '../src/features/squad/ui/SquadInvitesScreen';
import { NotificationsScreen } from '../src/features/notifications/ui/NotificationsScreen';
import type { NotificationsService } from '../src/features/notifications/application/notification-service';
import { normalizeNotificationKind } from '../src/features/notifications/domain/models';
import { confirmAction } from '../src/features/connections/ui/confirm-action';
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
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const mockedRequest = request as jest.MockedFunction<typeof request>;
const mockedConfirm = confirmAction as jest.MockedFunction<
  typeof confirmAction
>;
const id = (n: number) => n.toString(16).padStart(32, '0');
const stamp = '2026-10-22T10:00:00Z';
const text = copy.tournaments;

const tournament: Tournament = {
  id: id(1),
  organizerId: id(2),
  organizerName: 'Ankara Halısaha',
  name: 'Sonbahar Halısaha Ligi',
  format: 'halisaha',
  eligibleTypes: ['halisaha'],
  district: 'Çankaya',
  venue: 'Arena',
  description: '',
  startsOn: '2026-11-01',
  endsOn: '2026-12-15',
  applicationDeadline: '2026-10-30',
  teamCapacity: 8,
  status: 'closed',
  acceptedTeams: 2,
  pendingEntries: 0,
  createdAt: stamp,
};
const match: TournamentMatch = {
  id: id(10),
  round: 1,
  homeEntryId: id(3),
  awayEntryId: id(4),
  homeName: 'Kartallar',
  awayName: 'Şimşekler',
  homeClubId: id(5),
  awayClubId: id(6),
  kickoffAt: null,
  venue: '',
  homeGoals: null,
  awayGoals: null,
};
const table = {
  tournament,
  teams: [
    {
      entryId: id(3),
      clubId: id(5),
      name: 'Kartallar',
      district: '',
      players: 7,
    },
    {
      entryId: id(4),
      clubId: id(6),
      name: 'Şimşekler',
      district: '',
      players: 8,
    },
  ],
  matches: [match],
  standings: [
    {
      position: 1,
      entryId: id(3),
      clubId: id(5),
      teamName: 'Kartallar',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    },
  ],
};
const entry: TournamentEntry = {
  id: id(3),
  tournamentId: tournament.id,
  tournamentName: tournament.name,
  tournamentStatus: 'open',
  clubId: id(5),
  clubName: 'Kartallar',
  clubDistrict: '',
  clubFootballType: 'halisaha',
  message: '',
  status: 'invited',
  players: [],
  createdAt: stamp,
  decidedAt: null,
};
const invite: SquadInvite = {
  id: id(20),
  clubId: id(5),
  clubName: 'Kartallar',
  playerId: id(21),
  playerName: 'Ali Yılmaz',
  position: 'Kanat',
  message: 'Aramıza katıl.',
  status: 'pending',
  createdAt: stamp,
  decidedAt: null,
};

function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children as string);
}
function button(root: ReactTestRenderer, label: string) {
  return root.root.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
}

beforeEach(() => {
  mockedRequest.mockReset();
  mockedConfirm.mockReset();
});

describe('halı saha tournaments repository', () => {
  it('lists all halı saha tournaments and rejects other formats', async () => {
    const page = {
      items: [tournament, { ...tournament, id: id(7), status: 'finished' }],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    };
    mockedRequest.mockResolvedValueOnce(page);
    await expect(tournamentsRepository.halisaha('t', 1)).resolves.toEqual(page);
    expect(mockedRequest).toHaveBeenCalledWith(
      '/v1/tournaments?page=1&format=halisaha&view=all',
      { token: 't' },
    );
    mockedRequest.mockResolvedValueOnce({
      ...page,
      items: [{ ...tournament, format: 'seven_a_side' }],
    });
    await expect(tournamentsRepository.halisaha('t', 1)).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('validates the table and rejects a half-entered score', async () => {
    mockedRequest.mockResolvedValueOnce(table);
    await expect(
      tournamentsRepository.table('t', tournament.id),
    ).resolves.toEqual(table);
    expect(mockedRequest).toHaveBeenCalledWith(
      '/v1/tournaments/' + tournament.id + '/table',
      { token: 't' },
    );
    mockedRequest.mockResolvedValueOnce({
      ...table,
      matches: [{ ...match, homeGoals: 2 }],
    });
    await expect(
      tournamentsRepository.table('t', tournament.id),
    ).rejects.toBeInstanceOf(ApiError);
    mockedRequest.mockResolvedValueOnce(table);
    await expect(
      tournamentsRepository.table('t', id(9)),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('sends the organizer fixture, match and invite requests', async () => {
    mockedRequest.mockResolvedValueOnce(table);
    await tournamentsRepository.generateFixture('t', tournament.id, 2);
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/me/tournaments/' + tournament.id + '/fixture',
      { method: 'POST', token: 't', body: { legs: 2 } },
    );
    mockedRequest.mockResolvedValueOnce({
      match: { ...match, homeGoals: 3, awayGoals: 1 },
    });
    const service = createTournamentsService(tournamentsRepository);
    await service.saveMatch('t', tournament.id, match.id, {
      round: 1,
      homeEntryId: match.homeEntryId,
      awayEntryId: match.awayEntryId,
      kickoffAt: null,
      venue: ' Arena ',
      homeGoals: 3,
      awayGoals: 1,
    });
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/me/tournaments/' + tournament.id + '/matches/' + match.id,
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ venue: 'Arena', homeGoals: 3 }),
      }),
    );
    mockedRequest.mockResolvedValueOnce({ entry });
    await expect(
      service.invite('t', tournament.id, entry.clubId, '  '),
    ).resolves.toEqual(entry);
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/me/tournaments/' + tournament.id + '/invites',
      { method: 'POST', token: 't', body: { clubId: entry.clubId } },
    );
    mockedRequest.mockResolvedValueOnce({
      entry: { ...entry, status: 'pending' },
    });
    await expect(
      service.cancelInvite('t', tournament.id, entry.id),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('declines an invitation without a roster', async () => {
    mockedRequest.mockResolvedValueOnce({
      entry: { ...entry, status: 'declined' },
    });
    const service = createTournamentsService(tournamentsRepository);
    await service.respond('t', entry.id, 'decline', [id(30)]);
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/me/tournament-entries/' + entry.id + '/respond',
      { method: 'PUT', token: 't', body: { decision: 'decline' } },
    );
  });

  it('finds the organizer tournament behind an entry notification', async () => {
    const repository = {
      mine: jest
        .fn()
        .mockResolvedValue([{ ...tournament, id: id(8) }, tournament]),
      entries: jest
        .fn()
        .mockImplementation((_token: string, tournamentId: string) =>
          Promise.resolve(tournamentId === tournament.id ? [entry] : []),
        ),
    } as unknown as TournamentsRepository;
    const service = createTournamentsService(repository);
    await expect(service.organizerTournamentOf('t', entry.id)).resolves.toBe(
      tournament.id,
    );
    await expect(service.organizerTournamentOf('t', id(8))).resolves.toBe(
      id(8),
    );
    await expect(
      service.organizerTournamentOf('t', id(99)),
    ).resolves.toBeNull();
  });
});

describe('halı saha domain rules', () => {
  it('groups matches by week and reads statuses as a season', () => {
    const rounds = matchRounds([
      { ...match, id: id(11), round: 2 },
      match,
      { ...match, id: id(12), round: 2 },
    ]);
    expect(rounds.map(item => [item.round, item.matches.length])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(leaguePhase('open')).toBe('open');
    expect(leaguePhase('closed')).toBe('running');
    expect(leaguePhase('finished')).toBe('finished');
  });

  it('lets a club that declined an invitation apply again', () => {
    const open = { ...tournament, status: 'open' as const };
    expect(canEnterTournament(open, 'halisaha', { status: 'declined' })).toBe(
      true,
    );
    expect(canEnterTournament(open, 'halisaha', { status: 'invited' })).toBe(
      false,
    );
  });
});

describe('match form', () => {
  const draft = {
    ...emptyMatchDraft(3),
    homeEntryId: id(3),
    awayEntryId: id(4),
  };

  it('accepts a week, two teams and an optional kickoff and score', () => {
    expect(validateMatch(draft)).toEqual({});
    const input = toMatchInput({
      ...draft,
      kickoffDate: '2026-11-07',
      kickoffTime: '20:30',
      homeGoals: '2',
      awayGoals: '0',
    });
    expect(input).toMatchObject({ round: 3, homeGoals: 2, awayGoals: 0 });
    const at = new Date(input.kickoffAt as string);
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([7, 20, 30]);
    expect(
      matchDraftOf({ ...match, kickoffAt: input.kickoffAt, round: 3 }),
    ).toMatchObject({ kickoffDate: '2026-11-07', kickoffTime: '20:30' });
    expect(toMatchInput(draft)).toMatchObject({
      kickoffAt: null,
      homeGoals: null,
      awayGoals: null,
    });
  });

  it('rejects bad weeks, same teams, half kickoffs and half scores', () => {
    const errors = validateMatch({
      ...draft,
      round: '0',
      awayEntryId: id(3),
      kickoffDate: '2026-11-07',
      homeGoals: '1',
    });
    expect(errors).toEqual({
      round: text.roundError(1, 300),
      teams: text.sameTeamError,
      kickoff: text.kickoffError,
      score: text.scorePairError,
    });
    expect(
      validateMatch({ ...draft, homeGoals: '100', awayGoals: '1' }).score,
    ).toBe(text.scoreError(0, 99));
    expect(validateMatch({ ...draft, kickoffTime: '24:00' }).kickoff).toBe(
      text.kickoffError,
    );
  });
});

describe('club tournament invitations', () => {
  async function renderEntries(service: Partial<TournamentsService>) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <TournamentEntriesScreen
          token="t"
          service={
            {
              myEntries: jest.fn().mockResolvedValue([entry]),
              ...service,
            } as unknown as TournamentsService
          }
          club={{
            footballType: jest.fn().mockResolvedValue('halisaha'),
            squad: jest
              .fn()
              .mockResolvedValue([
                { id: id(30), name: 'Veli Kaya', position: 'Kaleci' },
              ]),
          }}
          onBack={jest.fn()}
          onOpen={jest.fn()}
        />,
      );
    });
    return root;
  }

  it('shows the invited status and declines after confirmation', async () => {
    const respond = jest
      .fn()
      .mockResolvedValue({ ...entry, status: 'declined' });
    const root = await renderEntries({ respond });
    expect(texts(root)).toContain(text.entryStatus.invited);
    mockedConfirm.mockResolvedValueOnce(true);
    await act(async () =>
      button(
        root,
        text.declineInvite + ': ' + entry.tournamentName,
      ).props.onPress(),
    );
    expect(respond).toHaveBeenCalledWith('t', entry.id, 'decline');
    expect(texts(root)).toContain(text.inviteDeclined);
  });

  it('accepts with a roster picked from the squad', async () => {
    const respond = jest
      .fn()
      .mockResolvedValue({ ...entry, status: 'accepted' });
    const root = await renderEntries({ respond });
    await act(async () =>
      button(
        root,
        text.acceptInvite + ': ' + entry.tournamentName,
      ).props.onPress(),
    );
    const player = root.root.findAll(
      node =>
        node.props.accessibilityRole === 'checkbox' &&
        node.props.accessibilityLabel === 'Veli Kaya' &&
        typeof node.props.onPress === 'function',
    )[0];
    await act(async () => player.props.onPress());
    await act(async () =>
      button(root, text.acceptInviteSubmit).props.onPress(),
    );
    expect(respond).toHaveBeenCalledWith('t', entry.id, 'accept', [id(30)]);
    expect(texts(root)).toContain(text.inviteAccepted(entry.tournamentName));
  });
});

describe('squad invitations', () => {
  it('validates invitations and checks write responses', async () => {
    mockedRequest.mockResolvedValueOnce({ items: [invite] });
    await expect(squadRepository.playerInvites('t')).resolves.toEqual([invite]);
    mockedRequest.mockResolvedValueOnce({
      items: [{ ...invite, status: 'expired' }],
    });
    await expect(squadRepository.clubInvites('t')).rejects.toBeInstanceOf(
      ApiError,
    );
    const service = createSquadService(squadRepository);
    mockedRequest.mockResolvedValueOnce({ items: [] });
    await service.candidates('t', ' Ali ');
    expect(mockedRequest).toHaveBeenLastCalledWith(
      '/v1/me/squad/candidates?q=Ali',
      { token: 't' },
    );
    mockedRequest.mockResolvedValueOnce({ invite });
    await service.invite('t', invite.playerId, ' Gel ');
    expect(mockedRequest).toHaveBeenLastCalledWith('/v1/me/squad/invites', {
      method: 'POST',
      token: 't',
      body: { playerId: invite.playerId, message: 'Gel' },
    });
    mockedRequest.mockResolvedValueOnce({ invite });
    await expect(
      service.respondInvite('t', invite.id, 'accept'),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('splits open and answered invitations; search needs two letters', () => {
    const lists = splitClubInvites([
      invite,
      { ...invite, id: id(22), status: 'declined', decidedAt: stamp },
    ]);
    expect(lists.open).toHaveLength(1);
    expect(lists.answered).toHaveLength(1);
    expect(isInviteSearch(' a ')).toBe(false);
    expect(isInviteSearch('al')).toBe(true);
    expect(inviteMessageError('x'.repeat(301))).toBe(copy.squad.tooLong(300));
    expect(inviteMessageError('x'.repeat(300))).toBe('');
  });

  it('lets a player accept a club invitation', async () => {
    const service = createSquadService({
      ...squadRepository,
      playerInvites: jest.fn().mockResolvedValue([invite]),
      respondInvite: jest
        .fn()
        .mockResolvedValue({ ...invite, status: 'accepted' }),
    });
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <SquadInvitesScreen token="t" service={service} onBack={jest.fn()} />,
      );
    });
    expect(texts(root)).toContain(invite.message);
    await act(async () =>
      button(root, copy.squad.accept + ': ' + invite.clubName).props.onPress(),
    );
    expect(texts(root)).toContain(copy.squad.joined(invite.clubName));
  });

  it('routes squad_invite notifications', async () => {
    expect(normalizeNotificationKind('squad_invite')).toBe('squad_invite');
    const onOpenSquadInvite = jest.fn();
    const service = {
      list: async () => ({
        items: [
          {
            id: id(40),
            kind: 'squad_invite',
            title: 'Kadro daveti',
            body: 'Kartallar seni kadrosuna davet etti.',
            resourceId: invite.id,
            createdAt: stamp,
            readAt: stamp,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
        unreadCount: 0,
      }),
    } as unknown as NotificationsService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <NotificationsScreen
          token="t"
          service={service}
          onOpenSquadInvite={onOpenSquadInvite}
        />,
      );
    });
    await act(async () =>
      button(
        root,
        'Kadro daveti, Kartallar seni kadrosuna davet etti.',
      ).props.onPress(),
    );
    expect(onOpenSquadInvite).toHaveBeenCalled();
  });

  it('shows Kulüp davetleri with the open count for players', () => {
    const noop = jest.fn();
    let root!: ReactTestRenderer;
    act(() => {
      root = create(
        <MoreScreen
          onProfile={noop}
          onSettings={noop}
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
          onSquadInvites={noop}
          squadInviteCount={2}
          isClub={false}
          isPlayer
        />,
      );
    });
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        copy.more.squadInvites,
        copy.more.squadInvitesPending(2),
      ]),
    );
  });
});

describe('organizer tournament management', () => {
  async function renderManage(service: Partial<TournamentsService>) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <OrganizerTournamentScreen
          token="t"
          id={tournament.id}
          service={
            {
              entries: jest.fn().mockResolvedValue([entry]),
              ...service,
            } as unknown as TournamentsService
          }
          onBack={jest.fn()}
        />,
      );
    });
    return root;
  }
  const tab = (root: ReactTestRenderer, label: string) =>
    root.root.findAll(
      node =>
        node.props.accessibilityRole === 'tab' &&
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )[0];

  it('generates a fixture when there are no matches', async () => {
    const generateFixture = jest.fn().mockResolvedValue(table);
    const root = await renderManage({
      organizerTable: jest.fn().mockResolvedValue({ ...table, matches: [] }),
      generateFixture,
    });
    expect(
      button(root, text.cancelInvite + ': ' + entry.clubName),
    ).toBeTruthy();
    await act(async () => tab(root, text.manageTabs.fixture).props.onPress());
    await act(async () => button(root, text.legs[2]).props.onPress());
    expect(generateFixture).toHaveBeenCalledWith('t', tournament.id, 2);
    expect(texts(root)).toContain(text.generated);
  });

  it('opens a match for editing and locks finished tournaments', async () => {
    const root = await renderManage({
      organizerTable: jest.fn().mockResolvedValue(table),
    });
    await act(async () => tab(root, text.manageTabs.fixture).props.onPress());
    expect(texts(root)).toContain(text.week(1));
    await act(async () =>
      button(
        root,
        text.matchLabel(match.homeName, match.awayName, text.notPlayed),
      ).props.onPress(),
    );
    expect(texts(root)).toContain(text.editMatch);

    const finished = await renderManage({
      organizerTable: jest.fn().mockResolvedValue({
        ...table,
        tournament: { ...tournament, status: 'finished' },
      }),
    });
    await act(async () =>
      tab(finished, text.manageTabs.fixture).props.onPress(),
    );
    expect(texts(finished)).toContain(text.playLocked);
    expect(button(finished, text.addMatch)).toBeUndefined();
  });
});
