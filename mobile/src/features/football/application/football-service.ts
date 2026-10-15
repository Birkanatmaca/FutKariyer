import type {
  AnkaraQuery,
  CompetitionSlug,
  FootballRepository,
} from '../domain/models';

export function createFootballService(repository: FootballRepository) {
  return {
    competitions: (token: string) => repository.competitions(token),
    standings: (token: string, slug: CompetitionSlug) =>
      repository.standings(token, slug),
    live: (token: string, slug: CompetitionSlug) =>
      repository.live(token, slug),
    results: (token: string, slug: CompetitionSlug) =>
      repository.results(token, slug),
    stats: (token: string, slug: CompetitionSlug) =>
      repository.stats(token, slug),
    ankara: (token: string, query: AnkaraQuery) =>
      repository.ankara(token, query),
    ankaraBulletin: (token: string) => repository.ankaraBulletin(token),
    ankaraPosts: (token: string, page: number) =>
      repository.ankaraPosts(token, page),
  };
}
export type FootballService = ReturnType<typeof createFootballService>;
