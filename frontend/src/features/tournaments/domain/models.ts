export type TournamentStatus = 'open' | 'closed' | 'finished' | 'cancelled';
export type TournamentFormat = 'halisaha' | 'seven_a_side' | 'eleven_a_side';
export type TeamType = 'halisaha' | 'amateur' | 'professional';
export type EntryStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'invited'
  | 'declined';

// Tournament dates are calendar days (YYYY-MM-DD).
export type Tournament = {
  id: string;
  organizerId: string;
  organizerName: string;
  name: string;
  format: TournamentFormat;
  eligibleTypes: TeamType[];
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
export type Entry = {
  id: string;
  tournamentId: string;
  clubId: string;
  clubName: string;
  clubDistrict: string;
  clubFootballType: string;
  message: string;
  status: EntryStatus;
  players: EntryPlayer[];
  createdAt: string;
  decidedAt: string | null;
};
export type Team = {
  entryId: string;
  clubId: string;
  name: string;
  district: string;
  players: number;
};
export type Match = {
  id: string;
  round: number;
  homeEntryId: string;
  awayEntryId: string;
  homeName: string;
  awayName: string;
  kickoffAt: string | null;
  venue: string;
  homeGoals: number | null;
  awayGoals: number | null;
};
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
  teams: Team[];
  matches: Match[];
  standings: Standing[];
};
export type Candidate = {
  id: string;
  name: string;
  district: string;
  footballType: string;
};
export type TournamentForm = {
  name: string;
  format: TournamentFormat;
  eligibleTypes: TeamType[];
  district: string;
  venue: string;
  description: string;
  startsOn: string;
  endsOn: string;
  applicationDeadline: string;
  teamCapacity: number;
};
export type MatchForm = {
  round: number;
  homeEntryId: string;
  awayEntryId: string;
  kickoffAt: string | null;
  venue: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

export interface TournamentRepository {
  mine(): Promise<Tournament[]>;
  create(
    form: TournamentForm,
  ): Promise<{ tournament: Tournament; notified: number }>;
  setStatus(id: string, status: TournamentStatus): Promise<Tournament>;
  table(id: string): Promise<TournamentTable>;
  entries(id: string): Promise<Entry[]>;
  decide(id: string, entryId: string, accept: boolean): Promise<void>;
  generateFixture(id: string, legs: 1 | 2): Promise<void>;
  clearFixture(id: string): Promise<void>;
  saveMatch(id: string, form: MatchForm, matchId?: string): Promise<void>;
  removeMatch(id: string, matchId: string): Promise<void>;
  candidates(id: string, search: string): Promise<Candidate[]>;
  invite(id: string, clubId: string, message: string): Promise<void>;
  cancelInvite(id: string, entryId: string): Promise<void>;
}
