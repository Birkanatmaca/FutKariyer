export const competitionSlugs = [
  'super-lig',
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
] as const;
// UEFA club competitions (14 Oct 2026); shown as their own group.
export const cupSlugs = [
  'champions-league',
  'europa-league',
  'conference-league',
] as const;
export type LeagueSlug = (typeof competitionSlugs)[number];
export type CupSlug = (typeof cupSlugs)[number];
export type CompetitionSlug = LeagueSlug | CupSlug;

export type Competition = {
  slug: CompetitionSlug;
  name: string;
  country: string;
  logoUrl: string;
};
export type CompetitionCatalog = {
  // The six domestic leagues.
  competitions: Competition[];
  // Empty when an older server sends no cups.
  cups: Competition[];
  // Always true now; ESPN needs no key. Kept for contract compatibility.
  providerConfigured: boolean;
  source: string;
  ankara: { name: string; source: string };
};

export type TeamRef = { name: string; logoUrl: string };
export type StandingRow = {
  rank: number;
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: string;
  group: string;
  description: string;
};
// Season is a display label such as "2026-27".
export type Standings = {
  season: string;
  rows: StandingRow[];
  updatedAt: string;
};

export type FixtureStatus = 'live' | 'finished' | 'scheduled' | 'other';
// Shared by the live and results endpoints. Live matches carry the elapsed
// minute; scheduled matches have null goals.
export type Fixture = {
  id: number;
  kickoff: string;
  status: FixtureStatus;
  statusLabel: string;
  elapsed: number | null;
  round: string;
  home: TeamRef;
  away: TeamRef;
  homeGoals: number | null;
  awayGoals: number | null;
};
// Today's matches (Türkiye date) sorted by kickoff.
export type LiveScores = {
  date: string;
  items: Fixture[];
  updatedAt: string;
};
// Last played matches of the season, newest first (at most 15).
export type Results = {
  season: string;
  items: Fixture[];
  updatedAt: string;
};

export type TopPlayer = {
  rank: number;
  name: string;
  photoUrl: string;
  team: TeamRef;
  value: number;
  appearances: number;
};
export type CompetitionStats = {
  season: string;
  topScorers: TopPlayer[];
  topAssists: TopPlayer[];
  updatedAt: string;
};

export type AnkaraOption = { id: string; name: string; selected: boolean };
export type AnkaraMatch = {
  date: string;
  time: string;
  venue: string;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
};
export type AnkaraWeek = { number: number; matches: AnkaraMatch[] };
export type AnkaraLeagues = {
  seasons: AnkaraOption[];
  leagues: AnkaraOption[];
  groups: AnkaraOption[];
  standings: StandingRow[];
  weeks: AnkaraWeek[];
  currentWeek: number;
  source: string;
  updatedAt: string;
};
export type AnkaraQuery = { season: string; league: string; group: string };
export type AnkaraPicker = 'season' | 'league' | 'group';

// This week's approved bulletin: every league's matches by day and venue.
export type AnkaraBulletinMatch = {
  time: string;
  home: string;
  away: string;
  league: string;
};
export type AnkaraVenue = { name: string; matches: AnkaraBulletinMatch[] };
// date is the site's own label, e.g. "17 Ekim 2026 Cumartesi".
export type AnkaraBulletinDay = { date: string; venues: AnkaraVenue[] };
export type AnkaraBulletin = {
  days: AnkaraBulletinDay[];
  leagues: string[];
  source: string;
  updatedAt: string;
};

export const ankaraPostKinds = ['discipline', 'bulletin', 'news'] as const;
export type AnkaraPostKind = (typeof ankaraPostKinds)[number];
export const ankaraAttachmentTypes = ['pdf', 'excel', 'word', 'image'] as const;
export type AnkaraAttachmentType = (typeof ankaraAttachmentTypes)[number];
// Only https links on tffankara.org survive validation.
export type AnkaraAttachment = {
  name: string;
  url: string;
  type: AnkaraAttachmentType;
};
// date is Türkiye local time without a zone, e.g. "2026-10-08T15:58:30".
export type AnkaraPost = {
  id: number;
  kind: AnkaraPostKind;
  title: string;
  date: string;
  url: string;
  attachments: AnkaraAttachment[];
};
export type AnkaraPosts = {
  items: AnkaraPost[];
  page: number;
  hasMore: boolean;
  source: string;
  updatedAt: string;
};

export interface FootballRepository {
  competitions(token: string): Promise<CompetitionCatalog>;
  standings(token: string, slug: CompetitionSlug): Promise<Standings>;
  live(token: string, slug: CompetitionSlug): Promise<LiveScores>;
  results(token: string, slug: CompetitionSlug): Promise<Results>;
  stats(token: string, slug: CompetitionSlug): Promise<CompetitionStats>;
  ankara(token: string, query: AnkaraQuery): Promise<AnkaraLeagues>;
  ankaraBulletin(token: string): Promise<AnkaraBulletin>;
  ankaraPosts(token: string, page: number): Promise<AnkaraPosts>;
}
