import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  ankaraAttachmentTypes,
  ankaraPostKinds,
  competitionSlugs,
  cupSlugs,
  type AnkaraAttachment,
  type AnkaraBulletin,
  type AnkaraBulletinDay,
  type AnkaraBulletinMatch,
  type AnkaraLeagues,
  type AnkaraMatch,
  type AnkaraOption,
  type AnkaraPost,
  type AnkaraPosts,
  type AnkaraQuery,
  type AnkaraVenue,
  type AnkaraWeek,
  type Competition,
  type CompetitionCatalog,
  type CompetitionStats,
  type Fixture,
  type FootballRepository,
  type LiveScores,
  type Results,
  type StandingRow,
  type Standings,
  type TeamRef,
  type TopPlayer,
} from '../domain/models';
import { isAnkaraLink, isAnkaraPostDate } from '../domain/rules';

type Item = Record<string, unknown>;
const object = (value: unknown): value is Item =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);
const count = (value: unknown) => integer(value) && value >= 0;
const goals = (value: unknown) => value === null || count(value);
const date = (value: unknown) =>
  text(value) && Number.isFinite(Date.parse(value));
const day = (value: unknown) =>
  text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && date(value);
const season = (value: unknown) => text(value) && value.trim() !== '';
const list = <T>(value: unknown, valid: (item: unknown) => item is T) =>
  Array.isArray(value) && value.every(valid);

function team(value: unknown): value is TeamRef {
  return object(value) && text(value.name) && text(value.logoUrl);
}
const competitionOf =
  (slugs: readonly string[]) =>
  (value: unknown): value is Competition =>
    object(value) &&
    slugs.includes(value.slug as string) &&
    text(value.name) &&
    text(value.country) &&
    text(value.logoUrl);
const competition = competitionOf(competitionSlugs);
const cup = competitionOf(cupSlugs);
function standing(value: unknown): value is StandingRow {
  return (
    object(value) &&
    count(value.rank) &&
    team(value.team) &&
    [
      value.played,
      value.won,
      value.drawn,
      value.lost,
      value.goalsFor,
      value.goalsAgainst,
    ].every(count) &&
    integer(value.goalDiff) &&
    integer(value.points) &&
    text(value.form) &&
    text(value.group) &&
    text(value.description)
  );
}
function fixture(value: unknown): value is Fixture {
  return (
    object(value) &&
    integer(value.id) &&
    date(value.kickoff) &&
    ['live', 'finished', 'scheduled', 'other'].includes(
      value.status as string,
    ) &&
    text(value.statusLabel) &&
    (value.elapsed === null || count(value.elapsed)) &&
    text(value.round) &&
    team(value.home) &&
    team(value.away) &&
    goals(value.homeGoals) &&
    goals(value.awayGoals)
  );
}
function player(value: unknown): value is TopPlayer {
  return (
    object(value) &&
    count(value.rank) &&
    text(value.name) &&
    text(value.photoUrl) &&
    team(value.team) &&
    count(value.value) &&
    count(value.appearances)
  );
}
function option(value: unknown): value is AnkaraOption {
  return (
    object(value) &&
    text(value.id) &&
    text(value.name) &&
    typeof value.selected === 'boolean'
  );
}
function ankaraMatch(value: unknown): value is AnkaraMatch {
  return (
    object(value) &&
    [
      value.date,
      value.time,
      value.venue,
      value.home,
      value.away,
      value.status,
    ].every(text) &&
    goals(value.homeGoals) &&
    goals(value.awayGoals)
  );
}
function week(value: unknown): value is AnkaraWeek {
  return (
    object(value) && count(value.number) && list(value.matches, ankaraMatch)
  );
}

function bulletinMatch(value: unknown): value is AnkaraBulletinMatch {
  return (
    object(value) &&
    [value.time, value.home, value.away, value.league].every(text)
  );
}
function venue(value: unknown): value is AnkaraVenue {
  return (
    object(value) && text(value.name) && list(value.matches, bulletinMatch)
  );
}
function bulletinDay(value: unknown): value is AnkaraBulletinDay {
  return object(value) && season(value.date) && list(value.venues, venue);
}
function attachment(value: unknown): value is AnkaraAttachment {
  return (
    object(value) &&
    text(value.name) &&
    text(value.url) &&
    ankaraAttachmentTypes.includes(value.type as AnkaraAttachment['type'])
  );
}
function post(value: unknown): value is AnkaraPost {
  return (
    object(value) &&
    integer(value.id) &&
    ankaraPostKinds.includes(value.kind as AnkaraPost['kind']) &&
    text(value.title) &&
    text(value.date) &&
    isAnkaraPostDate(value.date) &&
    text(value.url) &&
    list(value.attachments, attachment)
  );
}

function check<T>(value: unknown, valid: (body: Item) => boolean): T {
  if (!object(value) || !valid(value)) throw new ApiError(copy.form.unexpected);
  return value as T;
}

// Cups arrived later (14 Oct 2026); a catalog without them is still valid.
export function parseCompetitions(value: unknown): CompetitionCatalog {
  const body = check<CompetitionCatalog>(
    value,
    item =>
      list(item.competitions, competition) &&
      (item.cups === undefined || list(item.cups, cup)) &&
      typeof item.providerConfigured === 'boolean' &&
      text(item.source) &&
      object(item.ankara) &&
      text(item.ankara.name) &&
      text(item.ankara.source),
  );
  return { ...body, cups: body.cups ?? [] };
}
export function parseStandings(value: unknown) {
  return check<Standings>(
    value,
    body =>
      season(body.season) && list(body.rows, standing) && date(body.updatedAt),
  );
}
export function parseLive(value: unknown) {
  return check<LiveScores>(
    value,
    body => day(body.date) && list(body.items, fixture) && date(body.updatedAt),
  );
}
export function parseResults(value: unknown) {
  return check<Results>(
    value,
    body =>
      season(body.season) && list(body.items, fixture) && date(body.updatedAt),
  );
}
export function parseStats(value: unknown) {
  return check<CompetitionStats>(
    value,
    body =>
      season(body.season) &&
      list(body.topScorers, player) &&
      list(body.topAssists, player) &&
      date(body.updatedAt),
  );
}
export function parseAnkara(value: unknown) {
  return check<AnkaraLeagues>(
    value,
    body =>
      list(body.seasons, option) &&
      list(body.leagues, option) &&
      list(body.groups, option) &&
      list(body.standings, standing) &&
      list(body.weeks, week) &&
      count(body.currentWeek) &&
      text(body.source) &&
      date(body.updatedAt),
  );
}

export function parseAnkaraBulletin(value: unknown) {
  return check<AnkaraBulletin>(
    value,
    body =>
      list(body.days, bulletinDay) &&
      list(body.leagues, text) &&
      text(body.source) &&
      date(body.updatedAt),
  );
}
// Links outside tffankara.org are dropped: a post whose own address is
// foreign disappears, foreign attachments are removed from the post.
export function parseAnkaraPosts(value: unknown): AnkaraPosts {
  const body = check<AnkaraPosts>(
    value,
    item =>
      list(item.items, post) &&
      count(item.page) &&
      typeof item.hasMore === 'boolean' &&
      text(item.source) &&
      date(item.updatedAt),
  );
  return {
    ...body,
    items: body.items
      .filter(item => isAnkaraLink(item.url))
      .map(item => ({
        ...item,
        attachments: item.attachments.filter(file => isAnkaraLink(file.url)),
      })),
  };
}

// The server serves 50 pages at most.
export const ankaraPostsMaxPage = 50;
export function ankaraPostsPath(page: number) {
  const safe = Number.isSafeInteger(page)
    ? Math.min(Math.max(page, 1), ankaraPostsMaxPage)
    : 1;
  return '/v1/football/ankara/posts?page=' + safe;
}

const numeric = (value: string) => /^\d{1,12}$/.test(value);
export function ankaraPath(query: AnkaraQuery) {
  const params = (['season', 'league', 'group'] as const)
    .filter(key => numeric(query[key]))
    .map(key => key + '=' + encodeURIComponent(query[key]));
  return '/v1/football/ankara' + (params.length ? '?' + params.join('&') : '');
}

const base = '/v1/football/competitions';
const competitionPath = (slug: string, part: string) =>
  base + '/' + encodeURIComponent(slug) + '/' + part;

export const footballRepository: FootballRepository = {
  async competitions(token) {
    return parseCompetitions(await request<unknown>(base, { token }));
  },
  async standings(token, slug) {
    return parseStandings(
      await request<unknown>(competitionPath(slug, 'standings'), { token }),
    );
  },
  async live(token, slug) {
    return parseLive(
      await request<unknown>(competitionPath(slug, 'live'), { token }),
    );
  },
  async results(token, slug) {
    return parseResults(
      await request<unknown>(competitionPath(slug, 'results'), { token }),
    );
  },
  async stats(token, slug) {
    return parseStats(
      await request<unknown>(competitionPath(slug, 'stats'), { token }),
    );
  },
  async ankara(token, query) {
    return parseAnkara(await request<unknown>(ankaraPath(query), { token }));
  },
  async ankaraBulletin(token) {
    return parseAnkaraBulletin(
      await request<unknown>('/v1/football/ankara/bulletin', { token }),
    );
  },
  async ankaraPosts(token, page) {
    return parseAnkaraPosts(
      await request<unknown>(ankaraPostsPath(page), { token }),
    );
  },
};
