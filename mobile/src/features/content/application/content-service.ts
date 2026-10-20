import type { ContentRepository } from '../domain/models';
export function createContentService(repo: ContentRepository) {
  return {
    home: (token: string) => repo.home(token),
    news: (token: string, page: number) => repo.news(token, page),
    article: (token: string, id: string) => repo.article(token, id),
    popup: (token: string) => repo.popup(token),
    popupViewed: (token: string, id: string) => repo.popupViewed(token, id),
    imageUrl: repo.imageUrl,
  };
}
export type ContentService = ReturnType<typeof createContentService>;
