export type Advertisement = {
  id: string;
  title: string;
  imageId: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
export type Article = {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageId: string;
  published: boolean;
  showOnHome: boolean;
  createdAt: string;
  updatedAt: string;
};
export type HomeContent = { advertisements: Advertisement[]; news: Article[] };
export type NewsPage = {
  items: Article[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export interface ContentRepository {
  home(token: string): Promise<HomeContent>;
  news(token: string, page: number): Promise<NewsPage>;
  article(token: string, id: string): Promise<Article>;
  imageUrl(id: string): string;
}
