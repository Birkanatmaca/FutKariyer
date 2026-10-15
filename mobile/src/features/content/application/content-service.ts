import type { ContentRepository } from '../domain/models';
export function createContentService(repo: ContentRepository) {
  return {
    home: (token: string) => repo.home(token),
    news: (token: string, page: number) => repo.news(token, page),
    article: (token: string, id: string) => repo.article(token, id),
    imageUrl: repo.imageUrl,
  };
}
export type ContentService = ReturnType<typeof createContentService>;
