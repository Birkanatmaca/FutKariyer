import type {
  ClubArticleInput,
  ClubProfileInput,
  ClubRepository,
} from '../domain/models';

const trimAll = <T extends Record<string, string>>(input: T): T =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value.trim()]),
  ) as T;

export function createClubService(repository: ClubRepository) {
  return {
    profile: (token: string) => repository.profile(token),
    updateProfile: (token: string, input: ClubProfileInput) =>
      repository.updateProfile(token, trimAll(input)),
    news: (token: string) => repository.news(token),
    createNews: (token: string, input: ClubArticleInput) =>
      repository.createNews(token, trimAll(input)),
    center: (token: string) => repository.center(token),
  };
}

export type ClubService = ReturnType<typeof createClubService>;
