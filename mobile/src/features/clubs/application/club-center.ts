import { copy } from '../../../shared/lib/copy';
import type {
  ClubCenter,
  ClubCenterLeague,
  ClubMatchResult,
  ClubProfileInput,
  ClubRecentFixture,
  ClubStanding,
  ClubUpcomingFixture,
} from '../domain/models';

// Profile completeness lives on the profile screen (20 Oct 2026) and follows
// the form as the club types; the server counts the same seven fields.
export function profileCompleteness(
  values: ClubProfileInput,
  labels: Record<keyof ClubProfileInput, string>,
) {
  const fields = Object.keys(labels) as (keyof ClubProfileInput)[];
  const missing = fields.filter(field => !values[field].trim());
  const percent = Math.floor(
    ((fields.length - missing.length) * 100) / fields.length,
  );
  return {
    percent,
    complete: missing.length === 0,
    missing: missing.map(field => labels[field]),
  };
}

// The home card follows the club's TFF group when linked (the server puts it
// first), otherwise its newest Fut Career league.
export function primaryLeague(center: ClubCenter): ClubCenterLeague | null {
  return center.leagues[0] ?? null;
}

export function nextFixture(
  league: ClubCenterLeague,
): ClubUpcomingFixture | null {
  return league.upcoming[0] ?? null;
}

// Recent matches come oldest first, so the last one is the latest result.
export function lastFixture(
  league: ClubCenterLeague,
): ClubRecentFixture | null {
  return league.recent[league.recent.length - 1] ?? null;
}

export function resultLetter(result: ClubMatchResult) {
  return copy.clubHome.resultLabel[result];
}

// A few rows around the club's own row, so a long table still fits the card.
export function standingsWindow(
  rows: ClubStanding[],
  size = 5,
): ClubStanding[] {
  if (rows.length <= size) return rows;
  const own = Math.max(
    0,
    rows.findIndex(row => row.own),
  );
  const start = Math.min(
    Math.max(0, own - Math.floor(size / 2)),
    rows.length - size,
  );
  return rows.slice(start, start + size);
}

export type Countdown =
  | { kind: 'unknown' }
  | { kind: 'started' }
  | { kind: 'today' }
  | { kind: 'days'; days: number }
  | { kind: 'clock'; days: number; hours: number; minutes: number };

// Fixtures are in Türkiye time (UTC+3, no daylight saving), whatever the
// phone's own zone is.
const turkeyOffset = 3 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const turkeyDay = (ms: number) => Math.floor((ms + turkeyOffset) / dayMs);

export function countdown(
  fixture: ClubUpcomingFixture,
  now: number,
): Countdown {
  if (!fixture.kickoffAt) return { kind: 'unknown' };
  const at = Date.parse(fixture.kickoffAt);
  if (fixture.dateOnly) {
    const days = turkeyDay(at) - turkeyDay(now);
    if (days < 0) return { kind: 'started' };
    return days === 0 ? { kind: 'today' } : { kind: 'days', days };
  }
  if (at <= now) return { kind: 'started' };
  const minutes = Math.floor((at - now) / 60000);
  return {
    kind: 'clock',
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

// "24 Ekim Cumartesi · 13:00", or the day alone when the time is not set.
export function kickoffLabel(
  fixture: Pick<ClubUpcomingFixture, 'kickoffAt' | 'dateOnly'>,
) {
  const text = copy.clubHome.match;
  if (!fixture.kickoffAt) return text.dateUnknown;
  const local = new Date(Date.parse(fixture.kickoffAt) + turkeyOffset);
  const day =
    local.getUTCDate() +
    ' ' +
    text.months[local.getUTCMonth()] +
    ' ' +
    text.weekdays[local.getUTCDay()];
  return fixture.dateOnly
    ? day + ' · ' + text.timeUnknown
    : day + ' · ' + pad(local.getUTCHours()) + ':' + pad(local.getUTCMinutes());
}

// "24 Eki" for a fixture row; empty without a date.
export function shortDay(kickoffAt: string | null) {
  if (!kickoffAt) return '';
  const local = new Date(Date.parse(kickoffAt) + turkeyOffset);
  return (
    local.getUTCDate() + ' ' + copy.clubMatches.monthsShort[local.getUTCMonth()]
  );
}

// "10:00", or empty when only the day (or nothing) is known.
export function clockLabel(
  fixture: Pick<ClubUpcomingFixture, 'kickoffAt' | 'dateOnly'>,
) {
  if (!fixture.kickoffAt || fixture.dateOnly) return '';
  const local = new Date(Date.parse(fixture.kickoffAt) + turkeyOffset);
  return pad(local.getUTCHours()) + ':' + pad(local.getUTCMinutes());
}

// The week the group page opens on: the league's current week, else the last.
export function startWeek(weeks: { number: number }[], current: number) {
  const index = weeks.findIndex(week => week.number === current);
  return index >= 0 ? index : Math.max(0, weeks.length - 1);
}

// Up to two letters for a crest placeholder: "Mamak Belediyesi Spor" → "MB".
export function monogram(name: string) {
  return name
    .split(/\s+/)
    .filter(word => word && !/^[\d.\-(]/.test(word))
    .slice(0, 2)
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
}
