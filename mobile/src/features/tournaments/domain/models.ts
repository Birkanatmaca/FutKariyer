import type {
  FootballType,
  PlayerFootballType,
} from '../../../shared/domain/football';

export type TournamentFormat = 'halisaha' | 'seven_a_side' | 'eleven_a_side';
export type TournamentStatus = 'open' | 'closed' | 'finished' | 'cancelled';
export type EntryStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type EntryDecision = 'accept' | 'reject';

export const tournamentFormats: TournamentFormat[] = [
  'halisaha',
  'seven_a_side',
  'eleven_a_side',
];

// Club account types that a tournament can accept.
export const tournamentTeamTypes: PlayerFootballType[] = [
  'amateur',
  'professional',
  'halisaha',
];

export const tournamentStatuses: TournamentStatus[] = [
  'open',
  'closed',
  'finished',
  'cancelled',
];

export const entryStatuses: EntryStatus[] = [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
];

// Limits mirror the server rules for tournaments and entries.
export const tournamentLimits = {
  name: { min: 2, max: 120 },
  district: { min: 0, max: 80 },
  venue: { min: 0, max: 120 },
  description: { min: 0, max: 2000 },
  capacity: { min: 2, max: 128 },
  message: 300,
  roster: 30,
} as const;

export const tournamentPageSize = 20;

// Status changes an organizer may make; finished and cancelled are final.
export const statusTransitions: Record<TournamentStatus, TournamentStatus[]> = {
  open: ['closed', 'cancelled'],
  closed: ['open', 'finished', 'cancelled'],
  finished: [],
  cancelled: [],
};

// Dates are calendar days in YYYY-MM-DD form; there is no time of day.
export type Tournament = {
  id: string;
  organizerId: string;
  organizerName: string;
  name: string;
  format: TournamentFormat;
  eligibleTypes: PlayerFootballType[];
  district: string;
  venue: string;
  description: string;
  startsOn: string;
  endsOn: string;
  applicationDeadline: string;
  teamCapacity: number;
  status: TournamentStatus;
  acceptedTeams: number;
  pendingEntries: number;
  createdAt: string;
};

export type EntryPlayer = { id: string; name: string; position: string };

export type TournamentEntry = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: TournamentStatus;
  clubId: string;
  clubName: string;
  clubDistrict: string;
  clubFootballType: FootballType;
  message: string;
  status: EntryStatus;
  players: EntryPlayer[];
  createdAt: string;
  decidedAt: string | null;
};

export type TournamentPage = {
  items: Tournament[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type TournamentInput = {
  name: string;
  format: TournamentFormat;
  eligibleTypes: PlayerFootballType[];
  district: string;
  venue: string;
  description: string;
  startsOn: string;
  endsOn: string;
  applicationDeadline: string;
  teamCapacity: number;
};

export type CreatedTournament = {
  tournament: Tournament;
  notifiedClubs: number;
};

export type EntryInput = { message: string; playerIds: string[] };

// A squad player the club can put on a tournament roster.
export type RosterCandidate = { id: string; name: string; position: string };

// What a club needs to enter: its own team type and its squad. The app shell
// provides this from the club and squad features.
export type ClubEntrySource = {
  footballType(token: string): Promise<FootballType>;
  squad(token: string): Promise<RosterCandidate[]>;
};

// The club's team type must be one of the tournament's eligible types.
export function isEligibleClub(
  tournament: Pick<Tournament, 'eligibleTypes'>,
  clubType: FootballType,
) {
  return (
    clubType !== 'unknown' &&
    (tournament.eligibleTypes as FootballType[]).includes(clubType)
  );
}

// A club can enter an open tournament it is eligible for unless it already
// has an active entry or was rejected; a withdrawn club may enter again.
export function canEnterTournament(
  tournament: Pick<Tournament, 'eligibleTypes' | 'status'>,
  clubType: FootballType,
  entry: Pick<TournamentEntry, 'status'> | null,
) {
  return (
    tournament.status === 'open' &&
    isEligibleClub(tournament, clubType) &&
    (!entry || entry.status === 'withdrawn')
  );
}

export interface TournamentsRepository {
  open(token: string, page: number): Promise<TournamentPage>;
  detail(token: string, id: string): Promise<Tournament>;
  enter(token: string, id: string, input: EntryInput): Promise<TournamentEntry>;
  myEntries(token: string): Promise<TournamentEntry[]>;
  withdraw(token: string, entryId: string): Promise<TournamentEntry>;
  mine(token: string): Promise<Tournament[]>;
  create(token: string, input: TournamentInput): Promise<CreatedTournament>;
  setStatus(
    token: string,
    id: string,
    status: TournamentStatus,
  ): Promise<Tournament>;
  entries(token: string, id: string): Promise<TournamentEntry[]>;
  decide(
    token: string,
    id: string,
    entryId: string,
    decision: EntryDecision,
  ): Promise<TournamentEntry>;
}
