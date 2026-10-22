import type {
  FootballType,
  PlayerFootballType,
} from '../../../shared/domain/football';

export type TournamentFormat = 'halisaha' | 'seven_a_side' | 'eleven_a_side';
export type TournamentStatus = 'open' | 'closed' | 'finished' | 'cancelled';
// Organizer invitations (22 Oct 2026) add invited and declined.
export type EntryStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'invited'
  | 'declined';
export type EntryDecision = 'accept' | 'reject';
export type InviteDecision = 'accept' | 'decline';

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
  'invited',
  'declined',
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
  // Fixture and results (22 Oct 2026).
  round: { min: 1, max: 300 },
  matchVenue: 120,
  goals: { min: 0, max: 99 },
  search: { min: 2, max: 80 },
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
// has an active entry, an open invitation or was rejected; a club that
// withdrew or declined an invitation may enter again.
export function canEnterTournament(
  tournament: Pick<Tournament, 'eligibleTypes' | 'status'>,
  clubType: FootballType,
  entry: Pick<TournamentEntry, 'status'> | null,
) {
  return (
    tournament.status === 'open' &&
    isEligibleClub(tournament, clubType) &&
    (!entry || isEndedEntry(entry))
  );
}

// Withdrawn and declined entries no longer hold a place in the tournament.
export const isEndedEntry = (entry: Pick<TournamentEntry, 'status'>) =>
  entry.status === 'withdrawn' || entry.status === 'declined';

// An accepted team as it appears in the fixture and standings.
export type TournamentTeam = {
  entryId: string;
  clubId: string;
  name: string;
  district: string;
  players: number;
};

// A fixture slot; goals are both set once the match is played.
export type TournamentMatch = {
  id: string;
  round: number;
  homeEntryId: string;
  awayEntryId: string;
  homeName: string;
  awayName: string;
  homeClubId: string;
  awayClubId: string;
  kickoffAt: string | null;
  venue: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

// Standings use 3/1/0 points and are ordered by the server.
export type Standing = {
  position: number;
  entryId: string;
  clubId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type TournamentTable = {
  tournament: Tournament;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  standings: Standing[];
};

export type MatchInput = {
  round: number;
  homeEntryId: string;
  awayEntryId: string;
  kickoffAt: string | null;
  venue: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

export type FixtureLegs = 1 | 2;

// A club the organizer can invite: right team type, no active entry.
export type InviteCandidate = {
  id: string;
  name: string;
  district: string;
  footballType: FootballType;
};

export type MatchRound = { round: number; matches: TournamentMatch[] };

export const isPlayed = (match: Pick<TournamentMatch, 'homeGoals'>) =>
  match.homeGoals !== null;

// Matches grouped by week, in the server's order.
export function matchRounds(matches: TournamentMatch[]): MatchRound[] {
  const rounds: MatchRound[] = [];
  for (const match of matches) {
    const existing = rounds.find(item => item.round === match.round);
    if (existing) existing.matches.push(match);
    else rounds.push({ round: match.round, matches: [match] });
  }
  return rounds.sort((a, b) => a.round - b.round);
}

// The fixture, results and invitations change only while the tournament runs.
export const canManagePlay = (tournament: Pick<Tournament, 'status'>) =>
  tournament.status === 'open' || tournament.status === 'closed';

// Halı saha leagues read as a season: taking entries, running or done.
export type LeaguePhase = 'open' | 'running' | 'finished' | 'cancelled';
export function leaguePhase(status: TournamentStatus): LeaguePhase {
  return status === 'closed' ? 'running' : status;
}

// Which list a tournament feed loads: open tournaments of every format, or
// all halı saha tournaments that are open, running or finished.
export type TournamentFeedView = 'open' | 'halisaha';

export interface TournamentsRepository {
  open(token: string, page: number): Promise<TournamentPage>;
  halisaha(token: string, page: number): Promise<TournamentPage>;
  table(token: string, id: string): Promise<TournamentTable>;
  respond(
    token: string,
    entryId: string,
    decision: InviteDecision,
    playerIds: string[],
  ): Promise<TournamentEntry>;
  organizerTable(token: string, id: string): Promise<TournamentTable>;
  generateFixture(
    token: string,
    id: string,
    legs: FixtureLegs,
  ): Promise<TournamentTable>;
  clearFixture(token: string, id: string): Promise<TournamentTable>;
  createMatch(
    token: string,
    id: string,
    input: MatchInput,
  ): Promise<TournamentMatch>;
  updateMatch(
    token: string,
    id: string,
    matchId: string,
    input: MatchInput,
  ): Promise<TournamentMatch>;
  deleteMatch(token: string, id: string, matchId: string): Promise<void>;
  candidates(
    token: string,
    id: string,
    query: string,
  ): Promise<InviteCandidate[]>;
  invite(
    token: string,
    id: string,
    clubId: string,
    message: string,
  ): Promise<TournamentEntry>;
  cancelInvite(
    token: string,
    id: string,
    entryId: string,
  ): Promise<TournamentEntry>;
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
