// Home advertisements are image-only: the server supplies just the picture,
// shown in one fixed-size rectangle. Titles stay an admin-side label.
export type Advertisement = { id: string; imageId: string };
// Single source for the ad slot size; admins upload images at this ratio.
export const advertisementImage = { width: 1200, height: 600 } as const;
export const advertisementAspectRatio =
  advertisementImage.width / advertisementImage.height;
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
