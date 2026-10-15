import type {
  AnkaraBulletinDay,
  AnkaraLeagues,
  AnkaraOption,
  AnkaraPost,
  AnkaraPostKind,
  AnkaraPicker,
  AnkaraQuery,
  Fixture,
  StandingRow,
} from './models';
import { cupSlugs } from './models';

// The Screen container is at most 600 wide with 24 px side padding.
export const gridColumns = 3;
export function competitionCardWidth(
  windowWidth: number,
  gap: number,
  padding: number,
  maxContentWidth = 600,
) {
  const content = Math.min(windowWidth, maxContentWidth) - padding * 2;
  return Math.max(
    0,
    Math.floor((content - gap * (gridColumns - 1)) / gridColumns),
  );
}

export function isCup(slug: string) {
  return (cupSlugs as readonly string[]).includes(slug);
}

export const emptyAnkaraQuery: AnkaraQuery = {
  season: '',
  league: '',
  group: '',
};

const selectedId = (options: AnkaraOption[]) =>
  options.find(option => option.selected)?.id ?? '';

// Leagues depend on the season and groups on the league, so a change resets
// every picker below it and the server answers with fresh options.
export function nextAnkaraQuery(
  current: Pick<AnkaraLeagues, 'seasons' | 'leagues' | 'groups'> | null,
  picker: AnkaraPicker,
  id: string,
): AnkaraQuery {
  if (picker === 'season') return { season: id, league: '', group: '' };
  const season = current ? selectedId(current.seasons) : '';
  if (picker === 'league') return { season, league: id, group: '' };
  return {
    season,
    league: current ? selectedId(current.leagues) : '',
    group: id,
  };
}

export type AnkaraSelection = {
  season: AnkaraOption | null;
  league: AnkaraOption | null;
  group: AnkaraOption | null;
};
const byId = (options: AnkaraOption[], id: string) =>
  options.find(option => option.id === id) ?? null;
const chosen = (options: AnkaraOption[], id: string) =>
  id ? byId(options, id) : options.find(option => option.selected) ?? null;
// What the three steps show. While a new choice loads, the steps below it
// are already cleared (the shown options still belong to the old choice);
// afterwards the server's own selection is shown.
export function ankaraSelection(
  data: Pick<AnkaraLeagues, 'seasons' | 'leagues' | 'groups'>,
  query: AnkaraQuery,
  loading: boolean,
): AnkaraSelection {
  const season = chosen(data.seasons, query.season);
  const leagueCleared = loading && query.season !== '' && query.league === '';
  const league =
    !season || leagueCleared ? null : chosen(data.leagues, query.league);
  const groupCleared =
    loading &&
    (query.season !== '' || query.league !== '') &&
    query.group === '';
  const group =
    !league || groupCleared ? null : chosen(data.groups, query.group);
  return { season, league, group };
}
// The group step is hidden when the league has no real groups ("Grup yok").
export function hasAnkaraGroups(groups: AnkaraOption[]) {
  return groups.some(group => group.id !== '0');
}

export type FormResult = 'W' | 'D' | 'L';
export function formResults(form: string): FormResult[] {
  return Array.from(form.toUpperCase()).filter(
    (letter): letter is FormResult =>
      letter === 'W' || letter === 'D' || letter === 'L',
  );
}

export function groupStandings(rows: StandingRow[]) {
  const groups: { name: string; rows: StandingRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    const existing =
      last && last.name === row.group
        ? last
        : groups.find(group => group.name === row.group);
    if (existing) existing.rows.push(row);
    else groups.push({ name: row.group, rows: [row] });
  }
  return groups.length > 1 ? groups : [{ name: '', rows }];
}

export type StandingNote =
  | 'championsLeague'
  | 'championsLeagueQualifying'
  | 'europaLeague'
  | 'europaLeagueQualifying'
  | 'conferenceLeague'
  | 'conferenceLeagueQualifying'
  | 'relegation'
  | 'relegationPlayoff'
  | 'roundOf16'
  | 'knockoutPlayoff'
  | 'eliminated';
const cups = [
  ['champions league', 'championsLeague', 'championsLeagueQualifying'],
  ['europa league', 'europaLeague', 'europaLeagueQualifying'],
  ['conference league', 'conferenceLeague', 'conferenceLeagueQualifying'],
] as const;
// Maps the provider's English standings notes ("Champions League",
// "Relegation", "Qualifies for round of 16", ...) to a known note; unknown
// notes return null.
export function standingNote(description: string): StandingNote | null {
  const note = description.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/relegat/.test(note))
    return /play-?offs?/.test(note) ? 'relegationPlayoff' : 'relegation';
  // UEFA cup league phase: "Knockout phase playoffs - seeded", "Eliminated".
  if (/round of 16/.test(note)) return 'roundOf16';
  if (/knockout/.test(note) && /play-?offs?/.test(note))
    return 'knockoutPlayoff';
  if (/^eliminated\b/.test(note)) return 'eliminated';
  const cup = cups.find(([name]) => note.includes(name));
  if (!cup) return null;
  return /qualif/.test(note) ? cup[2] : cup[1];
}

export function standingDescriptions(rows: StandingRow[]) {
  const seen: string[] = [];
  for (const row of rows)
    if (row.description && !seen.includes(row.description))
      seen.push(row.description);
  return seen;
}

export function defaultWeek(
  data: Pick<AnkaraLeagues, 'weeks' | 'currentWeek'>,
) {
  if (data.weeks.some(week => week.number === data.currentWeek))
    return data.currentWeek;
  return data.weeks[0]?.number ?? 0;
}

const pad = (value: number) => String(value).padStart(2, '0');
// Local calendar day of a kickoff, so late matches stay on the viewer's date.
export function matchDayKey(kickoff: string) {
  const at = new Date(kickoff);
  return (
    at.getFullYear() + '-' + pad(at.getMonth() + 1) + '-' + pad(at.getDate())
  );
}

// Keeps the server order (newest first) and groups consecutive days.
export function groupResultsByDay(items: Fixture[]) {
  const days: { key: string; kickoff: string; items: Fixture[] }[] = [];
  for (const item of items) {
    const key = matchDayKey(item.kickoff);
    const existing = days.find(day => day.key === key);
    if (existing) existing.items.push(item);
    else days.push({ key, kickoff: item.kickoff, items: [item] });
  }
  return days;
}

// Lower-cases with Turkish rules and folds the Turkish letters, so
// "istanbul", "ISTANBUL" and "İSTANBUL" all compare equal.
export function foldTurkish(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0307/g, '')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();
}

export const ankaraLeagueGroups = [
  'amateur',
  'youth',
  'girls',
  'playoff',
  'other',
] as const;
export type AnkaraLeagueGroup = (typeof ankaraLeagueGroups)[number];
// Derives a visual group from the site's league name. Play-offs and girls'
// leagues win over the age and amateur words they also contain.
export function ankaraLeagueGroup(name: string): AnkaraLeagueGroup {
  const value = foldTurkish(name);
  if (/play[\s-]?off|baraj/.test(value)) return 'playoff';
  if (/\bkiz|kadin/.test(value)) return 'girls';
  if (/\bu\s?-?\s?\d{1,2}\b|altyapi|minik|yildiz|genc/.test(value))
    return 'youth';
  if (/amator/.test(value)) return 'amateur';
  return 'other';
}
export function groupAnkaraLeagues<T extends { name: string }>(leagues: T[]) {
  return ankaraLeagueGroups
    .map(group => ({
      group,
      leagues: leagues.filter(item => ankaraLeagueGroup(item.name) === group),
    }))
    .filter(entry => entry.leagues.length > 0);
}

const startYear = (name: string) => {
  const match = /(\d{4})/.exec(name);
  return match ? Number(match[1]) : -1;
};
// Newest season first; names without a year keep their server order last.
export function seasonsNewestFirst(seasons: AnkaraOption[]) {
  return seasons
    .map((season, index) => ({ season, index }))
    .sort(
      (a, b) =>
        startYear(b.season.name) - startYear(a.season.name) ||
        a.index - b.index,
    )
    .map(entry => entry.season);
}
// A new season opens with few leagues; below this the previous season is
// offered as a one-tap jump.
export const fewAnkaraLeagues = 5;
export function previousAnkaraSeason(
  data: Pick<AnkaraLeagues, 'seasons' | 'leagues'>,
): AnkaraOption | null {
  if (data.leagues.length >= fewAnkaraLeagues) return null;
  const ordered = seasonsNewestFirst(data.seasons);
  const at = ordered.findIndex(season => season.selected);
  return at >= 0 ? ordered[at + 1] ?? null : null;
}

const monthNames = [
  'ocak',
  'subat',
  'mart',
  'nisan',
  'mayis',
  'haziran',
  'temmuz',
  'agustos',
  'eylul',
  'ekim',
  'kasim',
  'aralik',
];
// "17 Ekim 2026 Cumartesi" -> { day: 17, weekday: "cumartesi", iso: "2026-10-17" }.
export function parseBulletinDate(date: string) {
  const parts = foldTurkish(date).split(' ');
  const day = Number(parts[0]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const month = monthNames.indexOf(parts[1] ?? '');
  const year = Number(parts[2]);
  const last = parts[parts.length - 1] ?? '';
  const weekday =
    /^[a-z]+$/.test(last) && !monthNames.includes(last) ? last : '';
  return {
    day,
    weekday: weekday ?? '',
    iso:
      month >= 0 && Number.isInteger(year)
        ? year + '-' + pad(month + 1) + '-' + pad(day)
        : '',
  };
}
// Short tab label such as "Cmt 17"; shortNames maps folded weekday names
// ("cumartesi") to their short form. Unknown dates keep the site's label.
export function bulletinDayLabel(
  date: string,
  shortNames: Record<string, string>,
) {
  const parsed = parseBulletinDate(date);
  if (!parsed) return date;
  const short = shortNames[parsed.weekday];
  return short ? short + ' ' + parsed.day : String(parsed.day);
}

// Türkiye is UTC+3 all year.
const turkeyOffsetMs = 3 * 60 * 60 * 1000;
export function turkeyToday(now: Date) {
  return new Date(now.getTime() + turkeyOffsetMs).toISOString().slice(0, 10);
}
// Today's tab when the bulletin covers it, else the next day, else the first.
export function defaultBulletinDay(days: AnkaraBulletinDay[], now: Date) {
  const today = turkeyToday(now);
  const dates = days.map(day => parseBulletinDate(day.date)?.iso ?? '');
  const exact = dates.indexOf(today);
  if (exact >= 0) return exact;
  const next = dates.findIndex(iso => iso !== '' && iso > today);
  return next >= 0 ? next : 0;
}

export type BulletinFilter = { league: string; query: string };
// Keeps venues that still have matches after the league and team filters.
export function filterBulletinDay(
  day: AnkaraBulletinDay | undefined,
  { league, query }: BulletinFilter,
) {
  if (!day) return [];
  const needle = foldTurkish(query);
  return day.venues
    .map(venue => ({
      ...venue,
      matches: venue.matches.filter(
        match =>
          (!league || match.league === league) &&
          (!needle ||
            foldTurkish(match.home).includes(needle) ||
            foldTurkish(match.away).includes(needle)),
      ),
    }))
    .filter(venue => venue.matches.length > 0);
}
export function countMatches(venues: { matches: unknown[] }[]) {
  return venues.reduce((sum, venue) => sum + venue.matches.length, 0);
}

// Only the federation's own site is opened from the app; the posts were
// found to carry injected spam links.
const ankaraUrl =
  /^https:\/\/(?:www\.)?tffankara\.org(?::443)?(?:[/?#][^\s\\]*)?$/i;
export function isAnkaraLink(url: string) {
  return ankaraUrl.test(url);
}

export type AnkaraPostFilter = 'all' | AnkaraPostKind;
export function filterAnkaraPosts(posts: AnkaraPost[], kind: AnkaraPostFilter) {
  return kind === 'all' ? posts : posts.filter(post => post.kind === kind);
}

const localDate = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2})?$/;
export function isAnkaraPostDate(value: string) {
  const match = localDate.exec(value);
  return (
    !!match &&
    Number.isFinite(Date.parse(match[1] + '-' + match[2] + '-' + match[3]))
  );
}
// Whole calendar days between a post (Türkiye local time) and now; null for
// an unreadable date. Future dates count as today.
export function postAgeDays(date: string, now: Date) {
  if (!isAnkaraPostDate(date)) return null;
  const posted = Date.parse(date.slice(0, 10));
  const today = Date.parse(turkeyToday(now));
  return Math.max(0, Math.round((today - posted) / 86_400_000));
}
